'use client';
// profile page
import { useState, useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const ACCENT         = '#5C4EFF';
const TEXT_PRIMARY   = '#0A0A0A';
const TEXT_SECONDARY = '#6C6C70';
const SEPARATOR      = '#E5E5EA';
const FIELD_BG       = '#F4F4F5';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Identity = { email: string; provider: 'Google Identity' | 'Apple ID' };
type Profile = {
  name: string; phone: string;
  street: string; city: string; state: string; postal: string; country: string;
};
type RawSku = { _id: string; price: number; status: string; expiresAt: number };

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
/*  Shared card shell                                                  */
/* ------------------------------------------------------------------ */

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${SEPARATOR}`, borderRadius: 16, padding: 24, ...style }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '17px', fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '-0.01em', marginBottom: 20 }}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Field component                                                    */
/* ------------------------------------------------------------------ */

function Field({ label, value, onChange, placeholder, type = 'text', disabled = false }: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; type?: string; disabled?: boolean;
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '13px', color: TEXT_SECONDARY, fontWeight: 500, marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          width: '100%',
          height: 44,
          padding: '0 14px',
          fontSize: '15px',
          background: disabled ? '#F8F8FF' : FIELD_BG,
          border: 'none',
          borderRadius: 10,
          color: TEXT_PRIMARY,
          outline: 'none',
          boxSizing: 'border-box',
          cursor: disabled ? 'default' : 'text',
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 1 — Verified Identity                                         */
/* ------------------------------------------------------------------ */

function IdentityCard() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [setupEmail, setSetupEmail] = useState('');
  const [setupProvider, setSetupProvider] = useState<'Google Identity' | 'Apple ID'>('Google Identity');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem('zolofy_identity');
      if (raw) setIdentity(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function connect() {
    if (!setupEmail.trim()) return;
    const id: Identity = { email: setupEmail.trim(), provider: setupProvider };
    localStorage.setItem('zolofy_identity', JSON.stringify(id));
    setIdentity(id);
  }

  function disconnect() {
    localStorage.removeItem('zolofy_identity');
    setIdentity(null);
    setSetupEmail('');
  }

  if (!mounted) return <Card><CardTitle>Verified Identity</CardTitle></Card>;

  return (
    <Card>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: '17px', fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
          Verified Identity
        </span>
        {identity && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 22, padding: '0 8px', borderRadius: 6, background: '#F0FDF4', color: '#16A34A', fontSize: '11px', fontWeight: 600 }}>
            ✓ Verified
          </span>
        )}
      </div>

      {identity ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Provider pill */}
          <div>
            <div style={{ fontSize: '13px', color: TEXT_SECONDARY, fontWeight: 500, marginBottom: 8 }}>Identity Provider</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', height: 32, padding: '0 14px', borderRadius: 10, background: '#EEF0FF', color: ACCENT, fontSize: '13px', fontWeight: 500 }}>
              {identity.provider === 'Google Identity' ? '🔵' : '🍎'}&nbsp;&nbsp;{identity.provider}
            </div>
          </div>

          {/* Email — display only */}
          <div>
            <div style={{ fontSize: '13px', color: TEXT_SECONDARY, fontWeight: 500, marginBottom: 6 }}>Email</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, padding: '0 14px', background: '#F8F8FF', borderRadius: 10 }}>
              <span style={{ fontSize: '15px', color: TEXT_PRIMARY, flex: 1 }}>{identity.email}</span>
              <span style={{ fontSize: '14px', color: '#16A34A', fontWeight: 600, flexShrink: 0 }}>✓</span>
            </div>
          </div>

          {/* AP2 status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: FIELD_BG, borderRadius: 10 }}>
            <span style={{ fontSize: '13px', color: TEXT_SECONDARY, flex: 1, lineHeight: 1.4 }}>
              Your identity is attached to every purchase mandate
            </span>
            <div style={{ flexShrink: 0, marginLeft: 12, display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', borderRadius: 6, background: '#F0FDF4', color: '#16A34A', fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>
              TRUSTED
            </div>
          </div>

          {/* Disconnect */}
          <button
            onClick={disconnect}
            style={{ alignSelf: 'flex-start', background: 'none', border: 'none', fontSize: '13px', color: TEXT_SECONDARY, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            Remove identity
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '14px', color: TEXT_SECONDARY, margin: 0 }}>
            Connect your identity to attach it to every purchase mandate you create.
          </p>

          {/* Provider select */}
          <div>
            <div style={{ fontSize: '13px', color: TEXT_SECONDARY, fontWeight: 500, marginBottom: 6 }}>Provider</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Google Identity', 'Apple ID'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setSetupProvider(p)}
                  style={{
                    flex: 1, height: 44, borderRadius: 10, border: `1.5px solid ${setupProvider === p ? ACCENT : SEPARATOR}`,
                    background: setupProvider === p ? '#EEF0FF' : '#FFFFFF',
                    color: setupProvider === p ? ACCENT : TEXT_SECONDARY,
                    fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  }}
                >
                  {p === 'Google Identity' ? '🔵 ' : '🍎 '}{p}
                </button>
              ))}
            </div>
          </div>

          {/* Email */}
          <Field label="Email" value={setupEmail} onChange={setSetupEmail} placeholder="you@example.com" type="email" />

          <button
            onClick={connect}
            disabled={!setupEmail.trim()}
            style={{
              height: 52, borderRadius: 14, background: setupEmail.trim() ? ACCENT : SEPARATOR,
              color: setupEmail.trim() ? '#FFFFFF' : TEXT_SECONDARY,
              fontSize: '16px', fontWeight: 600, border: 'none', cursor: setupEmail.trim() ? 'pointer' : 'default',
              letterSpacing: '-0.01em', transition: 'background 150ms ease-out',
            }}
          >
            Connect Identity
          </button>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 2 — Personal Details                                          */
/* ------------------------------------------------------------------ */

const EMPTY_PROFILE: Profile = { name: '', phone: '', street: '', city: '', state: '', postal: '', country: '' };

function PersonalDetailsCard() {
  const [form, setForm] = useState<Profile>(EMPTY_PROFILE);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const raw = localStorage.getItem('zolofy_profile');
      if (raw) setForm(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function set(key: keyof Profile, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    localStorage.setItem('zolofy_profile', JSON.stringify(form));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!mounted) return <Card><CardTitle>Personal Details</CardTitle></Card>;

  return (
    <Card>
      <CardTitle>Personal Details</CardTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Name + Phone — two column */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Full Name" value={form.name} onChange={(v) => set('name', v)} placeholder="Jane Smith" />
          <Field label="Phone Number" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1 234 567 8901" type="tel" />
        </div>

        {/* Delivery Address */}
        <div style={{ fontSize: '13px', fontWeight: 600, color: TEXT_SECONDARY, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>
          Delivery Address
        </div>

        <Field label="Street" value={form.street} onChange={(v) => set('street', v)} placeholder="123 Main Street" />

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12 }}>
          <Field label="City" value={form.city} onChange={(v) => set('city', v)} placeholder="San Francisco" />
          <Field label="State" value={form.state} onChange={(v) => set('state', v)} placeholder="CA" />
          <Field label="Postal Code" value={form.postal} onChange={(v) => set('postal', v)} placeholder="94102" />
        </div>

        <Field label="Country" value={form.country} onChange={(v) => set('country', v)} placeholder="United States" />

        <button
          onClick={save}
          style={{
            marginTop: 4, width: '100%', height: 52, fontSize: '16px', fontWeight: 600,
            borderRadius: 14, background: saved ? '#16A34A' : ACCENT,
            color: '#FFFFFF', border: 'none', cursor: 'pointer',
            letterSpacing: '-0.01em', transition: 'background 200ms ease-out',
          }}
        >
          {saved ? 'Saved ✓' : 'Save Details'}
        </button>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 3 — Payment Methods                                           */
/* ------------------------------------------------------------------ */

function PaymentCard() {
  return (
    <Card>
      <CardTitle>Payment Methods</CardTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Apple Pay row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: `1px solid ${SEPARATOR}` }}>
          {/* Apple Pay mark */}
          <div style={{ width: 48, height: 32, borderRadius: 6, background: '#000000', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700, letterSpacing: '-0.02em', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>Pay</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: TEXT_PRIMARY }}>Apple Pay</div>
            <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginTop: 2 }}>Secured by AP2 mandate signing</div>
          </div>
          {/* Default badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A' }} />
            <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 500 }}>Default</span>
          </div>
        </div>

        {/* Manage link */}
        <div style={{ paddingTop: 14 }}>
          <a
            href="#"
            style={{ fontSize: '14px', color: ACCENT, fontWeight: 500, textDecoration: 'none' }}
          >
            Manage in Wallet app →
          </a>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Card 4 — Mandate History Summary                                   */
/* ------------------------------------------------------------------ */

function MandateHistoryCard() {
  const rawSkus = useQuery(api.ucp.getOrderHistory) as RawSku[] | undefined;

  const total = rawSkus?.length ?? 0;
  const completedValue = rawSkus
    ?.filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + s.price, 0) ?? 0;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: '17px', fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
          Mandate History
        </span>
        <Link href="/orders" style={{ fontSize: '14px', color: ACCENT, fontWeight: 500, textDecoration: 'none' }}>
          View full history →
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Total mandates */}
        <div style={{ background: FIELD_BG, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginBottom: 6 }}>Total Mandates</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: TEXT_PRIMARY, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {rawSkus === undefined ? '—' : total}
          </div>
        </div>
        {/* Completed value */}
        <div style={{ background: FIELD_BG, borderRadius: 12, padding: 16 }}>
          <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginBottom: 6 }}>Completed Value</div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: rawSkus === undefined ? TEXT_SECONDARY : ACCENT, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {rawSkus === undefined ? '—' : `$${completedValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ProfilePage() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <NavSidebar />
      <div style={{ flex: 1, minWidth: 0, background: '#FFFFFF' }}>
        {/* Header */}
        <header style={{ padding: '32px 24px 24px', maxWidth: 680, margin: '0 auto' }}>
          <h1 style={{ fontSize: '28px', fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '-0.02em', margin: 0, marginBottom: 6 }}>
            Profile
          </h1>
          <p style={{ fontSize: '15px', color: TEXT_SECONDARY, margin: 0 }}>
            Your identity, details, and payment methods
          </p>
        </header>

        {/* Cards */}
        <main style={{ maxWidth: 680, margin: '0 auto', padding: '0 24px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <IdentityCard />
          <PersonalDetailsCard />
          <PaymentCard />
          <MandateHistoryCard />
        </main>
      </div>
    </div>
  );
}
