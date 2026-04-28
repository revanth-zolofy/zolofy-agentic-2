'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const ACCENT         = '#5C4EFF';
const TEXT_PRIMARY   = '#0A0A0A';
const TEXT_SECONDARY = '#6C6C70';
const SEPARATOR      = '#E5E5EA';
const PILL_BG        = '#EEF0FF';

/* ------------------------------------------------------------------ */
/*  Nav sidebar (mirrored)                                             */
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
      {isActive && (
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 3, height: 24, borderRadius: 2, background: ACCENT }} />
      )}
      <Link
        href={href}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 44, textDecoration: 'none', boxSizing: 'border-box' }}
      >
        <img src={icon} width={22} height={22} alt="" style={{ display: 'block', filter: isActive ? ICON_FILTER_ACTIVE : hovered ? ICON_FILTER_HOVER : ICON_FILTER_DEFAULT, transition: 'filter 150ms ease' }} />
      </Link>
      {hovered && (
        <div style={{ position: 'absolute', left: 60, top: '50%', transform: 'translateY(-50%)', background: '#1C1C1E', color: '#FFFFFF', fontSize: '12px', fontWeight: 500, padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.25)' }}>
          {label}
        </div>
      )}
    </div>
  );
}

function NavSidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" style={{ width: 56, flexShrink: 0, background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderRight: '1px solid rgba(255,255,255,0.5)', boxShadow: '2px 0 20px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', minHeight: '100vh', position: 'sticky', top: 0, alignSelf: 'flex-start', zIndex: 50 }}>
      <img src="/Z_ICON.png" width={28} height={28} alt="Z" className="rounded-xl" style={{ display: 'block', marginBottom: 28 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ icon, label, href }) => (
          <NavItem key={href} icon={icon} label={label} href={href} isActive={pathname === href} />
        ))}
      </div>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '14px', fontWeight: 600, userSelect: 'none' }} aria-label="User profile">Z</div>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Code block                                                         */
/* ------------------------------------------------------------------ */

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <div style={{ flex: 1, minWidth: 0, background: '#0D0D14', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#8B8B9E', letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: 'monospace' }}>{label}</span>
          <button
            onClick={handleCopy}
            style={{ fontSize: 11, fontWeight: 500, color: copied ? '#4ADE80' : '#8B8B9E', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, transition: 'color 150ms ease' }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <pre style={{ margin: 0, padding: '16px', overflowX: 'auto', fontSize: 12.5, lineHeight: 1.7, color: '#E2E8F0', fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section card                                                       */
/* ------------------------------------------------------------------ */

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, border: `1px solid ${SEPARATOR}`, padding: '28px 32px', ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>
      {children}
    </h2>
  );
}

function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '0 0 24px', fontSize: 14, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
      {children}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Curl examples                                                      */
/* ------------------------------------------------------------------ */

const CURL_ZOLLY = `curl -X POST https://zolofy.co/api/zolly \\
  -H 'Content-Type: application/json' \\
  -d '{
    "messages": [{
      "role": "user",
      "content": "I need a Range Rover for 3 days with a driver"
    }],
    "catalog": "auto"
  }'`;

const CURL_MANDATE = `curl -X POST https://zolofy.co/api/mandate \\
  -H 'Content-Type: application/json' \\
  -d '{
    "productId": "kg2abc123",
    "variables": {
      "rental_days": 3,
      "is_chauffered": 1
    }
  }'`;

/* ------------------------------------------------------------------ */
/*  Response schemas                                                   */
/* ------------------------------------------------------------------ */

const ZOLLY_TOOL_CALL = `{
  "type": "tool_call",
  "tool": "request_configuration",
  "input": {
    "productName": "Car Rental",
    "extracted_variables": {
      "rental_days": 3,
      "is_chauffered": 1
    }
  }
}`;

const ZOLLY_TEXT = `"I can help you find a Range Rover with a chauffeur.
Could you confirm the pickup location and dates?"`;

const MANDATE_RESPONSE = `{
  "mandate_id": "mnd_01HXYZ9ABCDEF",
  "status": "active",
  "product": {
    "id": "kg2abc123",
    "name": "Range Rover — Chauffeur Package",
    "merchant": "Premier Auto Rentals"
  },
  "variables": {
    "rental_days": 3,
    "is_chauffered": 1
  },
  "total": 1350.00,
  "currency": "USD",
  "validity_window": {
    "created_at": "2026-04-25T10:00:00Z",
    "expires_at": "2026-04-25T10:15:00Z",
    "ttl_seconds": 900
  },
  "merchant_authorization": {
    "signed_at": "2026-04-25T10:00:00Z",
    "algorithm": "RS256",
    "signature": "eyJhbGciOiJSUzI1NiJ9..."
  }
}`;

/* ------------------------------------------------------------------ */
/*  UCP profile                                                        */
/* ------------------------------------------------------------------ */

const UCP_PROFILE = `GET /.well-known/ucp

{
  "ucp_version": "2026-04-08",
  "profile": "dev.ucp",
  "capabilities": {
    "dev.ucp.shopping.checkout": {
      "version": "2026-04-08",
      "endpoints": {
        "zolly": "/api/zolly",
        "mandate": "/api/mandate"
      }
    }
  }
}`;

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function DevPage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F2F2F7', fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <NavSidebar />

      <main style={{ flex: 1, overflowY: 'auto', padding: '40px 48px 80px' }}>
        {/* ── Header ── */}
        <div style={{ maxWidth: 900, margin: '0 auto 40px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: TEXT_PRIMARY, letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                Zolofy API
              </h1>
              <p style={{ margin: '8px 0 0', fontSize: 15, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
                Build agentic commerce into any agent
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: PILL_BG, color: ACCENT, fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20, letterSpacing: '0.01em', border: `1px solid ${ACCENT}22` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACCENT, display: 'inline-block', flexShrink: 0 }} />
                UCP v2026-04-08 compliant
              </span>
              <a
                href="https://github.com/revanth-zolofy/zolofy-agentic-2"
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: TEXT_PRIMARY, color: '#FFFFFF', fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 10, textDecoration: 'none', transition: 'opacity 150ms ease', letterSpacing: '-0.01em' }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
                </svg>
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Section 1: Quick Start ── */}
          <SectionCard>
            <SectionTitle>Quick Start</SectionTitle>
            <SectionSubtitle>Two API calls to go from natural language to a price-locked mandate.</SectionSubtitle>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <CodeBlock code={CURL_ZOLLY} label="1 · Extract variables with Zolly" />
              <CodeBlock code={CURL_MANDATE} label="2 · Mint a mandate" />
            </div>
          </SectionCard>

          {/* ── Section 2: Response schemas ── */}
          <SectionCard>
            <SectionTitle>Response Schemas</SectionTitle>
            <SectionSubtitle>Zolly returns either a structured tool call or a plain text clarification. The mandate endpoint always returns a signed AP2 object.</SectionSubtitle>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Zolly responses side by side */}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
                  <code style={{ fontSize: 12, background: '#F4F4F5', padding: '2px 7px', borderRadius: 5, fontFamily: 'monospace' }}>POST /api/zolly</code>
                  <span style={{ marginLeft: 10, color: TEXT_SECONDARY, fontWeight: 400 }}>Two possible shapes</span>
                </p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <CodeBlock code={ZOLLY_TOOL_CALL} label="tool_call — variables extracted" />
                  <CodeBlock code={ZOLLY_TEXT} label="text — clarification needed" />
                </div>
              </div>

              {/* Mandate response */}
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>
                  <code style={{ fontSize: 12, background: '#F4F4F5', padding: '2px 7px', borderRadius: 5, fontFamily: 'monospace' }}>POST /api/mandate</code>
                  <span style={{ marginLeft: 10, color: TEXT_SECONDARY, fontWeight: 400 }}>Full AP2 structure</span>
                </p>
                <CodeBlock code={MANDATE_RESPONSE} label="mandate object" />
              </div>
            </div>
          </SectionCard>

          {/* ── Section 3: UCP Profile ── */}
          <SectionCard>
            <SectionTitle>UCP Profile</SectionTitle>
            <SectionSubtitle>Agents discover capabilities via the standard <code style={{ fontSize: 12, background: '#F4F4F5', padding: '1px 6px', borderRadius: 4, fontFamily: 'monospace' }}>/.well-known/ucp</code> endpoint — no SDK required.</SectionSubtitle>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ flex: '1 1 340px', minWidth: 0 }}>
                <CodeBlock code={UCP_PROFILE} label="/.well-known/ucp" />
              </div>
              <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: PILL_BG, borderRadius: 10, padding: '14px 16px', border: `1px solid ${ACCENT}18` }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: ACCENT }}>Capability discovery</p>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.55 }}>
                    Any UCP-aware agent can fetch this profile at runtime to discover which commerce operations are available, without prior configuration.
                  </p>
                </div>
                <div style={{ background: '#F4F4F5', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: TEXT_PRIMARY }}>15-minute mandate TTL</p>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.55 }}>
                    Each mandate is merchant-signed and expires in 900 seconds, preventing stale price commitments in autonomous flows.
                  </p>
                </div>
                <a
                  href="https://ucp.dev/spec"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: ACCENT, textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  UCP specification
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                </a>
              </div>
            </div>
          </SectionCard>

          {/* ── Section 4: SDKs coming soon ── */}
          <SectionCard>
            <SectionTitle>SDKs</SectionTitle>
            <SectionSubtitle>Native client libraries are in development. Use the REST API directly in the meantime.</SectionSubtitle>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                {
                  name: 'JavaScript / TypeScript',
                  icon: (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect width="24" height="24" rx="4" fill="#F7DF1E" />
                      <path d="M6.5 17.5c.4.7 1 1.2 1.9 1.2.9 0 1.4-.4 1.4-1 0-.7-.5-1-1.4-1.4l-.5-.2c-1.4-.6-2.3-1.4-2.3-3 0-1.5 1.1-2.6 2.9-2.6 1.3 0 2.2.4 2.8 1.5l-1.5 1c-.3-.6-.7-.8-1.3-.8-.6 0-1 .3-1 .9 0 .6.4.9 1.2 1.3l.5.2c1.6.7 2.5 1.5 2.5 3.1 0 1.8-1.4 2.8-3.3 2.8-1.8 0-3-.9-3.6-2.1l1.7-1zm7.5-7.5h2v6.3c0 2.8-1.3 3.9-3.3 3.9-.5 0-1.1-.1-1.5-.3l.3-1.7c.3.1.6.2.9.2.9 0 1.6-.4 1.6-1.8V10z" fill="#323330" />
                    </svg>
                  ),
                  hint: 'npm install @zolofy/sdk',
                },
                {
                  name: 'Python',
                  icon: (
                    <svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true">
                      <defs>
                        <linearGradient id="py-a" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#5A9FD4" />
                          <stop offset="1" stopColor="#306998" />
                        </linearGradient>
                        <linearGradient id="py-b" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0" stopColor="#FFD43B" />
                          <stop offset="1" stopColor="#FFE873" />
                        </linearGradient>
                      </defs>
                      <path d="M11.9 2C7.5 2 7.8 3.9 7.8 3.9l.01 2h4.2v.6H5.8S3 6.2 3 10.6c0 4.5 2.5 4.3 2.5 4.3h1.5v-2.1s-.1-2.5 2.5-2.5h4.2s2.4.04 2.4-2.3V4.4S16.4 2 11.9 2zm-2.3 1.4c.4 0 .8.3.8.8s-.3.8-.8.8-.8-.3-.8-.8.4-.8.8-.8z" fill="url(#py-a)" />
                      <path d="M12.1 22c4.4 0 4.1-1.9 4.1-1.9l-.01-2h-4.2v-.6h6.2s2.8.3 2.8-4.1c0-4.5-2.5-4.3-2.5-4.3h-1.5v2.1s.1 2.5-2.5 2.5H10.2s-2.4-.04-2.4 2.3v3.6S7.6 22 12.1 22zm2.3-1.4c-.4 0-.8-.3-.8-.8s.3-.8.8-.8.8.3.8.8-.4.8-.8.8z" fill="url(#py-b)" />
                    </svg>
                  ),
                  hint: 'pip install zolofy',
                },
                {
                  name: 'MCP Server',
                  icon: (
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect width="24" height="24" rx="6" fill={PILL_BG} />
                      <path d="M7 8h10M7 12h7M7 16h4" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
                      <circle cx="18" cy="16" r="3" fill={ACCENT} />
                      <path d="M17 16l.8.8 1.6-1.6" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ),
                  hint: 'npx @zolofy/mcp',
                },
              ].map(({ name, icon, hint }) => (
                <div
                  key={name}
                  style={{ flex: '1 1 220px', background: '#F9F9FB', borderRadius: 14, border: `1px solid ${SEPARATOR}`, padding: '22px 22px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {icon}
                    <span style={{ background: PILL_BG, color: ACCENT, fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, letterSpacing: '0.04em' }}>
                      Coming in 2.1
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>{name}</p>
                  <code style={{ fontSize: 12, color: TEXT_SECONDARY, fontFamily: "'SF Mono', 'Fira Code', monospace", background: '#EDEDF0', padding: '5px 9px', borderRadius: 6, display: 'block' }}>
                    {hint}
                  </code>
                </div>
              ))}
            </div>
          </SectionCard>

        </div>
      </main>
    </div>
  );
}
