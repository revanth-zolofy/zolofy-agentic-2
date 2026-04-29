import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Parser } from 'expr-eval';
import { SignJWT, importPKCS8 } from 'jose';

export const runtime = 'nodejs';

function evaluateFormula(formula: string, scope: Record<string, number>): number {
  const parser = new Parser();
  const expr = parser.parse(formula);
  const required = expr.variables();
  const missing = required.filter((name) => !(name in scope));
  if (missing.length > 0) {
    throw new Error(`Missing variables for formula "${formula}": ${missing.join(', ')}`);
  }
  const result = expr.evaluate(scope);
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error(`Formula "${formula}" did not produce a finite number (got ${result})`);
  }
  return result;
}

export async function POST(request: NextRequest) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_CONVEX_URL is not configured' }, { status: 500 });
  }

  // Normalize key: handle both real newlines and escaped \n from env serialization
  const rawKey = (process.env.MERCHANT_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .trim();
  const privateKeyPem = rawKey || null;

  const body = await request.json();
  const userIdentity = body.user_identity as { name: string; email: string; provider: string } | undefined;

  const itemsBody = body.items as Array<{
    productId: string;
    variables: Record<string, number>;
    productName?: string;
  }> | undefined;

  // ── MULTI-ITEM / CART / BUNDLE PATH (one mandate, many line_items) ──
  if (Array.isArray(itemsBody) && itemsBody.length > 0) {
    const bundleName =
      typeof body.bundleName === 'string' && body.bundleName.trim()
        ? body.bundleName.trim()
        : `MULTI_VENDOR_${Date.now()}`;
    const bundleLabel =
      typeof body.bundleLabel === 'string' && body.bundleLabel.trim()
        ? body.bundleLabel.trim()
        : 'Multi-vendor checkout';
    const items = itemsBody;

    try {
      const client = new ConvexHttpClient(convexUrl);
      const now = Date.now();
      const ttlSeconds = 900;
      const expiresAt = now + ttlSeconds * 1000;

      const lineItems: {
        name: string;
        unit: string;
        quantity: number;
        unit_price_minor: number;
        total_minor: number;
        productId: string;
        storeName: string;
      }[] = [];
      let totalAmountMinor = 0;
      let currency = '';
      const merchants: { name: string; location: string }[] = [];

      for (const item of items) {
        if (!item.productId || !item.variables) {
          return NextResponse.json({ error: 'each item requires productId and variables' }, { status: 400 });
        }
        const product = await client.query(api.merchantProducts.getById, {
          id: item.productId as Id<'merchantProducts'>,
        });
        if (!product) {
          return NextResponse.json({ error: `Product ${item.productId} not found` }, { status: 404 });
        }
        if (!currency) {
          currency = product.currency;
        } else if (product.currency !== currency) {
          return NextResponse.json(
            { error: 'All items in one checkout must use the same currency' },
            { status: 400 }
          );
        }
        const constants = (product.constants ?? {}) as Record<string, number>;
        const scope: Record<string, number> = {
          ...constants,
          ...item.variables,
          baseRate: product.baseRate,
        };
        const price = evaluateFormula(product.formula, scope);
        const amountMinor = Math.round(price * 100);

        await client.mutation(api.ucp.createEphemeralSku, {
          productId: item.productId as Id<'merchantProducts'>,
          variables: item.variables,
          price,
          status: 'active',
          createdAt: now,
          expiresAt,
        });

        lineItems.push({
          name: product.productName,
          unit: product.unit,
          quantity: 1,
          unit_price_minor: Math.round(product.baseRate * 100),
          total_minor: amountMinor,
          productId: item.productId,
          storeName: product.storeName,
        });
        totalAmountMinor += amountMinor;
        merchants.push({ name: product.storeName, location: product.storeLocation });
      }

      const bundleId = `${now}_${Math.random().toString(36).slice(2, 10)}`;
      const mandateId = `cart_bundle_${bundleId}`;

      const ap2Mandate = {
        ap2_version: '2026-04-08',
        mandate_type: 'cart',
        mandate_id: mandateId,
        bundle: true,
        bundle_name: bundleName,
        bundle_label: bundleLabel ?? bundleName,
        merchants,
        merchant: merchants[0] ?? { name: '', location: '' },
        line_items: lineItems,
        total: {
          currency,
          amount_minor: totalAmountMinor,
          signed_amount: totalAmountMinor,
        },
        validity_window: {
          ttl_seconds: ttlSeconds,
          expires_at: new Date(expiresAt).toISOString(),
        },
        ...(userIdentity && (userIdentity.email || userIdentity.name) ? {
          identity: {
            name: userIdentity.name,
            email: userIdentity.email,
            provider: userIdentity.provider || 'self-declared',
          },
        } : {}),
      };

      const encoder = new TextEncoder();
      const digestBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(ap2Mandate)));
      const digestHex = Array.from(new Uint8Array(digestBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      let merchant_authorization = 'demo-unsigned-mandate';
      if (privateKeyPem) {
        try {
          const privateKey = await importPKCS8(privateKeyPem, 'RS256');
          merchant_authorization = await new SignJWT({
            mandate_id: mandateId,
            mandate_sha256: digestHex,
            amount_minor: totalAmountMinor,
            currency,
          })
            .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
            .setIssuedAt(Math.floor(now / 1000))
            .setExpirationTime(Math.floor(expiresAt / 1000))
            .setSubject(mandateId)
            .sign(privateKey);
        } catch (keyErr) {
          const keyMsg = keyErr instanceof Error ? keyErr.message : String(keyErr);
          console.warn('[mandate:bundle] key parsing/signing failed, using demo fallback:', keyMsg);
          merchant_authorization = 'demo-unsigned-mandate';
        }
      } else {
        console.warn('[mandate:bundle] MERCHANT_PRIVATE_KEY not set — using demo-unsigned-mandate');
      }

      return NextResponse.json({ ...ap2Mandate, merchant_authorization });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[mandate:bundle] error:', message);
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── SINGLE PRODUCT PATH (unchanged) ──
  const productId = body.productId as string;
  const variables = body.variables as Record<string, number> | undefined;

  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 });
  }
  if (!variables || typeof variables !== 'object') {
    return NextResponse.json({ error: 'variables is required' }, { status: 400 });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);

    // 1. Fetch product from Convex
    const product = await client.query(api.merchantProducts.getById, {
      id: productId as Id<'merchantProducts'>,
    });
    if (!product) {
      return NextResponse.json({ error: `Product ${productId} not found` }, { status: 404 });
    }

    // 2. Evaluate formula
    const constants = (product.constants ?? {}) as Record<string, number>;
    const scope: Record<string, number> = {
      ...constants,
      ...variables,
      baseRate: product.baseRate,
    };
    const price = evaluateFormula(product.formula, scope);

    // 3. Persist ephemeral SKU in Convex
    const now = Date.now();
    const ttlSeconds = 900;
    const expiresAt = now + ttlSeconds * 1000;

    const skuId = await client.mutation(api.ucp.createEphemeralSku, {
      productId: productId as Id<'merchantProducts'>,
      variables,
      price,
      status: 'active',
      createdAt: now,
      expiresAt,
    });

    const mandateId = `cart_eph_${skuId}`;
    const amountMinor = Math.round(price * 100);

    // 4. Build AP2 mandate object (used for SHA-256 and as the response body)
    const ap2Mandate = {
      ap2_version: '2026-04-08',
      mandate_type: 'cart',
      mandate_id: mandateId,
      merchant: {
        name: product.storeName,
        location: product.storeLocation,
      },
      line_items: [
        {
          name: product.productName,
          unit: product.unit,
          quantity: 1,
          unit_price_minor: Math.round(product.baseRate * 100),
          total_minor: amountMinor,
          storeName: product.storeName,
        },
      ],
      total: {
        currency: product.currency,
        amount_minor: amountMinor,
        signed_amount: amountMinor,
      },
      validity_window: {
        ttl_seconds: ttlSeconds,
        expires_at: new Date(expiresAt).toISOString(),
      },
      ...(userIdentity && (userIdentity.email || userIdentity.name) ? {
        identity: {
          name: userIdentity.name,
          email: userIdentity.email,
          provider: userIdentity.provider || 'self-declared',
        },
      } : {}),
    };

    // 5. SHA-256 hash of AP2 mandate
    const encoder = new TextEncoder();
    const digestBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(ap2Mandate)));
    const digestHex = Array.from(new Uint8Array(digestBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // 6. Sign RS256 JWT — fall back to demo-unsigned-mandate on any key issue
    let merchant_authorization = 'demo-unsigned-mandate';
    if (privateKeyPem) {
      try {
        const privateKey = await importPKCS8(privateKeyPem, 'RS256');
        merchant_authorization = await new SignJWT({
          mandate_id: mandateId,
          mandate_sha256: digestHex,
          amount_minor: amountMinor,
          currency: product.currency,
        })
          .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
          .setIssuedAt(Math.floor(now / 1000))
          .setExpirationTime(Math.floor(expiresAt / 1000))
          .setSubject(mandateId)
          .sign(privateKey);
      } catch (keyErr) {
        const keyMsg = keyErr instanceof Error ? keyErr.message : String(keyErr);
        console.warn('[mandate] key parsing/signing failed, using demo fallback:', keyMsg);
        merchant_authorization = 'demo-unsigned-mandate';
      }
    } else {
      console.warn('[mandate] MERCHANT_PRIVATE_KEY not set — using demo-unsigned-mandate');
    }

    return NextResponse.json({ ...ap2Mandate, merchant_authorization });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[mandate] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
