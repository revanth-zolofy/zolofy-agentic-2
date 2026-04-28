'use client';

import { useState, FormEvent, useRef, ChangeEvent, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type VariableRow = {
  name: string;
  label: string;
  role: string;
  min: string;
  max: string;
  hint: string;
};

type ConstantRow = {
  key: string;
  value: string;
};

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
  variables: { name: string; label: string; role: string; min: number; max: number; hint: string }[];
  constants: Record<string, number>;
  imageUrl: string;
  developerNote: string;
};

/* ------------------------------------------------------------------ */
/*  Design tokens                                                     */
/* ------------------------------------------------------------------ */

const COLORS = {
  bg: '#F2F2F7',
  card: '#FFFFFF',
  accent: '#5C4EFF',
  accentEnd: '#00D4FF',
  error: '#FF3B30',
  text: '#0A0A0A',
  secondary: '#6C6C70',
  separator: '#E5E5EA',
  fieldBg: '#F4F4F5',
};

const CATALOG_GRADIENT = 'linear-gradient(180deg, #F2F2F7 0%, #E8EEFB 100%)';
const WORDMARK_GRADIENT = `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.accentEnd})`;

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  Automotive:  { bg: '#EFF6FF', text: '#1D4ED8' },
  Travel:      { bg: '#F0FDF4', text: '#166534' },
  Catering:    { bg: '#FFF7ED', text: '#9A3412' },
  Events:      { bg: '#FAF5FF', text: '#6B21A8' },
  Printing:    { bg: '#FFF1F2', text: '#9F1239' },
  Interiors:   { bg: '#F0FDFA', text: '#115E59' },
  Photography: { bg: '#FFFBEB', text: '#92400E' },
  Fitness:     { bg: '#F0FDF4', text: '#14532D' },
  Legal:       { bg: '#F5F3FF', text: '#4C1D95' },
  Renovation:  { bg: '#FEF3C7', text: '#78350F' },
};

function categoryPalette(category: string) {
  return CATEGORY_COLORS[category] ?? { bg: COLORS.bg, text: COLORS.secondary };
}

const CATEGORIES = [
  'Automotive', 'Travel', 'Catering', 'Events', 'Printing',
  'Interiors', 'Photography', 'Fitness', 'Legal', 'Renovation',
];

const ROLES = ['time', 'quantity', 'dimension'];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const fieldStyle: React.CSSProperties = {
  width: '100%',
  height: 44,
  padding: '0 14px',
  fontSize: '15px',
  background: COLORS.fieldBg,
  border: 'none',
  borderRadius: 10,
  color: COLORS.text,
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: COLORS.secondary,
  marginBottom: 5,
  display: 'block',
};

function SectionHeader({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div
      style={{
        fontSize: '15px',
        fontWeight: 600,
        color: COLORS.text,
        letterSpacing: '-0.01em',
        marginBottom: 14,
        marginTop: first ? 0 : 0,
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 34,
        padding: '0 14px',
        fontSize: '13px',
        fontWeight: 500,
        borderRadius: 8,
        background: COLORS.bg,
        color: COLORS.accent,
        border: `1px solid ${COLORS.separator}`,
        cursor: 'pointer',
      }}
    >
      + {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 32,
        minWidth: 32,
        padding: '0 8px',
        fontSize: '16px',
        lineHeight: 1,
        borderRadius: 8,
        background: 'transparent',
        color: COLORS.error,
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-label="Remove"
    >
      ×
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function MerchantLab() {
  const products = useQuery(api.merchantProducts.getAll) as Product[] | undefined;
  const createProduct = useMutation(api.merchantProducts.create);
  const updateProduct = useMutation(api.merchantProducts.update);
  const deleteProduct = useMutation(api.merchantProducts.remove);

  /* ── auth gate ── */
  // null = not yet checked (waiting for client mount), false = not authed, true = authed
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);

  useEffect(() => {
    setAuthed(localStorage.getItem('zolofy_admin') === 'true');
  }, []);

  const [editingId, setEditingId] = useState<Id<'merchantProducts'> | null>(null);
  const formTopRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── form state ── */
  const [storeName, setStoreName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState(CATEGORIES[0]);
  const [unit, setUnit] = useState('');
  const [baseRate, setBaseRate] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [formula, setFormula] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [developerNote, setDeveloperNote] = useState('');

  const [variables, setVariables] = useState<VariableRow[]>([
    { name: '', label: '', role: ROLES[0], min: '', max: '', hint: '' },
  ]);
  const [constants, setConstants] = useState<ConstantRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── image upload ── */
  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  /* ── variable row handlers ── */
  function addVariable() {
    setVariables((prev) => [...prev, { name: '', label: '', role: ROLES[0], min: '', max: '', hint: '' }]);
  }
  function removeVariable(i: number) {
    setVariables((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateVariable(i: number, field: keyof VariableRow, val: string) {
    setVariables((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: val } : row))
    );
  }

  /* ── constant row handlers ── */
  function addConstant() {
    setConstants((prev) => [...prev, { key: '', value: '' }]);
  }
  function removeConstant(i: number) {
    setConstants((prev) => prev.filter((_, idx) => idx !== i));
  }
  function updateConstant(i: number, field: 'key' | 'value', val: string) {
    setConstants((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [field]: val } : row))
    );
  }

  /* ── load product into form for editing ── */
  function loadProductForEdit(product: Product) {
    setEditingId(product._id);
    setStoreName(product.storeName);
    setStoreLocation(product.storeLocation);
    setProductName(product.productName);
    setProductCategory(product.productCategory);
    setUnit(product.unit);
    setBaseRate(String(product.baseRate));
    setCurrency(product.currency);
    setFormula(product.formula);
    setImageUrl(product.imageUrl ?? '');
    setDeveloperNote(product.developerNote ?? '');
    setVariables(
      product.variables.length > 0
        ? product.variables.map((v) => ({
            name: v.name,
            label: v.label ?? '',
            role: v.role,
            min: String(v.min),
            max: String(v.max),
            hint: v.hint,
          }))
        : [{ name: '', label: '', role: ROLES[0], min: '', max: '', hint: '' }]
    );
    setConstants(
      Object.entries(product.constants ?? {}).map(([key, value]) => ({
        key,
        value: String(value),
      }))
    );
    setError(null);
    setSuccess(false);
    formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    setEditingId(null);
    setStoreName('');
    setStoreLocation('');
    setProductName('');
    setProductCategory(CATEGORIES[0]);
    setUnit('');
    setBaseRate('');
    setCurrency('USD');
    setFormula('');
    setImageUrl('');
    setDeveloperNote('');
    setVariables([{ name: '', label: '', role: ROLES[0], min: '', max: '', hint: '' }]);
    setConstants([]);
    setError(null);
    setSuccess(false);
  }

  /* ── password gate ── */
  function handlePwSubmit(e: FormEvent) {
    e.preventDefault();
    if (pwInput === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      localStorage.setItem('zolofy_admin', 'true');
      setAuthed(true);
    } else {
      setPwError(true);
      setPwInput('');
    }
  }

  /* ── delete ── */
  async function handleDelete(product: Product) {
    if (!window.confirm(`Are you sure you want to delete "${product.productName}"?`)) return;
    try {
      await deleteProduct({ id: product._id });
      if (editingId === product._id) cancelEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  /* ── submit ── */
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const rate = Number(baseRate);
    if (!storeName.trim()) return setError('Business name is required.');
    if (!productName.trim()) return setError('Product name is required.');
    if (!unit.trim()) return setError('Unit is required.');
    if (!Number.isFinite(rate) || rate <= 0) return setError('Base rate must be a positive number.');
    if (!formula.trim()) return setError('Formula is required.');

    for (const v of variables) {
      if (!v.name.trim()) return setError('Each variable must have a name.');
      const mn = Number(v.min), mx = Number(v.max);
      if (!Number.isFinite(mn)) return setError(`Variable "${v.name}": min must be a number.`);
      if (!Number.isFinite(mx)) return setError(`Variable "${v.name}": max must be a number.`);
    }

    const constantsObj: Record<string, number> = {};
    for (const c of constants) {
      if (!c.key.trim()) return setError('Each constant must have a key.');
      const val = Number(c.value);
      if (!Number.isFinite(val)) return setError(`Constant "${c.key}": value must be a number.`);
      constantsObj[c.key.trim()] = val;
    }

    const payload = {
      storeName: storeName.trim(),
      storeLocation: storeLocation.trim(),
      productName: productName.trim(),
      productCategory,
      unit: unit.trim(),
      baseRate: rate,
      currency: currency.trim() || 'USD',
      formula: formula.trim(),
      variables: variables.map((v) => ({
        name: v.name.trim(),
        label: v.label.trim(),
        role: v.role,
        min: Number(v.min),
        max: Number(v.max),
        hint: v.hint.trim(),
      })),
      constants: constantsObj,
      imageUrl: imageUrl,
      developerNote: developerNote.trim(),
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateProduct({ id: editingId, ...payload });
        setEditingId(null);
      } else {
        await createProduct(payload);
      }

      /* reset form */
      setStoreName('');
      setStoreLocation('');
      setProductName('');
      setProductCategory(CATEGORIES[0]);
      setUnit('');
      setBaseRate('');
      setCurrency('USD');
      setFormula('');
      setImageUrl('');
      setDeveloperNote('');
      setVariables([{ name: '', label: '', role: ROLES[0], min: '', max: '', hint: '' }]);
      setConstants([]);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  /* ── render gate if not authenticated ── */
  if (authed === null) return null; // waiting for localStorage (avoids SSR flash)

  if (!authed) return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: COLORS.bg,
        padding: '0 20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 360,
          background: COLORS.card,
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
        }}
      >
        {/* Wordmark */}
        <div style={{ marginBottom: 28, textAlign: 'center' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: COLORS.accent, letterSpacing: '-0.01em' }}>
            Zolofy
          </div>
          <div
            style={{
              fontSize: '13px',
              marginTop: 3,
              fontWeight: 500,
              background: WORDMARK_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'inline-block',
            }}
          >
            Merchant Lab
          </div>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: '14px', color: COLORS.secondary, textAlign: 'center', lineHeight: 1.5 }}>
          Enter the admin password to manage your catalog.
        </p>

        <form onSubmit={handlePwSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            type="password"
            value={pwInput}
            onChange={(e) => { setPwInput(e.target.value); setPwError(false); }}
            placeholder="Password"
            autoFocus
            style={{
              ...fieldStyle,
              boxShadow: pwError ? `0 0 0 2px ${COLORS.error}` : 'none',
            }}
          />
          {pwError && (
            <div style={{ fontSize: '13px', color: COLORS.error, paddingLeft: 2 }}>
              Incorrect password — try again.
            </div>
          )}
          <button
            type="submit"
            disabled={!pwInput.trim()}
            style={{
              marginTop: 4,
              height: 48,
              fontSize: '15px',
              fontWeight: 600,
              borderRadius: 12,
              background: pwInput.trim() ? COLORS.accent : COLORS.separator,
              color: pwInput.trim() ? '#FFFFFF' : COLORS.secondary,
              border: 'none',
              cursor: pwInput.trim() ? 'pointer' : 'default',
              letterSpacing: '-0.01em',
              transition: 'background 150ms ease-out, color 150ms ease-out',
            }}
          >
            Enter
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bg }}>
      {/* Header */}
      <header
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${COLORS.separator}`, background: COLORS.card }}
      >
        <div>
          <span style={{ fontSize: '18px', fontWeight: 600, color: COLORS.accent, letterSpacing: '-0.01em' }}>Zolofy</span>
          <div
            style={{
              fontSize: '13px',
              marginTop: 2,
              background: WORDMARK_GRADIENT,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'inline-block',
              fontWeight: 500,
            }}
          >
            Merchant Lab
          </div>
        </div>
        <Link
          href="/"
          style={{
            fontSize: '15px',
            fontWeight: 500,
            color: COLORS.accent,
            textDecoration: 'none',
          }}
        >
          ← Vibe Shopping
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div
          style={{
            maxWidth: 900,
            margin: '0 auto',
            padding: '32px 20px',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 32,
            alignItems: 'start',
          }}
        >
          {/* ── Left: Form ── */}
          <div ref={formTopRef}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h1
                style={{
                  fontSize: '26px',
                  fontWeight: 600,
                  color: COLORS.text,
                  letterSpacing: '-0.02em',
                }}
              >
                {editingId ? 'Edit Product' : 'Add Product'}
              </h1>
              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{
                    height: 34,
                    padding: '0 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: 8,
                    background: COLORS.bg,
                    color: COLORS.secondary,
                    border: `1px solid ${COLORS.separator}`,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit}>

              {/* ── Business ── */}
              <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 12 }}>
                <SectionHeader first>Business</SectionHeader>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Business name">
                    <input
                      style={fieldStyle}
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      placeholder="e.g. Acme Auto"
                    />
                  </Field>
                  <Field label="Location">
                    <input
                      style={fieldStyle}
                      value={storeLocation}
                      onChange={(e) => setStoreLocation(e.target.value)}
                      placeholder="City, Country"
                    />
                  </Field>
                </div>
              </div>

              {/* ── Product ── */}
              <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 12 }}>
                <SectionHeader first>Product</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

                  {/* Product name — full width */}
                  <Field label="Product name">
                    <input
                      style={fieldStyle}
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      placeholder="e.g. Car Rental"
                    />
                  </Field>

                  {/* Category + Unit */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <Field label="Category">
                      <select
                        style={{ ...fieldStyle, cursor: 'pointer' }}
                        value={productCategory}
                        onChange={(e) => setProductCategory(e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Unit">
                      <input
                        style={fieldStyle}
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="e.g. per day"
                      />
                    </Field>
                  </div>

                  {/* Base rate + Currency */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                    <Field label="Base rate">
                      <input
                        style={fieldStyle}
                        type="number"
                        min={0}
                        step="any"
                        value={baseRate}
                        onChange={(e) => setBaseRate(e.target.value)}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Currency">
                      <input
                        style={fieldStyle}
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        placeholder="USD"
                        maxLength={8}
                      />
                    </Field>
                  </div>

                  {/* Formula — full width, monospace */}
                  <Field label="Formula">
                    <input
                      style={{ ...fieldStyle, fontFamily: 'monospace', background: '#F4F4F5' }}
                      value={formula}
                      onChange={(e) => setFormula(e.target.value)}
                      placeholder="e.g. baseRate * days"
                    />
                  </Field>

                  {/* Image upload */}
                  <Field label="Product image (optional)">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt="Preview"
                          style={{
                            width: 80,
                            height: 80,
                            borderRadius: 8,
                            objectFit: 'cover',
                            flexShrink: 0,
                            border: `1px solid ${COLORS.separator}`,
                          }}
                        />
                      )}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                        style={{
                          flex: 1,
                          height: 44,
                          border: `1px dashed ${COLORS.separator}`,
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          fontSize: '13px',
                          color: COLORS.secondary,
                          userSelect: 'none',
                        }}
                      >
                        {imageUrl ? 'Change image' : 'Click to upload image'}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleImageChange}
                      />
                    </div>
                  </Field>

                  {/* Developer note */}
                  <Field label="Developer note (optional)">
                    <input
                      style={fieldStyle}
                      value={developerNote}
                      onChange={(e) => setDeveloperNote(e.target.value)}
                      placeholder="Internal notes"
                    />
                  </Field>
                </div>
              </div>

              {/* ── Variables ── */}
              <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 12 }}>
                <SectionHeader first>Variables</SectionHeader>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {variables.map((v, i) => (
                    <div
                      key={i}
                      style={{
                        background: COLORS.bg,
                        borderRadius: 12,
                        padding: 12,
                      }}
                    >
                      {/* Row 1: name (ID) + label (display name) */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: 8,
                          marginBottom: 8,
                          alignItems: 'end',
                        }}
                      >
                        <div>
                          <label style={labelStyle}>
                            Name{' '}
                            <span style={{ fontSize: '11px', color: COLORS.secondary, fontWeight: 400 }}>
                              ID (used in formula)
                            </span>
                          </label>
                          <input
                            style={{ ...fieldStyle, height: 38, background: COLORS.card }}
                            value={v.name}
                            onChange={(e) => updateVariable(i, 'name', e.target.value)}
                            placeholder="e.g. days"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Label (shown to user)</label>
                          <input
                            style={{ ...fieldStyle, height: 38, background: COLORS.card }}
                            value={v.label}
                            onChange={(e) => updateVariable(i, 'label', e.target.value)}
                            placeholder="e.g. Number of days"
                          />
                        </div>
                      </div>

                      {/* Row 2: role + remove */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto',
                          gap: 8,
                          marginBottom: 8,
                          alignItems: 'end',
                        }}
                      >
                        <div>
                          <label style={labelStyle}>Role</label>
                          <select
                            style={{ ...fieldStyle, height: 38, background: COLORS.card, cursor: 'pointer' }}
                            value={v.role}
                            onChange={(e) => updateVariable(i, 'role', e.target.value)}
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                        </div>
                        <div style={{ paddingBottom: 2 }}>
                          {variables.length > 1 && (
                            <RemoveButton onClick={() => removeVariable(i)} />
                          )}
                        </div>
                      </div>

                      {/* Row 2: min + max */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <div>
                          <label style={labelStyle}>Min</label>
                          <input
                            style={{ ...fieldStyle, height: 38, background: COLORS.card }}
                            type="number"
                            step="any"
                            value={v.min}
                            onChange={(e) => updateVariable(i, 'min', e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Max</label>
                          <input
                            style={{ ...fieldStyle, height: 38, background: COLORS.card }}
                            type="number"
                            step="any"
                            value={v.max}
                            onChange={(e) => updateVariable(i, 'max', e.target.value)}
                            placeholder="100"
                          />
                        </div>
                      </div>

                      {/* Row 3: hint — full width */}
                      <div>
                        <label style={labelStyle}>Hint</label>
                        <input
                          style={{ ...fieldStyle, height: 38, background: COLORS.card }}
                          value={v.hint}
                          onChange={(e) => updateVariable(i, 'hint', e.target.value)}
                          placeholder="Helper text shown to user"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  <AddRowButton onClick={addVariable} label="Add variable" />
                </div>
              </div>

              {/* ── Constants ── */}
              <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 20 }}>
                <SectionHeader first>Constants</SectionHeader>
                {constants.length === 0 ? (
                  <div style={{ fontSize: '13px', color: COLORS.secondary, marginBottom: 10 }}>
                    No constants yet. Add fixed numeric values used in the formula.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                    {constants.map((c, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr auto',
                          gap: 8,
                          alignItems: 'center',
                        }}
                      >
                        <input
                          style={fieldStyle}
                          value={c.key}
                          onChange={(e) => updateConstant(i, 'key', e.target.value)}
                          placeholder="Key"
                        />
                        <input
                          style={fieldStyle}
                          type="number"
                          step="any"
                          value={c.value}
                          onChange={(e) => updateConstant(i, 'value', e.target.value)}
                          placeholder="Value"
                        />
                        <RemoveButton onClick={() => removeConstant(i)} />
                      </div>
                    ))}
                  </div>
                )}
                <AddRowButton onClick={addConstant} label="Add constant" />
              </div>

              {/* Feedback */}
              {error && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#FFF1F2',
                    color: COLORS.error,
                    fontSize: '14px',
                  }}
                >
                  {error}
                </div>
              )}
              {success && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: '#F0FDF4',
                    color: '#166534',
                    fontSize: '14px',
                  }}
                >
                  Product added to catalog.
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: '100%',
                  height: 52,
                  fontSize: '16px',
                  fontWeight: 600,
                  borderRadius: 12,
                  background: submitting ? COLORS.separator : COLORS.accent,
                  color: submitting ? COLORS.secondary : '#FFFFFF',
                  border: 'none',
                  cursor: submitting ? 'default' : 'pointer',
                  letterSpacing: '-0.01em',
                  transition: 'opacity 120ms ease-out',
                }}
              >
                {submitting ? 'Saving…' : editingId ? 'Save Changes' : 'Add to Catalog'}
              </button>
            </form>
          </div>

          {/* ── Right: Catalog preview ── */}
          <div>
            <h2
              style={{
                fontSize: '20px',
                fontWeight: 600,
                color: COLORS.text,
                letterSpacing: '-0.01em',
                marginBottom: 20,
              }}
            >
              Catalog
              {products !== undefined && (
                <span
                  style={{
                    marginLeft: 10,
                    fontSize: '15px',
                    fontWeight: 400,
                    color: COLORS.secondary,
                  }}
                >
                  {products.length} {products.length === 1 ? 'product' : 'products'}
                </span>
              )}
            </h2>

            <div
              style={{
                background: CATALOG_GRADIENT,
                borderRadius: 18,
                padding: 20,
                minHeight: 200,
              }}
            >
              {products === undefined ? (
                <CatalogLoading />
              ) : products.length === 0 ? (
                <EmptyCatalog />
              ) : (
                <div className="flex flex-col" style={{ gap: 14 }}>
                  {products.map((p) => (
                    <LabProductCard
                      key={p._id}
                      product={p}
                      isEditing={editingId === p._id}
                      onEdit={loadProductForEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Catalog sub-components                                            */
/* ------------------------------------------------------------------ */

function CatalogLoading() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 0',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1 }} aria-hidden="true">⚡</div>
      <div style={{ fontSize: '15px', color: COLORS.secondary }}>Connecting…</div>
    </div>
  );
}

function EmptyCatalog() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 0',
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 48, lineHeight: 1 }} aria-hidden="true">⚡</div>
      <div style={{ fontSize: '15px', color: COLORS.secondary }}>
        No products yet. Add one to get started.
      </div>
    </div>
  );
}

function LabProductCard({
  product,
  isEditing,
  onEdit,
  onDelete,
}: {
  product: Product;
  isEditing: boolean;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}) {
  const palette = categoryPalette(product.productCategory);
  return (
    <div
      style={{
        background: COLORS.card,
        borderRadius: 16,
        padding: '16px 16px 14px 14px',
        borderLeft: `3px solid ${isEditing ? COLORS.accent : palette.text}`,
        outline: isEditing ? `2px solid ${COLORS.accent}` : 'none',
        outlineOffset: 0,
        transition: 'outline 150ms ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            height: 22,
            padding: '0 8px',
            borderRadius: 6,
            background: palette.bg,
            color: palette.text,
            fontSize: '12px',
            fontWeight: 500,
          }}
        >
          {product.productCategory}
        </div>

        {/* Edit + Delete button group */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onEdit(product)}
            disabled={isEditing}
            style={{
              height: 26,
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: 7,
              background: isEditing ? COLORS.bg : COLORS.accent,
              color: isEditing ? COLORS.secondary : '#FFFFFF',
              border: 'none',
              cursor: isEditing ? 'default' : 'pointer',
              transition: 'background 150ms ease',
            }}
          >
            {isEditing ? 'Editing…' : 'Edit'}
          </button>
          <button
            type="button"
            onClick={() => onDelete(product)}
            style={{
              height: 26,
              padding: '0 10px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: 7,
              background: 'transparent',
              color: COLORS.error,
              border: `1px solid ${COLORS.error}33`,
              cursor: 'pointer',
              transition: 'background 150ms ease, border-color 150ms ease',
            }}
          >
            Delete
          </button>
        </div>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: '16px',
          fontWeight: 500,
          color: COLORS.text,
          letterSpacing: '-0.01em',
        }}
      >
        {product.productName}
      </div>
      <div style={{ marginTop: 3, fontSize: '12px', color: COLORS.secondary }}>
        {product.storeName}
        {product.storeLocation ? ` · ${product.storeLocation}` : ''}
      </div>
      <div style={{ marginTop: 6, fontSize: '14px', color: COLORS.secondary }}>
        <span style={{ color: COLORS.accent, fontWeight: 600 }}>
          {product.currency} {product.baseRate.toLocaleString()}
        </span>{' '}
        · {product.unit}
      </div>
    </div>
  );
}
