import { action, mutation, query } from './_generated/server';
import { api } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { v } from 'convex/values';
import { Parser } from 'expr-eval';
import { SignJWT, importPKCS8 } from 'jose';

export function evaluateFormula(formula: string, scope: Record<string, number>): number {
  const parser = new Parser();
  const expr = parser.parse(formula);
  const required = expr.variables();

  const missing = required.filter((name) => !(name in scope));
  if (missing.length > 0) {
    throw new Error(
      `evaluateFormula: missing variables for formula "${formula}": ${missing.join(', ')}`
    );
  }

  const result = expr.evaluate(scope);
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error(
      `evaluateFormula: formula "${formula}" did not produce a finite number (got ${result})`
    );
  }
  return result;
}

export const getOrderHistory = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('ephemeral_skus')
      .order('desc')
      .collect();
  },
});

export const listEphemeralSkus = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('ephemeral_skus').collect();
  },
});

export const getEphemeralSku = query({
  args: { id: v.id('ephemeral_skus') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createEphemeralSku = mutation({
  args: {
    productId: v.id('merchantProducts'),
    variables: v.any(),
    price: v.number(),
    status: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('ephemeral_skus', args);
  },
});

type CartMandate = {
  contents: {
    id: string;
    productId: Id<'merchantProducts'>;
    productName: string;
    storeName: string;
    unit: string;
    currency: string;
    price: number;
    variables: Record<string, number>;
    createdAt: string;
    expiresAt: string;
  };
  merchant_authorization: string;
  validity_window: { ttl_seconds: number; expires_at: string };
};

export const evaluateOnly = action({
  args: {
    productId: v.id('merchantProducts'),
    variables: v.any(),
  },
  handler: async (
    ctx,
    args: { productId: Id<'merchantProducts'>; variables: Record<string, number> }
  ): Promise<{ price: number }> => {
    const product = await ctx.runQuery(api.merchantProducts.getById, { id: args.productId });
    if (!product) {
      throw new Error(`evaluateOnly: product ${args.productId} not found`);
    }
    const constants = (product.constants ?? {}) as Record<string, number>;
    const scope: Record<string, number> = {
      ...constants,
      ...args.variables,
      baseRate: product.baseRate,
    };
    const price = evaluateFormula(product.formula, scope);
    return { price };
  },
});

export const generateCartMandate = action({
  args: {
    productId: v.id('merchantProducts'),
    variables: v.any(),
  },
  handler: async (
    ctx,
    args: { productId: Id<'merchantProducts'>; variables: Record<string, number> }
  ): Promise<CartMandate> => {
    const product = await ctx.runQuery(api.merchantProducts.getById, { id: args.productId });
    if (!product) {
      throw new Error(`generateCartMandate: product ${args.productId} not found`);
    }

    const constants = (product.constants ?? {}) as Record<string, number>;
    const scope: Record<string, number> = {
      ...constants,
      ...args.variables,
      baseRate: product.baseRate,
    };

    const price = evaluateFormula(product.formula, scope);

    const now = Date.now();
    const ttlSeconds = 900;
    const expiresAt = now + ttlSeconds * 1000;

    const skuId = await ctx.runMutation(api.ucp.createEphemeralSku, {
      productId: args.productId,
      variables: args.variables,
      price,
      status: 'active',
      createdAt: now,
      expiresAt,
    });

    const contents = {
      id: `cart_eph_${skuId}`,
      productId: args.productId,
      productName: product.productName,
      storeName: product.storeName,
      unit: product.unit,
      currency: product.currency,
      price,
      variables: args.variables,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(expiresAt).toISOString(),
    };

    const contentsJson = JSON.stringify(contents);
    const encoder = new TextEncoder();
    const digestBuffer = await globalThis.crypto.subtle.digest(
      'SHA-256',
      encoder.encode(contentsJson)
    );
    const digestHex = Array.from(new Uint8Array(digestBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const privateKeyPem = process.env.MERCHANT_PRIVATE_KEY;
    if (!privateKeyPem) {
      throw new Error('generateCartMandate: MERCHANT_PRIVATE_KEY env var is not set');
    }
    const privateKey = await importPKCS8(privateKeyPem, 'RS256');

    const merchantAuthorization = await new SignJWT({
      cart_id: contents.id,
      cart_sha256: digestHex,
      price,
      currency: product.currency,
    })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(expiresAt / 1000))
      .setSubject(contents.id)
      .sign(privateKey);

    return {
      contents,
      merchant_authorization: merchantAuthorization,
      validity_window: {
        ttl_seconds: ttlSeconds,
        expires_at: new Date(expiresAt).toISOString(),
      },
    };
  },
});
