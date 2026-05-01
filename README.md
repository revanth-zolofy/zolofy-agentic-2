# Zolofy — Agentic Commerce Interface

> **UCP v2026-04-08 compliant** · Built with Next.js · Powered by Convex

Zolofy turns natural-language buyer intent into deterministic CPQ pricing and signed, time-bound checkout mandates..

---

## How it works

```
User / Agent  →  POST /api/zolly   →  Zolly (GPT-4o-mini) extracts intent & variables
                                   ↘  returns tool_call { productName, extracted_variables }

Agent         →  POST /api/mandate →  formula evaluated, ephemeral SKU minted in Convex
                                   ↘  returns RS256-signed AP2 mandate (15 min TTL)

Agent         →  GET /.well-known/ucp  →  capability discovery (no SDK required)
```

Zolly never calculates prices and never invents inventory. It extracts variables from natural language and hands them to the mandate endpoint, which evaluates a merchant-defined CPQ formula against a live catalog.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | Convex (real-time, serverless) |
| AI agent | OpenAI `gpt-4o-mini` via `/api/zolly` |
| Mandate signing | RS256 JWT via `jose` |
| Formula engine | `expr-eval` (safe, sandboxed math) |
| Styling | Inline design tokens + Tailwind 4 |

---

## Pages

| Route | Description |
|---|---|
| `/` | Main shopping interface — chat with Zolly |
| `/orders` | Order history & mandate status |
| `/profile` | Identity, address, payment methods |
| `/merchant-lab` | Add products with CPQ formula (admin) |
| `/dev` | API documentation for agents & developers |
| `/.well-known/ucp` | UCP capability profile (JSON) |

---

## Self-hosting

### Prerequisites

- Node.js 20+
- A [Convex](https://convex.dev) account (free tier works)
- An OpenAI API key
- An RSA-2048 key pair for mandate signing

### 1. Clone and install

```bash
git clone https://github.com/zolofy/zolofy-agentic.git
cd zolofy-agentic
npm install
```

### 2. Set up Convex

```bash
npx convex dev
```

This will prompt you to log in and create a project, then write `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` into `.env.local`.

### 3. Generate a merchant signing key

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 \
  | openssl pkcs8 -topk8 -nocrypt -outform PEM
```

Copy the full PEM output (including `-----BEGIN PRIVATE KEY-----` headers) into `.env.local` as `MERCHANT_PRIVATE_KEY`.

### 4. Configure environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

### 5. Seed the catalog

```bash
curl http://localhost:3000/api/seed
```

### 6. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## API

### `POST /api/zolly`

Natural language → structured variables. Pass the full conversation history and the product catalog.

```bash
curl -X POST https://zolofy.co/api/zolly \
  -H 'Content-Type: application/json' \
  -d '{
    "messages": [{"role":"user","content":"I need a Range Rover for 3 days with a driver"}],
    "catalog": "auto"
  }'
```

Returns either a `tool_call` (variables extracted) or plain text (clarification needed).

### `POST /api/mandate`

Variables → price-locked, merchant-signed AP2 mandate valid for 15 minutes.

```bash
curl -X POST https://zolofy.co/api/mandate \
  -H 'Content-Type: application/json' \
  -d '{
    "productId": "kg2abc123",
    "variables": {"rental_days": 3, "is_chauffered": 1}
  }'
```

### `GET /.well-known/ucp`

UCP capability discovery. Any UCP-aware agent can call this at runtime to find available endpoints.

Full API reference: [zolofy.co/dev](https://zolofy.co/dev)

---

## UCP compliance

Zolofy implements [Universal Commerce Protocol](https://ucp.dev) v2026-04-08, capability `dev.ucp.shopping.checkout`.

- **AP2 mandates** — every purchase intent is expressed as a signed, time-bounded object
- **No price invention** — Zolly is strictly prohibited from quoting prices; the formula endpoint owns all arithmetic
- **Capability discovery** — agents find endpoints via `/.well-known/ucp` without prior configuration
- **15-minute TTL** — mandates expire automatically, preventing stale commitments in autonomous pipelines

---

## Adding products

Open `/merchant-lab` and fill in the product form. The CPQ formula field accepts any arithmetic expression over your declared variables, e.g.:

```
baseRate * rental_days * (1 + chauffeur_surcharge * is_chauffered)
```

Variables are declared with a name, role (`time` / `quantity` / `dimension`), min/max bounds, and a hint for Zolly to surface in conversation.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

ISC
