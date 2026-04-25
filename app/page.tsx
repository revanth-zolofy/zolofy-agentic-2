'use client';

import { useState, FormEvent, useRef, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';
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
  unit: string;
  baseRate: number;
  currency: string;
  formula: string;
  variables: { name: string; role: string; min: number; max: number; hint: string }[];
  constants: Record<string, number>;
  imageUrl: string;
  developerNote: string;
};

type ToolCallInput = {
  productName: string;
  extracted_variables: Record<string, number>;
};

type ChatEntry =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'tool_call'; input: ToolCallInput; tool_use_id: string };

type Mandate = {
  ap2_version: string;
  mandate_type: string;
  mandate_id: string;
  merchant: { name: string; location: string };
  line_items: {
    name: string;
    unit: string;
    quantity: number;
    unit_price_minor: number;
    total_minor: number;
  }[];
  total: { currency: string; amount_minor: number; signed_amount: number };
  validity_window: { ttl_seconds: number; expires_at: string };
  merchant_authorization: string;
};

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

const CATEGORY_PILLS: { icon: string; label: string; prompt: string }[] = [
  { icon: '/symbols/icons8-car-100.png',          label: 'Car Rental',   prompt: 'I need a luxury car rental for a few days'          },
  { icon: '/symbols/icons8-plane-100.png',         label: 'Travel',       prompt: 'I want to plan a trip to Maldives'                  },
  { icon: '/symbols/icons8-3-star-hotel-100.png',  label: 'Hotels',       prompt: 'I need to book a hotel stay'                        },
  { icon: '/symbols/icons8-beach-100.png',         label: 'Beach Resort', prompt: 'I want a beach resort experience'                   },
  { icon: '/symbols/icons8-cruise-ship-100.png',   label: 'Cruise',       prompt: 'I want to book a cruise package'                    },
  { icon: '/symbols/icons8-calendar-100.png',      label: 'Events',       prompt: 'I need to plan a corporate event for 50 people'     },
  { icon: '/symbols/icons8-briefcase-100.png',     label: 'Business',     prompt: 'I need business travel arranged'                    },
  { icon: '/symbols/icons8-maintenance-100.png',   label: 'Renovation',   prompt: 'I need a home renovation quote'                     },
];

type LucideIcon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Automotive:  Car,
  Travel:      Plane,
  Events:      Calendar,
  Catering:    Utensils,
  Printing:    Printer,
  Interiors:   HomeIcon,
  Photography: Camera,
  Fitness:     Dumbbell,
  Legal:       FileText,
  Renovation:  Hammer,
};

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
  const [calculating, setCalculating] = useState(false);
  const [mandate, setMandate]         = useState<Mandate | null>(null);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [flashActive, setFlashActive] = useState(false);
  const [autoFired, setAutoFired] = useState(false);

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
    ? products.find(
        (p) => p.productName.toLowerCase() === toolCallEntry.input.productName.toLowerCase()
      )
    : null;

  /* ── Send logic ── */
  async function dispatchMessage(userText: string, history: ChatEntry[]) {
    setSending(true);
    setError(null);
    const apiMessages = history
      .filter((e) => e.kind === 'user' || e.kind === 'assistant')
      .map((e) => ({ role: e.kind as 'user' | 'assistant', content: (e as { text: string }).text }));

    try {
      const res = await fetch('/api/zolly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, catalog: products ?? [] }),
      });

      const ct = res.headers.get('content-type') ?? '';

      if (ct.includes('application/json')) {
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else if (data.type === 'tool_call') {
          const extractedVars = data.input.extracted_variables as Record<string, number>;
          const matchedProduct = (products ?? []).find(
            (p) => p.productName.toLowerCase() === (data.input.productName as string).toLowerCase()
          );
          const allVarNames = matchedProduct?.variables.map((v) => v.name) ?? [];
          const allPresent =
            allVarNames.length > 0 && allVarNames.every((name) => name in extractedVars);

          // Pre-fill pending vars from extracted values
          const initial: Record<string, string> = {};
          for (const [k, v] of Object.entries(extractedVars)) {
            initial[k] = String(v);
          }
          setPendingVars(initial);
          setMandate(null);

          if (allPresent && matchedProduct) {
            // All variables known — skip form, fire mandate directly
            setAutoFired(true);
            setEntries((prev) => {
              const withoutOld = prev.filter((e) => e.kind !== 'tool_call');
              return [
                ...withoutOld,
                { kind: 'tool_call', input: data.input, tool_use_id: data.tool_use_id },
                { kind: 'assistant', text: 'Perfect, locking in your quote…' },
              ];
            });
            await fetchMandate(matchedProduct._id, extractedVars);
          } else {
            // Some or no variables — show form for missing ones
            setAutoFired(false);
            setEntries((prev) => {
              const withoutOld = prev.filter((e) => e.kind !== 'tool_call');
              return [...withoutOld, { kind: 'tool_call', input: data.input, tool_use_id: data.tool_use_id }];
            });
          }
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
      // Already in chat — append user message then send
      setEntries((prev) => {
        const next: ChatEntry[] = [...prev, { kind: 'user', text: userText }];
        dispatchMessage(userText, next);
        return next;
      });
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
        setFlashActive(true);
        setTimeout(() => {
          setSheetOpen(true);
          setFlashActive(false);
        }, 150);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCalculating(false);
    }
  }

  async function handleCalculate() {
    if (!identifiedProduct) return;
    setError(null);
    const vars: Record<string, number> = {};
    try {
      for (const [k, v] of Object.entries(pendingVars)) {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error(`"${k}" must be a number`);
        vars[k] = n;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }
    await fetchMandate(identifiedProduct._id, vars);
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
      setError(null);
      setAutoFired(false);
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
      style={{
        padding: '20px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <span style={{ fontSize: '18px', fontWeight: 600, color: '#5C4EFF', letterSpacing: '-0.01em' }}>Zolofy</span>
      <Link
        href="/merchant-lab"
        style={{ fontSize: '13px', fontWeight: 500, color: TEXT_SECONDARY, textDecoration: 'none' }}
      >
        Merchant Lab →
      </Link>
    </header>
  );

  /* ── Shared input bar ── */
  const inputBar = (isLanding: boolean) => (
    <form
      onSubmit={handleSubmit}
      style={{
        width: '100%',
        maxWidth: isLanding ? 560 : '100%',
        display: 'flex',
        alignItems: 'center',
        height: 56,
        background: '#FFFFFF',
        border: `1px solid ${SEPARATOR}`,
        borderRadius: 28,
        boxShadow: '0 2px 20px rgba(0,0,0,0.08)',
        padding: '0 8px 0 20px',
      }}
    >
      <input
        ref={isLanding ? inputRef : undefined}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Ask Zolly anything…"
        disabled={sending}
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
          height: 40,
          minWidth: 40,
          padding: '0 18px',
          borderRadius: 20,
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
        <>
          {header}
          <main
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 24px 80px',
            }}
          >
            <h1
              style={{
                fontSize: '32px',
                fontWeight: 600,
                color: TEXT_PRIMARY,
                textAlign: 'center',
                maxWidth: 480,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                marginBottom: 32,
              }}
            >
              What do you want to buy, book, or experience?
            </h1>

            <div style={{ width: '100%', maxWidth: 560, marginBottom: 20 }}>
              {inputBar(true)}
            </div>

            {/* Category marquee */}
            <div
              style={{
                width: '100%',
                maxWidth: 600,
                overflow: 'hidden',
                maskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
                WebkitMaskImage: 'linear-gradient(90deg, transparent, black 12%, black 88%, transparent)',
                marginTop: 8,
              }}
            >
              <div
                className="z-marquee"
                style={{ display: 'flex', gap: 10, width: 'max-content' }}
              >
                {[...CATEGORY_PILLS, ...CATEGORY_PILLS].map(({ icon, label, prompt }, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePillClick(prompt)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 16px',
                      borderRadius: 20,
                      background: '#FFFFFF',
                      border: '1px solid #E5E5EA',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={icon}
                      width={20}
                      height={20}
                      alt=""
                      style={{
                        display: 'block',
                        filter: 'invert(35%) sepia(98%) saturate(1000%) hue-rotate(230deg) brightness(0.9)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        color: '#0A0A0A',
                        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
                      }}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </main>
        </>
      )}

      {/* ── CHAT ── */}
      {mode === 'chat' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
          {header}

          {/* Body split */}
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

            {/* Left context panel — 28% */}
            <aside
              style={{
                width: '28%',
                flexShrink: 0,
                background: CONTEXT_BG,
                borderRight: `1px solid ${SEPARATOR}`,
                padding: 20,
                overflowY: 'auto',
              }}
            >
              {identifiedProduct ? (
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
                background: '#FFFFFF',
                overflow: 'hidden',
              }}
            >
              {/* Messages */}
              <div
                ref={scrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '24px 28px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {entries.map((entry, i) => {
                  if (entry.kind === 'user') {
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <div
                          style={{
                            maxWidth: '72%',
                            padding: '10px 16px',
                            borderRadius: 18,
                            background: ACCENT,
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
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                        <ZollyAvatar />
                        <div
                          style={{
                            maxWidth: '72%',
                            padding: '10px 16px',
                            borderRadius: 18,
                            background: '#F4F4F5',
                            color: TEXT_PRIMARY,
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

                  // tool_call — configuration card (hidden when auto-fired)
                  if (autoFired) return null;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <ZollyAvatar />
                      <div style={{ flex: 1, minWidth: 0, maxWidth: '80%' }}>
                        <ConfigCard
                          product={identifiedProduct ?? null}
                          productName={entry.input.productName}
                          extractedVarNames={Object.keys(entry.input.extracted_variables)}
                          values={pendingVars}
                          onChange={setPendingVars}
                          onCalculate={handleCalculate}
                          calculating={calculating}
                          mandate={mandate}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {sending && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <ZollyAvatar pulse />
                    <div
                      style={{
                        padding: '10px 16px',
                        borderRadius: 18,
                        background: '#F4F4F5',
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

              {/* Input bar — bottom */}
              <div
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

      {/* ── FLASH ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: '#FFFFFF',
          opacity: flashActive ? 1 : 0,
          transition: flashActive ? 'none' : 'opacity 150ms ease',
          pointerEvents: 'none',
        }}
      />

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
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function ZollyAvatar({ pulse = false }: { pulse?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={pulse ? 'zolly-pulse zolly-shimmer' : ''}
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        borderRadius: 10,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <img
        src="/Z_ICON.png"
        width={32}
        height={32}
        alt=""
        style={{ display: 'block', width: 32, height: 32, borderRadius: 10 }}
      />
    </div>
  );
}

function ConfigCard({
  product,
  productName,
  extractedVarNames,
  values,
  onChange,
  onCalculate,
  calculating,
  mandate,
}: {
  product: Product | null;
  productName: string;
  extractedVarNames: string[];
  values: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  onCalculate: () => void;
  calculating: boolean;
  mandate: Mandate | null;
}) {
  const btnDisabled = calculating || !!mandate;
  // Only show inputs for variables Zolly couldn't extract
  const varsToShow = product
    ? product.variables.filter((v) => !extractedVarNames.includes(v.name))
    : [];

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${SEPARATOR}`,
        borderRadius: 16,
        padding: 24,
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: '17px',
          fontWeight: 600,
          color: TEXT_PRIMARY,
          letterSpacing: '-0.01em',
          marginBottom: product ? 20 : 0,
        }}
      >
        {productName}
      </div>

      {!product ? (
        <div style={{ fontSize: '14px', color: TEXT_SECONDARY, marginTop: 8 }}>
          This product isn&apos;t in the catalog yet.
        </div>
      ) : (
        <>
          {/* Variable inputs — only missing vars */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {varsToShow.map((v) => (
              <div key={v.name}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    color: TEXT_SECONDARY,
                    marginBottom: 6,
                    fontWeight: 500,
                  }}
                >
                  {v.name}
                  {v.hint && (
                    <span style={{ fontWeight: 400, marginLeft: 6 }}>· {v.hint}</span>
                  )}
                </label>
                <input
                  type="number"
                  min={v.min}
                  max={v.max}
                  step="any"
                  value={values[v.name] ?? ''}
                  onChange={(e) => onChange({ ...values, [v.name]: e.target.value })}
                  disabled={btnDisabled}
                  placeholder={`${v.min} – ${v.max}`}
                  style={{
                    width: '100%',
                    height: 44,
                    padding: '0 14px',
                    fontSize: '15px',
                    background: '#F4F4F5',
                    border: 'none',
                    borderRadius: 10,
                    color: TEXT_PRIMARY,
                    outline: 'none',
                  }}
                />
              </div>
            ))}
          </div>

          {/* Calculate button */}
          <button
            onClick={onCalculate}
            disabled={btnDisabled}
            style={{
              marginTop: 24,
              width: '100%',
              height: 52,
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: 14,
              background: btnDisabled ? SEPARATOR : ACCENT,
              color: btnDisabled ? TEXT_SECONDARY : '#FFFFFF',
              border: 'none',
              cursor: btnDisabled ? 'default' : 'pointer',
              letterSpacing: '-0.01em',
              transition: 'background 150ms ease-out, color 150ms ease-out',
            }}
          >
            {calculating ? 'Calculating…' : mandate ? 'Price locked ✓' : 'Calculate & Lock Price'}
          </button>
        </>
      )}
    </div>
  );
}

function ProductContextCard({ product }: { product: Product }) {
  const CategoryIcon = CATEGORY_ICONS[product.productCategory] ?? null;

  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: 600, color: TEXT_SECONDARY, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 16 }}>
        Product
      </div>
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
        }}
      >
        {/* Category pill + icon */}
        <div style={{ padding: '16px 16px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: '0 10px',
                borderRadius: 8,
                background: PILL_BG,
                color: ACCENT,
                fontSize: '12px',
                fontWeight: 500,
                letterSpacing: '0.01em',
              }}
            >
              {CategoryIcon && (
                <CategoryIcon size={12} color={ACCENT} strokeWidth={2.5} />
              )}
              {product.productCategory}
            </div>
          </div>
        </div>

        {/* Product image or placeholder */}
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.productName}
            style={{
              display: 'block',
              width: '100%',
              height: 160,
              objectFit: 'cover',
              borderRadius: 12,
              boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
              margin: '0 0 12px',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: 160,
              background: PILL_BG,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              margin: '0 0 12px',
              userSelect: 'none',
            }}
          >
            {CategoryIcon ? (
              <CategoryIcon size={56} color={ACCENT} strokeWidth={1.5} />
            ) : (
              <span style={{ fontSize: '48px', fontWeight: 700, color: ACCENT, letterSpacing: '-0.02em' }}>
                {product.productCategory[0]}
              </span>
            )}
          </div>
        )}

        {/* Details body with watermark */}
        <div style={{ padding: '0 16px 16px', position: 'relative', overflow: 'hidden' }}>
          {/* Watermark icon */}
          {CategoryIcon && (
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: -8,
                right: -4,
                opacity: 0.05,
                pointerEvents: 'none',
                lineHeight: 1,
              }}
            >
              <CategoryIcon size={48} color={ACCENT} strokeWidth={1.5} />
            </div>
          )}

          {/* Product name */}
          <div
            style={{
              fontSize: '17px',
              fontWeight: 600,
              color: TEXT_PRIMARY,
              letterSpacing: '-0.01em',
              marginBottom: 4,
              position: 'relative',
            }}
          >
            {product.productName}
          </div>

          {/* Store */}
          <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginBottom: 16, position: 'relative' }}>
            {product.storeName}
            {product.storeLocation ? ` · ${product.storeLocation}` : ''}
          </div>

          {/* Base price — most prominent */}
          <div
            style={{
              fontSize: '24px',
              fontWeight: 700,
              color: ACCENT,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums',
              position: 'relative',
            }}
          >
            {product.currency} {product.baseRate.toLocaleString()}
          </div>
          <div style={{ fontSize: '12px', color: TEXT_SECONDARY, marginTop: 2, position: 'relative' }}>
            {product.unit}
          </div>
        </div>
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
        alt="Z"
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

      {/* User avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: ACCENT,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontSize: '14px',
          fontWeight: 600,
          userSelect: 'none',
        }}
        aria-label="User profile"
      >
        Z
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Mandate sheet                                                     */
/* ------------------------------------------------------------------ */

const PAY_GRADIENT = `linear-gradient(135deg, ${ACCENT}, #00D4FF)`;
const TOP_GRADIENT = `linear-gradient(90deg, ${ACCENT}, #00D4FF)`;

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

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset paid state when sheet closes
  useEffect(() => {
    if (!open) {
      setPaid(false);
      setContentOpacity(1);
    }
  }, [open]);

  const expiresAt = new Date(mandate.validity_window.expires_at).getTime();
  const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const countdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const price    = mandate.total.amount_minor / 100;
  const currency = mandate.total.currency;
  const productName = mandate.line_items[0]?.name ?? '';

  const displayPrice = useCountUp(price, open && !paid);

  function handlePay() {
    setContentOpacity(0);
    setTimeout(() => {
      setPaid(true);
      setContentOpacity(1);
    }, 300);
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
          background: 'rgba(0,0,0,0.4)',
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
          background: '#FFFFFF',
          borderRadius: '24px 24px 0 0',
          overflow: 'hidden',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
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
            /* ── Success state ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: 8, paddingBottom: 8 }}>
              {/* Green checkmark */}
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: '#DCFCE7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '36px',
                  color: '#16A34A',
                  marginBottom: 20,
                }}
              >
                ✓
              </div>

              {/* Quote Accepted */}
              <div style={{ fontSize: '24px', fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '-0.02em', marginBottom: 8 }}>
                Quote Accepted
              </div>

              {/* Product name */}
              <div style={{ fontSize: '14px', color: TEXT_SECONDARY, marginBottom: 4 }}>
                {productName}
              </div>

              {/* Final price */}
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: 16,
                }}
              >
                {currency} {price.toLocaleString()}
              </div>

              {/* Confirmation message */}
              <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginBottom: 12 }}>
                Your mandate has been recorded.
              </div>

              {/* Mandate ID */}
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#9CA3AF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  marginBottom: 28,
                }}
              >
                {mandate.mandate_id}
              </div>

              {/* Start New button */}
              <button
                onClick={onStartOver}
                style={{
                  width: '100%',
                  height: 48,
                  fontSize: '15px',
                  fontWeight: 500,
                  borderRadius: 12,
                  background: 'transparent',
                  color: ACCENT,
                  border: `1.5px solid ${ACCENT}`,
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
                  color: TEXT_SECONDARY,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: 8,
                }}
              >
                {productName}
              </div>

              {/* Price */}
              <div
                style={{
                  fontSize: '48px',
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  letterSpacing: '-0.03em',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1.1,
                  marginBottom: 20,
                }}
              >
                {currency} {displayPrice.toLocaleString()}
              </div>

              {/* Validity pill */}
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 20,
                    background: '#EEF0FF',
                    color: '#5C4EFF',
                    fontSize: '13px',
                    fontWeight: 500,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span aria-hidden="true">⏱</span>
                  <span>Locked for {countdown}</span>
                </div>
              </div>

              {/* AP2 mandate ID */}
              <div
                style={{
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  color: '#9CA3AF',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginBottom: 28,
                }}
              >
                {mandate.mandate_id}
              </div>

              {/* Pay button */}
              <button
                onClick={handlePay}
                style={{
                  width: '100%',
                  height: 56,
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: 14,
                  background: 'linear-gradient(135deg, #5C4EFF, #00D4FF)',
                  color: '#FFFFFF',
                  border: 'none',
                  cursor: 'pointer',
                  letterSpacing: '-0.01em',
                }}
              >
                Pay with Apple Pay
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
