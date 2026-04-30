'use client';

import { useState, FormEvent, useRef, useEffect, useMemo } from 'react';
import { Parser } from 'expr-eval';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  Car, Plane, Calendar, Utensils, Printer,
  Home as HomeIcon, Camera, Dumbbell, FileText, Hammer,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type Product = {
  _id: Id<'merchantProducts'>;
  storeName: string;
  storeLocation: string;
  productName: string;
  productCategory: string;
  subCategory?: string;
  unit: string;
  baseRate: number;
  currency: string;
  formula: string;
  variables: { name: string; label?: string; role: string; min: number; max: number; hint: string }[];
  constants: Record<string, number>;
  imageUrl: string;
  developerNote: string;
};

type ToolCallInput = {
  /** Convex merchantProducts document id — authoritative when resolving product vs name collisions */
  productId?: string;
  productName: string;
  extracted_variables: Record<string, number>;
};

type BundleToolCallInput = {
  bundleName: string;
  bundleLabel: string;
  items: { productName: string; extracted_variables: Record<string, number> }[];
};

type ChatEntry =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_call'; input: ToolCallInput; tool_use_id: string }
  | { kind: 'bundle_tool_call'; input: BundleToolCallInput; tool_use_id: string };

type Mandate = {
  ap2_version: string;
  mandate_type: string;
  mandate_id: string;
  bundle?: boolean;
  bundle_name?: string;
  bundle_label?: string;
  merchants?: { name: string; location: string }[];
  merchant: { name: string; location: string };
  line_items: {
    name: string;
    unit: string;
    quantity: number;
    unit_price_minor: number;
    total_minor: number;
    productId?: string;
    storeName?: string;
  }[];
  total: { currency: string; amount_minor: number; signed_amount: number };
  validity_window: { ttl_seconds: number; expires_at: string };
  merchant_authorization: string;
};

function buildVarsFromPending(
  product: Product,
  pending: Record<string, string>
): Record<string, number> {
  const vars: Record<string, number> = {};
  for (const v of product.variables) {
    const raw = pending[v.name];
    if (raw === undefined || raw === '') {
      throw new Error(`"${v.label || v.name}" is required`);
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new Error(`"${v.label || v.name}" must be a number`);
    vars[v.name] = n;
  }
  return vars;
}

function evaluateProductPrice(product: Product, vars: Record<string, number>): number {
  const parser = new Parser();
  const expr = parser.parse(product.formula);
  const scope: Record<string, number> = {
    ...(product.constants ?? {}),
    ...vars,
    baseRate: product.baseRate,
  };
  const required = expr.variables();
  const missing = required.filter((name) => !(name in scope));
  if (missing.length > 0) {
    throw new Error(`Missing variables for price: ${missing.join(', ')}`);
  }
  const result = expr.evaluate(scope);
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('Price could not be calculated');
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  Tokens                                                            */
/* ------------------------------------------------------------------ */

const ACCENT       = '#5C4EFF';
const TEXT_PRIMARY = '#0A0A0A';
const TEXT_SECONDARY = '#6C6C70';
const SEPARATOR    = '#E5E5EA';
const PILL_BG      = '#EEF0FF';
const CONTEXT_BG   = '#F8F8FF';

const SEND_ICON = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M14 8H2M14 8L9 3M14 8L9 13"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CATEGORY_PILLS: { icon: string; label: string }[] = [
  { icon: '/symbols/icons8-car-100.png',        label: 'Luxury Rentals' },
  { icon: '/symbols/icons8-plane-100.png',       label: 'Trip Planning' },
  { icon: '/symbols/icons8-calendar-100.png',    label: 'Event Management' },
  { icon: '/symbols/icons8-maintenance-100.png', label: 'Home Renovation' },
];

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'Luxury Rentals':     Car,
  'Trip Planning':      Plane,
  'Event Management':   Calendar,
  'Home Renovation':    Hammer,
  'Renovation':         Hammer,
  'Catering':           Utensils,
  'Printing & Branding': Printer,
  // legacy keys kept for any existing catalog entries
  Automotive:  Car,
  Travel:      Plane,
  Events:      Calendar,
  Interiors:   HomeIcon,
  Photography: Camera,
  Fitness:     Dumbbell,
  Legal:       FileText,
};

/* ------------------------------------------------------------------ */
/*  Keyframe animations                                               */
/* ------------------------------------------------------------------ */

const KeyframeStyles = () => (
  <style>{`
    @keyframes confirmCardIn {
      from {
        opacity: 0;
        transform: scale(0.96);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }
    @keyframes detailsExpand {
      from {
        opacity: 0;
        transform: translateY(-8px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    @keyframes blink {
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    }
    @keyframes checkPulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(92, 78, 255, 0.4); }
      50% { transform: scale(1.02); box-shadow: 0 0 0 8px rgba(92, 78, 255, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(92, 78, 255, 0); }
    }
    /* Mobile responsive adjustments */
    @media (max-width: 640px) {
      .z-landing-container {
        padding: 16px !important;
      }
      .z-landing-headline {
        font-size: 22px !important;
        margin-bottom: 24px !important;
      }
      .z-landing-search {
        max-width: 100% !important;
        padding: 0 4px !important;
      }
    }
  `}</style>
);

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function Home() {
  const products = useQuery(api.merchantProducts.getAll) as Product[] | undefined;

  const [mode, setMode]       = useState<'landing' | 'chat'>('landing');
  const [opacity, setOpacity] = useState(1);
  const [input, setInput]     = useState('');
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [sending, setSending]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [pendingVars, setPendingVars] = useState<Record<string, string>>({});
  const [pendingBundleVars, setPendingBundleVars] = useState<Record<string, Record<string, string>>>({});
  const [calculating, setCalculating] = useState(false);
  const [mandate, setMandate]         = useState<Mandate | null>(null);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [lockingIn, setLockingIn]     = useState(false);

  const inputRef  = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Scroll chat to bottom on new entries
  useEffect(() => {
    if (mode === 'chat') {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [entries, mode]);

  // Derive identified product from most recent tool_call entry
  const toolCallEntry = [...entries].reverse().find((e) => e.kind === 'tool_call') as
    | (ChatEntry & { kind: 'tool_call' })
    | undefined;
  const identifiedProduct = toolCallEntry && products
    ? products.find((p) =>
        toolCallEntry.input.productId
          ? p._id === toolCallEntry.input.productId
          : p.productName.toLowerCase() === toolCallEntry.input.productName.toLowerCase()
      ) ?? products.find(
        (p) => p.productName.toLowerCase() === toolCallEntry.input.productName.toLowerCase()
      )
    : null;

  // Bundle equivalent — most recent bundle_tool_call entry
  const bundleEntry = [...entries].reverse().find((e) => e.kind === 'bundle_tool_call') as
    | (ChatEntry & { kind: 'bundle_tool_call' })
    | undefined;
  const bundleProducts: { item: BundleToolCallInput['items'][number]; product: Product | null }[] =
    bundleEntry && products
      ? bundleEntry.input.items.map((it) => ({
          item: it,
          product:
            products.find((p) => p.productName.toLowerCase() === it.productName.toLowerCase()) ?? null,
        }))
      : [];

  // Fix B — reconcile pendingVars when identifiedProduct loads from Convex after
  // the API call (race condition where products weren't loaded yet when
  // dispatchMessage ran, or when the model returned label-keyed variables).
  // Runs only when the identified product or active tool call changes.
  useEffect(() => {
    if (!identifiedProduct || !toolCallEntry) return;

    const extractedVars = (toolCallEntry.input.extracted_variables ?? {}) as Record<string, number>;

    setPendingVars((prev) => {
      // No-op if every variable name already has an entry
      if (identifiedProduct.variables.every((v) => v.name in prev)) return prev;

      const next: Record<string, string> = {};
      for (const v of identifiedProduct.variables) {
        if (v.name in prev) {
          // Already keyed correctly — preserve the value (may have been edited)
          next[v.name] = prev[v.name];
          continue;
        }
        // Key missing — apply the same normalisation fallback as dispatchMessage
        let extracted: number | undefined = extractedVars[v.name];
        if (extracted === undefined) {
          const fallbackKey = Object.keys(extractedVars).find(
            (k) =>
              k.toLowerCase().replace(/\s+/g, '_') === v.name.toLowerCase() ||
              k.toLowerCase() === v.label?.toLowerCase()
          );
          if (fallbackKey !== undefined) extracted = extractedVars[fallbackKey];
        }
        next[v.name] = extracted !== undefined ? String(extracted) : '';
      }
      return next;
    });
  // Depend on stable IDs so this doesn't re-run on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identifiedProduct?._id, toolCallEntry?.tool_use_id]);

  // Reconcile bundle vars once products load
  useEffect(() => {
    if (!bundleEntry || !products) return;
    setPendingBundleVars((prev) => {
      let changed = false;
      const next: Record<string, Record<string, string>> = { ...prev };
      for (const item of bundleEntry.input.items) {
        const matched = products.find(
          (p) => p.productName.toLowerCase() === item.productName.toLowerCase()
        );
        if (!matched) continue;
        const existing = prev[item.productName] ?? {};
        if (matched.variables.every((v) => v.name in existing)) continue;
        const extracted = (item.extracted_variables ?? {}) as Record<string, number>;
        const perProduct: Record<string, string> = {};
        for (const v of matched.variables) {
          if (v.name in existing) {
            perProduct[v.name] = existing[v.name];
            continue;
          }
          let value: number | undefined = extracted[v.name];
          if (value === undefined) {
            const fallbackKey = Object.keys(extracted).find(
              (k) =>
                k.toLowerCase().replace(/\s+/g, '_') === v.name.toLowerCase() ||
                k.toLowerCase() === v.label?.toLowerCase()
            );
            if (fallbackKey !== undefined) value = extracted[fallbackKey];
          }
          perProduct[v.name] = value !== undefined ? String(value) : '';
        }
        next[item.productName] = perProduct;
        changed = true;
      }
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleEntry?.tool_use_id, products?.length]);

  /* ── Send logic ── */
  async function dispatchMessage(userText: string, history: ChatEntry[]) {
    setSending(true);
    setError(null);
    const apiMessages = history
      .filter((e) => e.kind === 'user' || e.kind === 'assistant')
      .map((e) => ({ role: e.kind as 'user' | 'assistant', content: (e as { text: string }).text }));

    // Read user profile from localStorage so Zolly can be location-aware.
    let userProfile: Record<string, unknown> | undefined;
    try {
      const profileRaw = localStorage.getItem('zolofy_profile');
      if (profileRaw) {
        const parsed = JSON.parse(profileRaw);
        if (parsed && typeof parsed === 'object') userProfile = parsed;
      }
    } catch { /* localStorage unavailable — skip */ }

    try {
      const res = await fetch('/api/zolly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          catalog: products ?? [],
          userProfile,
        }),
      });

      const ct = res.headers.get('content-type') ?? '';

      if (ct.includes('application/json')) {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else if (data.type === 'tool_call') {
          const extractedVars = (data.input.extracted_variables ?? {}) as Record<string, number>;
          const pid = typeof data.input.productId === 'string' ? data.input.productId : undefined;
          const matchedProduct =
            (products ?? []).find((p) => (pid ? p._id === pid : false)) ??
            (products ?? []).find(
              (p) => p.productName.toLowerCase() === (data.input.productName as string).toLowerCase()
            );

          console.log('[zolly] tool_call received', {
            productId: pid ?? null,
            productName: data.input.productName,
            extracted_variables: extractedVars,
            matchedProduct: matchedProduct?.productName ?? null,
            productVariables: matchedProduct?.variables.map((v) => v.name) ?? [],
          });

          // Pre-fill ALL product variables. Extracted ones get their value;
          // others stay as '' so the input shows its hint placeholder.
          // The model may return label-keyed values (e.g. "Rental Days": 3)
          // instead of name-keyed (rental_days: 3) — the fallback handles that.
          const initial: Record<string, string> = {};
          if (matchedProduct) {
            for (const v of matchedProduct.variables) {
              let value = extractedVars[v.name];
              if (value === undefined) {
                const fallback = Object.keys(extractedVars).find(
                  (k) =>
                    k.toLowerCase().replace(/\s+/g, '_') === v.name.toLowerCase() ||
                    k.toLowerCase() === v.label?.toLowerCase()
                );
                if (fallback !== undefined) value = extractedVars[fallback];
              }
              initial[v.name] = value !== undefined ? String(value) : '';
            }
          } else {
            // Products not yet in Convex — store raw keys from the model.
            // The reconciliation useEffect will re-key once identifiedProduct loads.
            for (const [k, val] of Object.entries(extractedVars)) {
              initial[k] = String(val);
            }
          }
          console.log('[zolly] pre-filled values', initial);
          setPendingVars(initial);
          setMandate(null);

          setEntries((prev) => {
            const withoutOld = prev.filter((e) => e.kind !== 'tool_call' && e.kind !== 'bundle_tool_call');
            return [...withoutOld, { kind: 'tool_call', input: data.input, tool_use_id: data.tool_use_id }];
          });
        } else if (data.type === 'bundle_tool_call') {
          const bundleInput = data.input as BundleToolCallInput;
          const initialBundle: Record<string, Record<string, string>> = {};
          for (const item of bundleInput.items) {
            const matched = (products ?? []).find(
              (p) => p.productName.toLowerCase() === item.productName.toLowerCase()
            );
            const extracted = (item.extracted_variables ?? {}) as Record<string, number>;
            const perProduct: Record<string, string> = {};
            if (matched) {
              for (const v of matched.variables) {
                let value: number | undefined = extracted[v.name];
                if (value === undefined) {
                  const fallbackKey = Object.keys(extracted).find(
                    (k) =>
                      k.toLowerCase().replace(/\s+/g, '_') === v.name.toLowerCase() ||
                      k.toLowerCase() === v.label?.toLowerCase()
                  );
                  if (fallbackKey !== undefined) value = extracted[fallbackKey];
                }
                perProduct[v.name] = value !== undefined ? String(value) : '';
              }
            } else {
              for (const [k, val] of Object.entries(extracted)) perProduct[k] = String(val);
            }
            initialBundle[item.productName] = perProduct;
          }
          setPendingBundleVars(initialBundle);
          setPendingVars({});
          setMandate(null);
          setEntries((prev) => {
            const withoutOld = prev.filter((e) => e.kind !== 'tool_call' && e.kind !== 'bundle_tool_call');
            return [...withoutOld, { kind: 'bundle_tool_call', input: bundleInput, tool_use_id: data.tool_use_id }];
          });
        }
      } else {
        const text = await res.text();
        if (text.trim()) {
          setEntries((prev) => [...prev, { kind: 'assistant', text }]);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const userText = input.trim();
    if (!userText || sending) return;
    setInput('');

    if (mode === 'landing') {
      // Fade out landing → fade in chat
      setOpacity(0);
      setTimeout(() => {
        const firstHistory: ChatEntry[] = [{ kind: 'user', text: userText }];
        setEntries(firstHistory);
        setMode('chat');
        setOpacity(1);
        dispatchMessage(userText, firstHistory);
      }, 300);
    } else {
      // Already in chat — update state first, then trigger the side effect once.
      const nextHistory: ChatEntry[] = [...entries, { kind: 'user', text: userText }];
      setEntries(nextHistory);
      dispatchMessage(userText, nextHistory);
    }
  }

  /* ── Pill click — immediately fires the prompt into chat ── */
  function handlePillClick(prompt: string) {
    if (sending) return;
    setOpacity(0);
    setTimeout(() => {
      const firstHistory: ChatEntry[] = [{ kind: 'user', text: prompt }];
      setEntries(firstHistory);
      setMode('chat');
      setOpacity(1);
      dispatchMessage(prompt, firstHistory);
    }, 300);
  }

  /* ── Mandate / Calculate ── */
  async function fetchMandate(productId: Id<'merchantProducts'>, vars: Record<string, number>) {
    setCalculating(true);
    setError(null);

    // Read stored identity + profile from localStorage to attach to mandate
    let userIdentity: { name: string; email: string; provider: string } | undefined;
    try {
      const identityRaw = localStorage.getItem('zolofy_identity');
      const profileRaw  = localStorage.getItem('zolofy_profile');
      const identity = identityRaw ? JSON.parse(identityRaw) : null;
      const profile  = profileRaw  ? JSON.parse(profileRaw)  : null;
      if (identity?.email || profile?.name) {
        userIdentity = {
          name:     profile?.name     ?? '',
          email:    identity?.email   ?? '',
          provider: identity?.provider ?? 'self-declared',
        };
      }
    } catch { /* localStorage unavailable — skip */ }

    try {
      const res = await fetch('/api/mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, variables: vars, user_identity: userIdentity }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMandate(data as Mandate);
        setSheetOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCalculating(false);
    }
  }

  async function handleLockIn() {
    if (!identifiedProduct) return;
    setError(null);
    let vars: Record<string, number>;
    try {
      vars = buildVarsFromPending(identifiedProduct, pendingVars);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    setLockingIn(true);
    try {
      await fetchMandate(identifiedProduct._id, vars);
    } finally {
      setLockingIn(false);
    }
  }

  function handleCancelConfirmation() {
    setEntries((prev) => [
      ...prev.filter((e) => e.kind !== 'tool_call' && e.kind !== 'bundle_tool_call'),
      { kind: 'assistant', text: 'No problem — what would you like to change?' },
    ]);
    setPendingVars({});
    setPendingBundleVars({});
    setMandate(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function handleBundleLockIn() {
    if (!bundleEntry) return;
    setError(null);

    const items: { productId: Id<'merchantProducts'>; variables: Record<string, number>; productName: string }[] = [];
    try {
      for (const { item, product } of bundleProducts) {
        if (!product) {
          throw new Error(`Product "${item.productName}" not in catalog yet.`);
        }
        const vars = buildVarsFromPending(product, pendingBundleVars[item.productName] ?? {});
        items.push({ productId: product._id, variables: vars, productName: product.productName });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    let userIdentity: { name: string; email: string; provider: string } | undefined;
    try {
      const identityRaw = localStorage.getItem('zolofy_identity');
      const profileRaw  = localStorage.getItem('zolofy_profile');
      const identity = identityRaw ? JSON.parse(identityRaw) : null;
      const profile  = profileRaw  ? JSON.parse(profileRaw)  : null;
      if (identity?.email || profile?.name) {
        userIdentity = {
          name:     profile?.name     ?? '',
          email:    identity?.email   ?? '',
          provider: identity?.provider ?? 'self-declared',
        };
      }
    } catch { /* skip */ }

    setLockingIn(true);
    setCalculating(true);
    try {
      const res = await fetch('/api/mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle: true,
          bundleName: bundleEntry.input.bundleName,
          bundleLabel: bundleEntry.input.bundleLabel,
          items,
          user_identity: userIdentity,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setMandate(data as Mandate);
        setSheetOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCalculating(false);
      setLockingIn(false);
    }
  }

  function dismissSheet() {
    setSheetOpen(false);
    setTimeout(() => setMandate(null), 320);
  }

  function handleStartOver() {
    setSheetOpen(false);
    setTimeout(() => {
      setMandate(null);
      setEntries([]);
      setPendingVars({});
      setPendingBundleVars({});
      setError(null);
      setLockingIn(false);
      setOpacity(0);
      setTimeout(() => {
        setMode('landing');
        setOpacity(1);
      }, 300);
    }, 320);
  }

  const canSend = input.trim().length > 0 && !sending;

  /* ── Shared header ── */
  const header = (
    <header
      className="z-chat-header"
      style={{
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '18px', fontWeight: 600, color: '#5C4EFF', letterSpacing: '-0.01em' }}>Zolofy</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Link
          href="/merchant-lab"
          style={{ fontSize: '13px', fontWeight: 500, color: TEXT_SECONDARY, textDecoration: 'none' }}
        >
          Merchant Lab →
        </Link>
      </div>
    </header>
  );

  /* ── Shared input bar ── */
  // Typewriter placeholder phrases for landing
  const PLACEHOLDER_PHRASES = [
    'Rent a Jeep Wrangler in Mauritius for 5 days...',
    'Charter a private jet from Dubai to London...',
    'Get a quote for premium catering for 200 guests...',
    'Print a 10x20 ft custom banner with a premium finish...',
  ];

  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholderText, setPlaceholderText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  // Typewriter effect for landing placeholder
  useEffect(() => {
    if (mode !== 'landing' || inputFocused || input.length > 0) return;

    const currentPhrase = PLACEHOLDER_PHRASES[placeholderIndex];
    const CHAR_SPEED = 30; // ms per character
    const PAUSE = 2000; // 2s pause

    if (isTyping && !isDeleting) {
      if (placeholderText.length < currentPhrase.length) {
        const timeout = setTimeout(() => {
          setPlaceholderText(currentPhrase.slice(0, placeholderText.length + 1));
        }, CHAR_SPEED);
        return () => clearTimeout(timeout);
      } else {
        // Finished typing, pause then start deleting
        const timeout = setTimeout(() => setIsDeleting(true), PAUSE);
        return () => clearTimeout(timeout);
      }
    }

    if (isDeleting) {
      if (placeholderText.length > 0) {
        const timeout = setTimeout(() => {
          setPlaceholderText(placeholderText.slice(0, -1));
        }, CHAR_SPEED / 2);
        return () => clearTimeout(timeout);
      } else {
        // Finished deleting, move to next phrase
        setIsDeleting(false);
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDER_PHRASES.length);
      }
    }
  }, [mode, placeholderIndex, placeholderText, isTyping, isDeleting, inputFocused, input.length]);

  const inputBar = (isLanding: boolean) => (
    <form
      onSubmit={handleSubmit}
      style={{
        width: '100%',
        maxWidth: isLanding ? 600 : '100%',
        display: 'flex',
        alignItems: 'center',
        height: isLanding ? 52 : 56,
        background: isLanding ? 'rgba(255,255,255,0.8)' : '#FFFFFF',
        backdropFilter: isLanding ? 'blur(12px)' : undefined,
        WebkitBackdropFilter: isLanding ? 'blur(12px)' : undefined,
        border: `1px solid ${SEPARATOR}`,
        borderRadius: isLanding ? 12 : 28,
        boxShadow: isLanding ? '0 4px 24px rgba(0,0,0,0.06)' : '0 2px 20px rgba(0,0,0,0.08)',
        padding: isLanding ? '0 8px 0 16px' : '0 8px 0 20px',
      }}
    >
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={isLanding && !inputFocused && input.length === 0 ? placeholderText : 'Ask Zolly anything…'}
        disabled={sending}
        onFocus={() => setInputFocused(true)}
        onBlur={() => setInputFocused(false)}
        style={{
          flex: 1,
          height: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: '16px',
          color: TEXT_PRIMARY,
        }}
      />
      <button
        type="submit"
        disabled={!canSend}
        style={{
          flexShrink: 0,
          height: isLanding ? 36 : 40,
          minWidth: isLanding ? 36 : 40,
          padding: isLanding ? '0 14px' : '0 18px',
          borderRadius: isLanding ? 8 : 20,
          background: canSend ? ACCENT : SEPARATOR,
          color: canSend ? '#FFFFFF' : TEXT_SECONDARY,
          border: 'none',
          cursor: canSend ? 'pointer' : 'default',
          fontSize: '14px',
          fontWeight: 600,
          transition: 'background 150ms ease-out, color 150ms ease-out',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {SEND_ICON}
      </button>
    </form>
  );

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */

  return (
    <>
      <KeyframeStyles />
      <div style={{ display: 'flex', minHeight: '100vh' }}>
      <NavSidebar />
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          opacity,
          transition: 'opacity 300ms ease',
        }}
      >
      {/* ── LANDING ── */}
      {mode === 'landing' && (
        <div className="relative flex min-h-[100dvh] flex-1 flex-col bg-white">
          {header}
          <main
            className="z-landing-container"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
              paddingBottom: 'max(96px, env(safe-area-inset-bottom, 0px))',
              overflowY: 'auto',
              background: '#FFFFFF',
            }}
          >
            {/* Logo mark */}
            <Image
              src="/Z_ICON.png"
              alt="Zolofy"
              width={56}
              height={56}
              style={{
                marginBottom: 32,
                borderRadius: 12,
              }}
            />

            <h1
              className="z-landing-headline"
              style={{
                fontSize: 'clamp(22px, 4vw, 28px)',
                fontWeight: 300,
                color: '#0A0A0A',
                textAlign: 'center',
                maxWidth: 520,
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
                marginBottom: 32,
                fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
              }}
            >
              What do you want to buy, book, or experience?
            </h1>

            <div className="z-landing-search" style={{ width: '100%', maxWidth: 600, marginBottom: 24 }}>
              {inputBar(true)}
            </div>

            {/* Invitation chips */}
            <div
              className="z-landing-chips grid grid-cols-2 md:flex md:flex-row md:flex-wrap md:justify-center gap-3 w-full max-w-2xl mx-auto [&_button]:w-full md:[&_button]:w-auto"
            >
              {CATEGORY_PILLS.map((pill) => (
                <InvitationChip
                  key={pill.label}
                  label={pill.label}
                  onClick={() => handlePillClick(pill.label)}
                />
              ))}
            </div>

            {/* WWDC-style tagline */}
            <p className="mt-8 max-w-xl px-4 text-center text-[13px] font-medium leading-snug text-[#6C6C70]">
              Meet Zolofy. The agentic commerce node.
            </p>
          </main>

          <footer
            className="pointer-events-none absolute bottom-6 left-0 right-0 flex w-full justify-center px-5"
            aria-label="Open source notice"
          >
            <p className="pointer-events-auto max-w-lg text-center text-[11px] leading-relaxed tracking-wide text-[#8E8E93]">
              Open-source UCP node under Apache 2.0. For collaborations:{' '}
              <a
                href="mailto:revanth@zolofy.co"
                className="text-[#8E8E93] underline decoration-transparent underline-offset-2 transition-colors duration-150 hover:text-[#636366]"
              >
                revanth@zolofy.co
              </a>
            </p>
          </footer>
        </div>
      )}

      {/* ── CHAT ── */}
      {mode === 'chat' && (
        <div className="z-chat-outer" style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {header}

          {/* Body split */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Left context panel — 28% */}
            <aside
              className="z-context-panel"
              style={{
                width: '28%',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.6)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                padding: 20,
                overflowY: 'auto',
              }}
            >
              {bundleEntry ? (
                <BundleContextCard
                  bundleLabel={bundleEntry.input.bundleLabel}
                  items={bundleProducts}
                />
              ) : identifiedProduct ? (
                <ProductContextCard product={identifiedProduct} />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <p style={{ fontSize: '13px', color: TEXT_SECONDARY, textAlign: 'center' }}>
                    Zolly will show the product here once it&apos;s identified.
                  </p>
                </div>
              )}
            </aside>

            {/* Right conversation panel — 72% */}
            <section
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                background: '#F8F8FF',
                overflow: 'hidden',
              }}
            >
              {/* Mobile-only compact product banner — replaces the hidden left panel */}
              {identifiedProduct && (
                <div className="z-product-mobile-banner">
                  <ProductInlineBanner product={identifiedProduct} />
                </div>
              )}

              {/* Messages */}
              <div
                ref={scrollRef}
                className="z-messages-area"
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {entries.map((entry, i, arr) => {
                  // Calculate gap to previous message of different kind (a "turn")
                  const prevEntry = arr[i - 1];
                  const isNewTurn = prevEntry && prevEntry.kind !== entry.kind;
                  const marginTop = isNewTurn ? 24 : 0;

                  if (entry.kind === 'user') {
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'flex-end', marginTop }}>
                        <div
                          style={{
                            maxWidth: '72%',
                            padding: '10px 16px',
                            borderRadius: '18px 18px 4px 18px',
                            background: '#5C4EFF',
                            color: '#FFFFFF',
                            fontSize: '15px',
                            lineHeight: 1.45,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {entry.text}
                        </div>
                      </div>
                    );
                  }

                  if (entry.kind === 'assistant') {
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop }}>
                        <ZollyAvatar />
                        <div style={{ flex: 1, minWidth: 0, maxWidth: '80%' }}>
                          <div
                            style={{
                              padding: '10px 16px',
                              borderRadius: '18px 18px 18px 4px',
                              background: 'rgba(255,255,255,0.75)',
                              backdropFilter: 'blur(12px)',
                              WebkitBackdropFilter: 'blur(12px)',
                              border: '1px solid #E5E5EA',
                              color: TEXT_PRIMARY,
                              fontSize: '15px',
                              lineHeight: 1.45,
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            <MarkdownText text={entry.text} />
                          </div>
                        </div>
                      </div>
                    );
                  }

                  if (entry.kind === 'bundle_tool_call') {
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <ZollyAvatar />
                        <div style={{ flex: 1, minWidth: 0, maxWidth: '80%' }}>
                          <BundleConfirmationCard
                            bundleLabel={entry.input.bundleLabel}
                            items={bundleProducts}
                            values={pendingBundleVars}
                            onChange={setPendingBundleVars}
                            onCheckoutNow={handleBundleLockIn}
                            onCancel={handleCancelConfirmation}
                            lockingIn={lockingIn || calculating}
                            mandate={mandate}
                          />
                        </div>
                      </div>
                    );
                  }

                  // tool_call — waiter-style confirmation card
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <ZollyAvatar />
                      <div style={{ flex: 1, minWidth: 0, maxWidth: '80%' }}>
                        <ConfirmationCard
                          product={identifiedProduct ?? null}
                          productName={entry.input.productName}
                          values={pendingVars}
                          onChange={setPendingVars}
                          onLockIn={handleLockIn}
                          onCancel={handleCancelConfirmation}
                          lockingIn={lockingIn || calculating}
                          mandate={mandate}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {sending && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 24 }}>
                    <ZollyAvatar pulse />
                    <div
                      style={{
                        padding: '10px 16px',
                        borderRadius: '18px 18px 18px 4px',
                        background: 'rgba(255,255,255,0.75)',
                        backdropFilter: 'blur(12px)',
                        WebkitBackdropFilter: 'blur(12px)',
                        border: '1px solid #E5E5EA',
                        color: TEXT_SECONDARY,
                        fontSize: '15px',
                        fontStyle: 'italic',
                      }}
                    >
                      …
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderRadius: 12,
                      background: '#FFF1F2',
                      color: '#9F1239',
                      fontSize: '14px',
                    }}
                  >
                    {error}
                  </div>
                )}
              </div>

              {/* Input bar — bottom (fixed on mobile, in-flow on desktop) */}
              <div
                className="z-input-wrapper"
                style={{
                  padding: '16px 28px 20px',
                  borderTop: `1px solid ${SEPARATOR}`,
                }}
              >
                {inputBar(false)}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ── MANDATE SHEET ── */}
      {mandate && (
        <MandateSheet
          mandate={mandate}
          open={sheetOpen}
          onClose={dismissSheet}
          onStartOver={handleStartOver}
        />
      )}
      </div>
    </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function MarkdownText({ text }: { text: string }) {
  // Simple markdown renderer for **bold** text
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          const content = part.slice(2, -2);
          return <strong key={i} style={{ fontWeight: 600 }}>{content}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function ZollyAvatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={pulse ? 'zolly-pulse zolly-shimmer' : ''}
      style={{
        flexShrink: 0,
        width: 28,
        height: 28,
        borderRadius: 8,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image src="/Z_ICON.png" width={28} height={28} alt="" style={{ display: 'block' }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing catalog card                                              */
/* ------------------------------------------------------------------ */

function LandingCatalogCard({
  product,
  onClick,
}: {
  product: Product;
  onClick: () => void;
}) {
  const CategoryIcon = CATEGORY_ICONS[product.productCategory] ?? null;
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        background: '#FFFFFF',
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${hovered ? ACCENT + '55' : SEPARATOR}`,
        cursor: 'pointer',
        textAlign: 'left',
        padding: 0,
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
        boxShadow: hovered ? '0 4px 16px rgba(92,78,255,0.12)' : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* Image or icon placeholder */}
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.productName}
          style={{ width: '100%', height: 96, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: 80,
            background: PILL_BG,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {CategoryIcon ? (
            <CategoryIcon size={32} color={ACCENT} strokeWidth={1.5} />
          ) : (
            <span style={{ fontSize: '28px', fontWeight: 700, color: ACCENT }}>
              {product.productCategory[0]}
            </span>
          )}
        </div>
      )}

      {/* Card body */}
      <div style={{ padding: '10px 12px 12px' }}>
        {/* Category + subcategory pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 20,
              padding: '0 7px',
              borderRadius: 5,
              background: PILL_BG,
              color: ACCENT,
              fontSize: '11px',
              fontWeight: 500,
            }}
          >
            {CategoryIcon && <CategoryIcon size={10} color={ACCENT} strokeWidth={2.5} />}
            {product.productCategory}
          </div>
          {product.subCategory && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                height: 20,
                padding: '0 7px',
                borderRadius: 5,
                background: '#F4F4F5',
                color: TEXT_SECONDARY,
                fontSize: '11px',
                fontWeight: 400,
              }}
            >
              {product.subCategory}
            </div>
          )}
        </div>

        {/* Product name */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: TEXT_PRIMARY,
            letterSpacing: '-0.01em',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {product.productName}
        </div>

        {/* Store */}
        <div
          style={{
            fontSize: '11px',
            color: TEXT_SECONDARY,
            marginBottom: 8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {product.storeName}
          {product.storeLocation ? ` · ${product.storeLocation}` : ''}
        </div>

        {/* Price */}
        <div
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: ACCENT,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {product.currency} {product.baseRate.toLocaleString()}
          <span style={{ fontSize: '11px', fontWeight: 400, color: TEXT_SECONDARY, marginLeft: 4 }}>
            {product.unit}
          </span>
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Prompt chip (landing quick-start)                                 */
/* ------------------------------------------------------------------ */

const CHIP_ARROW = (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
    <path
      d="M1.5 5.5h8M6.5 2l3 3.5-3 3.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function PromptChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 36,
        padding: '0 14px',
        borderRadius: 18,
        background: CONTEXT_BG,
        border: `1px solid ${SEPARATOR}`,
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 500,
        color: TEXT_PRIMARY,
        whiteSpace: 'nowrap',
        transition: 'background 150ms ease, border-color 150ms ease',
      }}
    >
      {label}
      <span style={{ color: ACCENT, display: 'flex', alignItems: 'center' }}>
        {CHIP_ARROW}
      </span>
    </button>
  );
}

function InvitationChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 34,
        padding: '0 16px',
        borderRadius: 17,
        background: 'transparent',
        border: `1px solid ${SEPARATOR}`,
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 400,
        color: TEXT_SECONDARY,
        whiteSpace: 'nowrap',
        transition: 'all 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = ACCENT;
        e.currentTarget.style.color = ACCENT;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = SEPARATOR;
        e.currentTarget.style.color = TEXT_SECONDARY;
      }}
    >
      {label}
      <span style={{ display: 'flex', alignItems: 'center' }}>→</span>
    </button>
  );
}

function ConfirmationRow({
  variable,
  value,
  onChange,
  disabled,
  isLast,
}: {
  variable: { name: string; label?: string; hint: string; min: number; max: number };
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  isLast: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div
      className="z-confirm-row"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 44,
        borderBottom: isLast ? 'none' : '1px solid #F2F2F7',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: '14px', color: '#0A0A0A', flexShrink: 0 }}>
        {variable.label || variable.name}
      </span>
      <div
        className="z-confirm-input-wrap"
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          marginLeft: 16,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            maxWidth: '100%',
            borderBottom: `1px solid ${focused ? '#5C4EFF' : 'transparent'}`,
            transition: 'border-color 150ms ease',
          }}
        >
          <input
            type="number"
            inputMode="decimal"
            min={variable.min}
            max={variable.max}
            step="any"
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={disabled}
            placeholder={variable.hint || `${variable.min} – ${variable.max}`}
            title={variable.hint}
            style={{
              width: '100%',
              maxWidth: '100%',
              padding: '2px 0',
              fontSize: '14px',
              fontWeight: 600,
              color: '#0A0A0A',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              textAlign: 'right',
              fontFamily: 'inherit',
              textOverflow: 'ellipsis',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function ConfirmationCard({
  product,
  productName,
  values,
  onChange,
  onLockIn,
  onCancel,
  lockingIn,
  mandate,
}: {
  product: Product | null;
  productName: string;
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onLockIn: () => void;
  onCancel: () => void;
  lockingIn: boolean;
  mandate: Mandate | null;
}) {
  const locked = !!mandate;
  const primaryDisabled = lockingIn || locked;

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        borderRadius: 20,
        padding: 24,
        animation: 'confirmCardIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '17px',
          fontWeight: 600,
          color: '#0A0A0A',
          letterSpacing: '-0.01em',
          marginBottom: 4,
        }}
      >
        {productName}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: '#6C6C70',
          marginBottom: product ? 16 : 0,
        }}
      >
        Here&apos;s what I&apos;m locking in
      </div>

      {!product ? (
        <div style={{ fontSize: '14px', color: '#6C6C70', marginTop: 8 }}>
          This product isn&apos;t in the catalog yet.
        </div>
      ) : (
        <>
          {/* Inline-editable rows — clean two-column, 44px height, divider */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {product.variables.map((v, i) => (
              <ConfirmationRow
                key={v.name}
                variable={v}
                value={values[v.name] ?? ''}
                onChange={(next) => onChange({ ...values, [v.name]: next })}
                disabled={primaryDisabled}
                isLast={i === product.variables.length - 1}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={onLockIn}
            disabled={primaryDisabled}
            className={lockingIn ? 'zolly-pulse' : ''}
            style={{
              width: '100%',
              height: 52,
              marginTop: 20,
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: 12,
              background: primaryDisabled && !lockingIn ? '#E5E5EA' : '#5C4EFF',
              color: primaryDisabled && !lockingIn ? '#6C6C70' : '#FFFFFF',
              border: 'none',
              cursor: primaryDisabled ? 'default' : 'pointer',
              letterSpacing: '-0.01em',
              transition: 'transform 80ms ease-out, background 150ms ease-out',
            }}
            onMouseDown={(e) => {
              if (!primaryDisabled) {
                e.currentTarget.style.transform = 'scale(0.97)';
              }
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            {lockingIn ? 'Locking in…' : locked ? 'Locked ✓' : 'Lock it in'}
          </button>

          {/* Cancel — plain text link */}
          <button
            onClick={onCancel}
            disabled={lockingIn}
            style={{
              marginTop: 16,
              width: '100%',
              height: 32,
              fontSize: '13px',
              fontWeight: 400,
              color: '#6C6C70',
              background: 'transparent',
              border: 'none',
              cursor: lockingIn ? 'default' : 'pointer',
              textAlign: 'center',
            }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}

function BundleConfirmationCard({
  bundleLabel,
  items,
  values,
  onChange,
  onCheckoutNow,
  onCancel,
  lockingIn,
  mandate,
}: {
  bundleLabel: string;
  items: { item: BundleToolCallInput['items'][number]; product: Product | null }[];
  values: Record<string, Record<string, string>>;
  onChange: (v: Record<string, Record<string, string>>) => void;
  onCheckoutNow: () => void;
  onCancel: () => void;
  lockingIn: boolean;
  mandate: Mandate | null;
}) {
  const locked = !!mandate;
  const primaryDisabled = lockingIn || locked;

  const merchantNames = items
    .map(({ product, item }) => product?.storeName ?? item.productName)
    .filter((s, i, a) => a.indexOf(s) === i)
    .join(' · ');

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.6)',
        borderRadius: 20,
        padding: 24,
        animation: 'confirmCardIn 200ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}
    >
      <div
        style={{
          fontSize: '17px',
          fontWeight: 600,
          color: '#0A0A0A',
          letterSpacing: '-0.01em',
          marginBottom: 4,
        }}
      >
        {bundleLabel}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: '#6C6C70',
          marginBottom: 16,
        }}
      >
        {merchantNames}
      </div>

      {items.map(({ item, product }, idx) => (
        <div key={item.productName + idx} style={{ marginBottom: idx === items.length - 1 ? 0 : 18 }}>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#5C4EFF',
              letterSpacing: '-0.01em',
              marginBottom: 8,
            }}
          >
            {product?.productName ?? item.productName}
          </div>
          {!product ? (
            <div style={{ fontSize: '13px', color: '#6C6C70' }}>
              Not in catalog yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {product.variables.map((v, i) => (
                <ConfirmationRow
                  key={v.name}
                  variable={v}
                  value={values[item.productName]?.[v.name] ?? ''}
                  onChange={(next) =>
                    onChange({
                      ...values,
                      [item.productName]: {
                        ...(values[item.productName] ?? {}),
                        [v.name]: next,
                      },
                    })
                  }
                  disabled={primaryDisabled}
                  isLast={i === product.variables.length - 1}
                />
              ))}
            </div>
          )}
          {idx !== items.length - 1 && (
            <div style={{ height: 1, background: '#F2F2F7', marginTop: 18 }} />
          )}
        </div>
      ))}

      {/* Lock it in button — full width, 52px, #5C4EFF */}
      <button
        type="button"
        onClick={onCheckoutNow}
        disabled={primaryDisabled}
        className={lockingIn ? 'zolly-pulse' : ''}
        style={{
          width: '100%',
          height: 52,
          fontSize: '16px',
          fontWeight: 600,
          borderRadius: 12,
          background: primaryDisabled && !lockingIn ? '#E5E5EA' : '#5C4EFF',
          color: primaryDisabled && !lockingIn ? '#6C6C70' : '#FFFFFF',
          border: 'none',
          cursor: primaryDisabled ? 'default' : 'pointer',
          letterSpacing: '-0.01em',
          transition: 'transform 80ms ease-out, background 150ms ease-out',
          marginTop: 20,
        }}
        onMouseDown={(e) => {
          if (!primaryDisabled) {
            e.currentTarget.style.transform = 'scale(0.97)';
          }
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
        }}
      >
        {lockingIn ? 'Locking in…' : locked ? 'Locked ✓' : 'Lock it in'}
      </button>

      {/* Cancel — plain text link */}
      <button
        onClick={onCancel}
        disabled={lockingIn}
        style={{
          marginTop: 12,
          width: '100%',
          height: 32,
          fontSize: '13px',
          fontWeight: 400,
          color: '#6C6C70',
          background: 'transparent',
          border: 'none',
          cursor: lockingIn ? 'default' : 'pointer',
          textAlign: 'center',
        }}
      >
        Cancel
      </button>
    </div>
  );
}

function BundleContextCard({
  bundleLabel,
  items,
}: {
  bundleLabel: string;
  items: { item: BundleToolCallInput['items'][number]; product: Product | null }[];
}) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: TEXT_SECONDARY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Bundle
      </div>
      <div
        style={{
          fontSize: '17px',
          fontWeight: 600,
          color: TEXT_PRIMARY,
          letterSpacing: '-0.01em',
          marginBottom: 14,
        }}
      >
        {bundleLabel}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(({ item, product }, idx) => {
          const CategoryIcon = product ? CATEGORY_ICONS[product.productCategory] ?? null : null;
          return (
            <div
              key={item.productName + idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: '#FFFFFF',
                borderRadius: 10,
                padding: '10px 12px',
                border: `1px solid ${SEPARATOR}`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: PILL_BG,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {CategoryIcon ? (
                  <CategoryIcon size={16} color={ACCENT} strokeWidth={2} />
                ) : (
                  <span style={{ fontSize: '13px', fontWeight: 700, color: ACCENT }}>
                    {(product?.productCategory ?? item.productName)[0]}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: '13px',
                    fontWeight: 600,
                    color: TEXT_PRIMARY,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {product?.productName ?? item.productName}
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    color: TEXT_SECONDARY,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {product?.storeName ?? '—'}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProductContextCard({ product }: { product: Product }) {
  const CategoryIcon = CATEGORY_ICONS[product.productCategory] ?? null;

  return (
    <div>
      {/* Product image or placeholder — full width, 180px, 16px radius, soft shadow */}
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.productName}
          style={{
            display: 'block',
            width: '100%',
            height: 180,
            objectFit: 'cover',
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            marginBottom: 16,
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: 180,
            background: 'rgba(248,248,250,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 16,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            marginBottom: 16,
            userSelect: 'none',
          }}
        >
          {CategoryIcon ? (
            <CategoryIcon size={64} color={ACCENT} strokeWidth={1.5} />
          ) : (
            <span style={{ fontSize: '56px', fontWeight: 700, color: ACCENT, letterSpacing: '-0.02em' }}>
              {product.productCategory[0]}
            </span>
          )}
        </div>
      )}

      {/* Product name: 16px semibold */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: 600,
          color: '#0A0A0A',
          letterSpacing: '-0.01em',
          marginBottom: 4,
          fontFamily: "Inter, -apple-system, sans-serif",
        }}
      >
        {product.productName}
      </div>

      {/* Store name: 12px #6C6C70 */}
      <div style={{ fontSize: '12px', color: '#6C6C70', marginBottom: 12 }}>
        {product.storeName}
        {product.storeLocation ? ` · ${product.storeLocation}` : ''}
      </div>

      {/* Price: 22px #5C4EFF bold */}
      <div
        style={{
          fontSize: '22px',
          fontWeight: 700,
          color: '#5C4EFF',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "Inter, -apple-system, sans-serif",
        }}
      >
        {product.currency} {product.baseRate.toLocaleString()}
      </div>
      <div style={{ fontSize: '11px', color: '#6C6C70', marginTop: 2 }}>
        {product.unit}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile inline product banner (replaces left panel on mobile)    */
/* ------------------------------------------------------------------ */

function ProductInlineBanner({ product }: { product: Product }) {
  const CategoryIcon = CATEGORY_ICONS[product.productCategory] ?? null;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {/* Category icon chip */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
          background: PILL_BG,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {CategoryIcon ? (
          <CategoryIcon size={18} color={ACCENT} strokeWidth={2} />
        ) : (
          <span style={{ fontSize: '15px', fontWeight: 700, color: ACCENT }}>
            {product.productCategory[0]}
          </span>
        )}
      </div>

      {/* Name + store */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: TEXT_PRIMARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {product.productName}
        </div>
        <div
          style={{
            fontSize: '11px',
            color: TEXT_SECONDARY,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {product.storeName}
          {product.storeLocation ? ` · ${product.storeLocation}` : ''}
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontSize: '15px',
            fontWeight: 700,
            color: ACCENT,
            letterSpacing: '-0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {product.currency} {product.baseRate.toLocaleString()}
        </div>
        <div style={{ fontSize: '10px', color: TEXT_SECONDARY }}>{product.unit}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Left navigation sidebar                                          */
/* ------------------------------------------------------------------ */

const NAV_ITEMS = [
  { icon: '/symbols/icons8-home-100.png',          label: 'Home',          href: '/'        },
  { icon: '/symbols/icons8-time-machine-100.png',  label: 'Order History', href: '/orders'  },
  { icon: '/symbols/icons8-registration-100.png',  label: 'Profile',       href: '/profile' },
  { icon: '/symbols/icons8-briefcase-100.png',     label: 'Dev',           href: '/dev'     },
];

const ICON_FILTER_DEFAULT = 'grayscale(100%) opacity(40%)';
const ICON_FILTER_ACTIVE  = 'invert(35%) sepia(98%) saturate(1000%) hue-rotate(230deg) brightness(0.9)';
const ICON_FILTER_HOVER   = 'grayscale(100%) opacity(70%)';

function NavItem({ icon, label, href, isActive }: { icon: string; label: string; href: string; isActive: boolean }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      {/* Active pill indicator */}
      {isActive && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 3,
            height: 24,
            borderRadius: 2,
            background: ACCENT,
          }}
        />
      )}

      <Link
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 56,
          height: 44,
          textDecoration: 'none',
          boxSizing: 'border-box',
        }}
      >
        <img
          src={icon}
          width={22}
          height={22}
          alt=""
          style={{
            display: 'block',
            filter: isActive
              ? ICON_FILTER_ACTIVE
              : hovered
              ? ICON_FILTER_HOVER
              : ICON_FILTER_DEFAULT,
            transition: 'filter 150ms ease',
          }}
        />
      </Link>

      {/* Tooltip */}
      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: 60,
            top: '50%',
            transform: 'translateY(-50%)',
            background: '#1C1C1E',
            color: '#FFFFFF',
            fontSize: '12px',
            fontWeight: 500,
            padding: '5px 10px',
            borderRadius: 6,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 200,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

function NavSidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main navigation"
      className="z-nav-sidebar"
      style={{
        width: 56,
        flexShrink: 0,
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.5)',
        boxShadow: '2px 0 20px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        zIndex: 50,
      }}
    >
      {/* Z icon */}
      <img
        src="/Z_ICON.png"
        width={28}
        height={28}
        alt=""
        className="rounded-xl"
        style={{ display: 'block', marginBottom: 28 }}
      />

      {/* Nav items */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ icon, label, href }) => (
          <NavItem
            key={href}
            icon={icon}
            label={label}
            href={href}
            isActive={pathname === href}
          />
        ))}
      </div>

      <div style={{ marginTop: 'auto' }}>
        <Image
          src="/Z_ICON.png"
          width={32}
          height={32}
          alt=""
          className="rounded-xl"
          style={{ display: 'block' }}
        />
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Mandate sheet                                                     */
/* ------------------------------------------------------------------ */

function useCountUp(target: number, running: boolean, durationMs = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!running) { setValue(0); return; }
    const start = performance.now();
    let raf: number;
    const tick = (now: number) => {
      const t = Math.min((now - start) / durationMs, 1);
      // cubic ease-out
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, target, durationMs]);
  return value;
}

function MandateSheet({
  mandate,
  open,
  onClose,
  onStartOver,
}: {
  mandate: Mandate;
  open: boolean;
  onClose: () => void;
  onStartOver: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [paid, setPaid] = useState(false);
  const [contentOpacity, setContentOpacity] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [payPressed, setPayPressed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset paid state when sheet closes
  useEffect(() => {
    if (!open) {
      setPaid(false);
      setContentOpacity(1);
      setShowDetails(false);
    }
  }, [open]);

  const expiresAt = new Date(mandate.validity_window.expires_at).getTime();
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const countdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const price    = mandate.total.amount_minor / 100;
  const currency = mandate.total.currency;
  const isBundle = mandate.bundle === true;
  const productName = isBundle
    ? (mandate.bundle_label ?? 'Bundle')
    : (mandate.line_items[0]?.name ?? '');

  const uniqueMerchantCount = useMemo(() => {
    if (!isBundle || mandate.line_items.length === 0) return 0;
    const names = mandate.line_items
      .map((li) => li.storeName)
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0);
    const n = new Set(names).size;
    return Math.max(n, 1);
  }, [isBundle, mandate.line_items]);

  const displayPrice = useCountUp(price, open && !paid);

  function handlePay() {
    setPayPressed(true);
    setTimeout(() => {
      setPayPressed(false);
      setContentOpacity(0);
      setTimeout(() => {
        setPaid(true);
        setContentOpacity(1);
      }, 200);
    }, 80);
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: open ? 'auto' : 'none',
      }}
    >
      {/* Backdrop */}
      <div
        onClick={paid ? undefined : onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.22)',
          opacity: open ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px 24px 0 0',
          overflow: 'hidden',
          maxHeight: '78vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
        }}
      >
        {/* 3px gradient top border */}
        <div aria-hidden="true" style={{ height: 3, background: 'linear-gradient(90deg, #5C4EFF, #00D4FF)', flexShrink: 0 }} />

        <div
          style={{
            padding: 32,
            position: 'relative',
            overflowY: 'auto',
            opacity: contentOpacity,
            transition: 'opacity 300ms ease',
          }}
        >
          {paid ? (
            /* ── Quote Accepted state ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 8, paddingBottom: 8, width: '100%' }}>
              {/* #5C4EFF checkmark circle with pulse */}
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: '#5C4EFF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '32px',
                  color: '#FFFFFF',
                  margin: '0 auto 20px',
                  animation: 'checkPulse 600ms ease-out forwards',
                }}
              >
                ✓
              </div>

              <div style={{ fontSize: '28px', fontWeight: 600, color: '#0A0A0A', letterSpacing: '-0.02em', marginBottom: 24 }}>
                Quote Accepted
              </div>

              {/* Line items — clean grid */}
              <div style={{ width: '100%', marginBottom: 16 }}>
                {mandate.line_items.map((li, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      height: 44,
                      borderBottom: i < mandate.line_items.length - 1 ? '1px solid #F2F2F7' : 'none',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: '#0A0A0A' }}>{li.name}</div>
                      {li.storeName ? (
                        <div style={{ fontSize: '12px', color: '#6C6C70' }}>{li.storeName}</div>
                      ) : null}
                    </div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#0A0A0A',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {currency} {(li.total_minor / 100).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  height: 44,
                  width: '100%',
                  borderTop: '1px solid #E5E5EA',
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: '15px', fontWeight: 600, color: '#0A0A0A' }}>Total</span>
                <span
                  style={{
                    fontSize: '22px',
                    fontWeight: 600,
                    color: '#0A0A0A',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {currency} {price.toLocaleString()}
                </span>
              </div>

              {/* Mandate ID — monospace 11px #6C6C70 centered */}
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#6C6C70',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  marginBottom: 24,
                  textAlign: 'center',
                }}
              >
                {mandate.mandate_id}
              </div>

              {/* Start New — full width outline button, #5C4EFF */}
              <button
                onClick={onStartOver}
                style={{
                  width: '100%',
                  height: 52,
                  fontSize: '15px',
                  fontWeight: 500,
                  borderRadius: 12,
                  background: 'transparent',
                  color: '#5C4EFF',
                  border: '1px solid #5C4EFF',
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
              >
                Start New
              </button>
            </div>
          ) : (
            /* ── Default state ── */
            <>
              {/* Close X */}
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  position: 'absolute',
                  top: 20,
                  right: 20,
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#F4F4F5',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: TEXT_SECONDARY,
                  lineHeight: 1,
                }}
              >
                ×
              </button>

              {/* Product name */}
              <div
                style={{
                  fontSize: '13px',
                  color: '#6C6C70',
                  marginBottom: 32,
                }}
              >
                {productName}
              </div>

              {/* Price - 48px weight 200, large, calm, confident */}
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 200,
                  color: '#0A0A0A',
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.05,
                  textAlign: 'center',
                  marginTop: 32,
                  marginBottom: 32,
                  fontFamily: "Inter, -apple-system, sans-serif",
                }}
              >
                {currency} {displayPrice.toLocaleString()}
              </div>

              {/* Validity pill — #F2F2F7 background with clock icon */}
              <div style={{ marginBottom: 20, textAlign: 'center' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 16,
                    background: '#F2F2F7',
                    color: '#6C6C70',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12,6 12,12 16,14"/>
                  </svg>
                  <span>Locked for {countdown}</span>
                </div>
              </div>

              {/* Show details link */}
              <button
                onClick={() => setShowDetails(!showDetails)}
                style={{
                  fontSize: '12px',
                  color: '#5C4EFF',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  marginBottom: 28,
                  padding: 0,
                }}
              >
                {showDetails ? 'Hide details' : 'Show details'}
              </button>

              {/* Expanded details */}
              {showDetails && (
                <div
                  style={{
                    animation: 'detailsExpand 200ms ease-out forwards',
                    marginBottom: 24,
                  }}
                >
                  {/* Multi-item line breakdown (bundles) */}
                  {isBundle && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        marginBottom: 14,
                        padding: '12px 0',
                        borderTop: `1px solid ${SEPARATOR}`,
                        borderBottom: `1px solid ${SEPARATOR}`,
                      }}
                    >
                      {mandate.line_items.map((li, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: 16,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: TEXT_PRIMARY,
                                lineHeight: 1.35,
                              }}
                            >
                              {li.name}
                            </div>
                            {li.storeName ? (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: TEXT_SECONDARY,
                                  marginTop: 2,
                                }}
                              >
                                {li.storeName}
                              </div>
                            ) : null}
                          </div>
                          <span
                            style={{
                              fontSize: '14px',
                              fontWeight: 600,
                              color: TEXT_PRIMARY,
                              fontVariantNumeric: 'tabular-nums',
                              flexShrink: 0,
                            }}
                          >
                            {currency} {(li.total_minor / 100).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Single item details */}
                  {!isBundle && mandate.line_items[0] && (
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 16,
                        marginBottom: 14,
                        padding: '12px 0',
                        borderTop: `1px solid ${SEPARATOR}`,
                        borderBottom: `1px solid ${SEPARATOR}`,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 600,
                            color: TEXT_PRIMARY,
                            lineHeight: 1.35,
                          }}
                        >
                          {mandate.line_items[0].name}
                        </div>
                        {mandate.merchant?.name ? (
                          <div
                            style={{
                              fontSize: '12px',
                              color: TEXT_SECONDARY,
                              marginTop: 2,
                            }}
                          >
                            {mandate.merchant.name}
                          </div>
                        ) : null}
                      </div>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: 600,
                          color: TEXT_PRIMARY,
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        {currency} {(mandate.line_items[0].total_minor / 100).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* AP2 mandate ID */}
                  <div
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      color: '#9CA3AF',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {mandate.mandate_id}
                  </div>
                </div>
              )}

              {/* Pay buttons — Apple Pay (black) + Google Pay (white) side by side, 52px height, 12px radius */}
              <div style={{ display: 'flex', gap: 12 }}>
                {/* Apple Pay button — black background, white text */}
                <button
                  onClick={handlePay}
                  style={{
                    flex: 1,
                    height: 52,
                    fontSize: '16px',
                    fontWeight: 600,
                    borderRadius: 12,
                    background: '#0A0A0A',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                    transform: payPressed ? 'scale(0.97)' : 'scale(1)',
                    transition: 'transform 80ms ease-out',
                  }}
                >
                  Apple Pay
                </button>

                {/* Google Pay button — white background, #0A0A0A text, 1px border */}
                <button
                  onClick={handlePay}
                  style={{
                    flex: 1,
                    height: 52,
                    fontSize: '16px',
                    fontWeight: 600,
                    borderRadius: 12,
                    background: '#FFFFFF',
                    color: '#0A0A0A',
                    border: '1px solid #E5E5EA',
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                    transform: payPressed ? 'scale(0.97)' : 'scale(1)',
                    transition: 'transform 80ms ease-out',
                  }}
                >
                  Google Pay
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
