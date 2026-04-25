'use client';

import { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const ACCENT        = '#5C4EFF';
const TEXT_PRIMARY  = '#0A0A0A';
const TEXT_SECONDARY = '#6C6C70';
const SEPARATOR     = '#E5E5EA';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type RawSku = {
  _id: string;
  productId: string;
  price: number;
  status: string;
  createdAt: number;
  expiresAt: number;
  variables: Record<string, number>;
};

type Product = {
  _id: string;
  productName: string;
  storeName: string;
  currency: string;
};

type Order = RawSku & {
  productName: string;
  storeName: string;
  currency: string;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(ts: number): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${date} · ${time}`;
}

function getEffectiveStatus(status: string, expiresAt: number): string {
  if (status === 'active' && expiresAt < Date.now()) return 'expired';
  return status;
}

function statusBadgeStyle(status: string): { bg: string; color: string; label: string } {
  switch (status) {
    case 'active':    return { bg: '#EEF0FF', color: ACCENT,     label: 'Active'    };
    case 'completed': return { bg: '#F0FDF4', color: '#16A34A',  label: 'Completed' };
    default:          return { bg: '#F4F4F5', color: TEXT_SECONDARY, label: 'Expired' };
  }
}

/* ------------------------------------------------------------------ */
/*  Nav sidebar (mirrored from main page)                             */
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
            filter: isActive ? ICON_FILTER_ACTIVE : hovered ? ICON_FILTER_HOVER : ICON_FILTER_DEFAULT,
            transition: 'filter 150ms ease',
          }}
        />
      </Link>
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
      <img
        src="/Z_ICON.png"
        width={28}
        height={28}
        alt="Z"
        className="rounded-xl"
        style={{ display: 'block', marginBottom: 28 }}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ icon, label, href }) => (
          <NavItem key={href} icon={icon} label={label} href={href} isActive={pathname === href} />
        ))}
      </div>
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
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        background: '#FFFFFF',
        border: `1px solid ${SEPARATOR}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontSize: '13px', color: TEXT_SECONDARY, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const effectiveStatus = getEffectiveStatus(order.status, order.expiresAt);
  const badge = statusBadgeStyle(effectiveStatus);
  const mandateId = `cart_eph_${order._id}`;

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${SEPARATOR}`,
        borderRadius: 16,
        padding: 20,
      }}
    >
      {/* Top row: product name + status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: '17px', fontWeight: 600, color: TEXT_PRIMARY, letterSpacing: '-0.01em' }}>
          {order.productName}
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 24,
            padding: '0 10px',
            borderRadius: 8,
            background: badge.bg,
            color: badge.color,
            fontSize: '12px',
            fontWeight: 500,
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          {badge.label}
        </div>
      </div>

      {/* Second row: store name · mandate ID */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, overflow: 'hidden' }}>
        <span style={{ fontSize: '13px', color: TEXT_SECONDARY, flexShrink: 0 }}>
          {order.storeName}
        </span>
        {order.storeName && (
          <span style={{ fontSize: '13px', color: TEXT_SECONDARY, flexShrink: 0 }}>·</span>
        )}
        <span
          style={{
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#9CA3AF',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {mandateId}
        </span>
      </div>

      {/* Bottom row: date + price */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: '13px', color: TEXT_SECONDARY }}>
          {formatDate(order.createdAt)}
        </div>
        <div style={{ fontSize: '20px', fontWeight: 600, color: ACCENT, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
          {order.currency} {order.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 80,
        paddingBottom: 80,
        textAlign: 'center',
      }}
    >
      <img
        src="/symbols/icons8-plane-100.png"
        width={48}
        height={48}
        alt=""
        style={{
          display: 'block',
          marginBottom: 20,
          filter: 'invert(35%) sepia(98%) saturate(1000%) hue-rotate(230deg) brightness(0.9)',
        }}
      />
      <div style={{ fontSize: '17px', fontWeight: 600, color: TEXT_PRIMARY, marginBottom: 8 }}>
        No orders yet
      </div>
      <div style={{ fontSize: '15px', color: TEXT_SECONDARY, marginBottom: 24 }}>
        Your quotes and purchases will appear here
      </div>
      <Link
        href="/"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 44,
          padding: '0 24px',
          borderRadius: 12,
          background: ACCENT,
          color: '#FFFFFF',
          fontSize: '15px',
          fontWeight: 600,
          textDecoration: 'none',
          letterSpacing: '-0.01em',
        }}
      >
        Start Shopping
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function OrdersPage() {
  const rawSkus    = useQuery(api.ucp.getOrderHistory) as RawSku[] | undefined;
  const products   = useQuery(api.merchantProducts.getAll) as Product[] | undefined;

  // Build product lookup map
  const productMap = useMemo(() => {
    const map: Record<string, Product> = {};
    for (const p of products ?? []) map[p._id] = p;
    return map;
  }, [products]);

  // Enrich raw skus with product name/store/currency
  const orders: Order[] | undefined = useMemo(() => {
    if (!rawSkus) return undefined;
    return rawSkus.map((sku) => {
      const p = productMap[sku.productId];
      return {
        ...sku,
        productName: p?.productName ?? 'Unknown Product',
        storeName:   p?.storeName   ?? '',
        currency:    p?.currency    ?? 'USD',
      };
    });
  }, [rawSkus, productMap]);

  const totalOrders  = orders?.length ?? 0;
  const totalSpent   = orders
    ?.filter((o) => getEffectiveStatus(o.status, o.expiresAt) === 'completed')
    .reduce((sum, o) => sum + o.price, 0) ?? 0;
  const activeQuotes = orders?.filter((o) => getEffectiveStatus(o.status, o.expiresAt) === 'active').length ?? 0;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <NavSidebar />

      <div style={{ flex: 1, minWidth: 0, background: '#FFFFFF' }}>
        {/* Header */}
        <header style={{ padding: '32px 24px 24px', maxWidth: 800, margin: '0 auto' }}>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: 600,
              color: TEXT_PRIMARY,
              letterSpacing: '-0.02em',
              margin: 0,
              marginBottom: 6,
            }}
          >
            Order History
          </h1>
          <p style={{ fontSize: '15px', color: TEXT_SECONDARY, margin: 0 }}>
            Your past quotes and purchases
          </p>
        </header>

        {/* Main content */}
        <main style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 48px' }}>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            <StatCard label="Total Orders" value={String(totalOrders)} />
            <StatCard
              label="Total Spent"
              value={`$${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
            />
            <StatCard label="Active Quotes" value={String(activeQuotes)} />
          </div>

          {/* Order list or empty state */}
          {orders === undefined ? (
            /* Loading */
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ fontSize: '15px', color: TEXT_SECONDARY }}>Loading…</div>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {orders.map((order) => (
                <OrderCard key={order._id} order={order} />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
