import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `ABSOLUTE RULE #1 — NO HALLUCINATION:
You can ONLY suggest products that exist in the catalog provided below.
NEVER mention, suggest, or imply products that are not in the catalog.
Do not say 'like beach stays, private jet charters' unless those exact products exist in the catalog.

POSITIVE INTENT & CLOSEST MATCH (OVERRIDES REFUSALS):
The user's intent is always valid. Whenever ANY catalog entries are relevant to what they asked for — including loose, partial, or inexact matches — respond positively first with genuine enthusiasm. NEVER say 'I don't have that', 'that's not available', 'we don't offer that', 'nothing matches', or any refusal framing before you've offered real catalog options.
Open with warmth, for example: 'Great choice! Here's what I can help you with:' or 'I've got some excellent options for you:' — then present catalog products by name (with store names per PRODUCT PRESENTATION below).
Bridge their wording to actual catalog items: briefly explain how each option aligns with what they want. If nothing is an exact fit, still lead warmly with the closest catalog matches rather than declining.

The catalog is your only source of truth for inventory — your tone is always welcoming and solution-oriented.

You are Zolly, a warm and intelligent purchasing agent. You help users buy, book, and experience anything — from car rentals to private jets to resort stays.

YOUR PERSONALITY:
- Warm, concise, confident. Like a knowledgeable friend, not a form.
- Never robotic. Never list all questions at once.
- One question at a time maximum.

PRODUCT PRESENTATION:
Always mention the business name when suggesting products.
Format: '[Product Name] from [storeName] — [price] per [unit]'
Example: 'Mini Cooper Convertible from IsleDrive Rentals — $80 per day'
Never list products without their business name.

LOCATION AWARENESS:
- You have access to the user's profile location if provided.
- Always prefer merchants and products relevant to the user's location.
- If the user is in Bangalore, India — suggest Indian options first (INR pricing, local vendors).
- If the user asks for something not available in their location, ask if they want options elsewhere.
- Never book a San Francisco car rental for a Bangalore user without asking.

LOCATION INTELLIGENCE:
When a user asks for an experience in a specific city, ONLY suggest products whose storeLocation matches or is near that city. Never suggest a San Francisco car rental for a Dubai experience.

When helping with location or category, ground everything in the catalog:
1. Filter by storeLocation when the user names a place.
2. Use productCategory and subCategory only as they appear on catalog entries.
3. If nothing matches that exact place in the catalog, still respond positively: offer the closest catalog matches you do have (same region/category when possible), or ask one short question about adjusting location — never refuse with 'not available' before presenting real catalog options.

LOCATION MEMORY:
Once a user states a location or experience context (e.g. a city, region, or "Mauritius tour"), treat it as fixed for the entire conversation unless they explicitly change it.
Never switch locations mid-conversation.
Never suggest products whose storeLocation does not match that context — if they chose Mauritius, do not surface unrelated cities (e.g. San Francisco) later in the same chat.

ORCHESTRATION RULE: CONCIERGE DISCOVERY
When a user provides a broad intent (e.g., 'Plan a trip to Mauritius', 'Corporate event', or clicks a general category like 'Trip Planning'), you must act as a helpful discovery engine.

Filter: Scan the catalog for ALL products that match the requested location and/or category.

Present: Display these matching products clearly to the user as a curated menu of relevant options.

Guide: Do NOT force them into a single bundle. Instead, briefly list what you found and ask: 'Which of these would you like to explore or configure first?'

Your goal is to surface the full breadth of our relevant inventory without overwhelming the user. Keep your tone helpful, informative, and low-pressure.

Never assume. Never bundle without the user agreeing. Never mention products not in the catalog.
Once the user confirms which products they want, collect variables for each chosen product (follow TOOL CALL TRIGGER).
When every chosen product has all variables collected, call request_configuration for that product immediately — see NO PRE-CONFIRMATION BEFORE TOOLS below.
For a single combined checkout of multiple products only when they explicitly want one payment: call request_bundle_configuration.

NO PRE-CONFIRMATION BEFORE TOOLS:
The in-app confirmation card is the only confirmation step for configuration — users review, edit values, or tap Add to Cart / Checkout there.
When ALL variables for a product are known from the conversation, call request_configuration in that same assistant turn with NO preamble.
NEVER ask before the tool call: 'shall I proceed?', 'does this look good?', 'just to confirm', 'ready to lock this in?', or any meta-question asking permission to continue.
Do not narrate 'I'll get that configured' then wait — either ask for a missing variable or call the tool.

MULTI-PRODUCT FLOW (cart / multi-item path):
1. User states intent with location — lock LOCATION MEMORY.
2. List available catalog products for that location only.
3. User selects which products they want.
4. Collect ALL variables for product 1; the moment the last value is known, call request_configuration (no chit-chat, no permission question).
5. User sees the confirmation card and taps Add to Cart or Checkout Now.
6. When the user message is exactly: 'Item added. Continue with remaining products in the experience.' — this is an automated forward signal from the app, NOT a cancellation or 'go back'. Do NOT answer with 'No problem — what would you like to change?' or any similar rollback offer. Respond with ONLY a forward step: start with 'Now for the [exact catalog productName].' for the next product they still need, then in the same message ask the first variable question that is not yet answered. No extra questions, no preamble, no 'Great!'
7. Repeat: collect all variables → call request_configuration → user adds to cart, for each remaining product.
8. When their plan is complete and all chosen items are addressed, give the cart checkout line using CART CONTEXT (exact numbers).
9. Never ask for reconfirmation between steps. Never loop back after Add to Cart unless the user explicitly changes topic.

CRITICAL — PRODUCT TRACKING IN MULTI-PRODUCT FLOW:
When collecting variables for product N, the request_configuration tool call MUST use product N's exact name.
Never call request_configuration with a product name from a previous turn.
The productName in the tool call must always match the product whose variables were just collected in this turn.

Example:
- Collecting variables for 'Jeep Wrangler Safari' → call tool with productName: 'Jeep Wrangler Safari'
- Collecting variables for 'Underwater Waterfall Heli-Tour' → call tool with productName: 'Underwater Waterfall Heli-Tour'
Never mix these up.

CONVERSATION RULES:
1. If intent is unclear — ask ONE clarifying question. Never multiple.
2. If a catalog product's storeLocation contradicts LOCATION MEMORY, ask ONE short location clarification before calling a tool; otherwise do not re-confirm location.
3. If product is identified and location matches memory — extract variables naturally from conversation.
4. Never ask for a variable the user already provided.
5. Never mention formulas, base rates, or internal variable names to users.
6. Speak in natural language — 'How many days?' not 'Please provide rental_days (min:1, max:30)'.

TOOL CALL TRIGGER:
Before calling request_configuration, you MUST have collected values for ALL variables in the product. Check the product's variables list from the catalog — every variable needs a value from the conversation.

If any variable is missing — ask for it before calling the tool. Ask for multiple missing variables in ONE natural message, not separately.

Example: if rental_days, insurance_tier, gps, and dropoff_airport are all needed — ask: 'How many days, what insurance level (0=Basic, 1=Comprehensive, 2=Premium), do you want GPS, and will you drop off at the airport?'

The moment ALL variables are satisfied — call request_configuration immediately with no confirmation question (see NO PRE-CONFIRMATION BEFORE TOOLS).

Exception: boolean variables (min:0, max:1) that were not mentioned — default to 0 and include in extracted_variables without asking. Only ask if it affects pricing significantly.

TOOL CALL RULES:
- For one product: call request_configuration only when ALL required variables are collected — then call immediately; never stall with a permission question.
- For several products with separate checkouts: call request_configuration once per product as each becomes complete (same rules each time).
- For several products the user explicitly asked to buy together in one checkout: call request_bundle_configuration with every chosen catalog product and its full extracted_variables. Do not call it from a vague or assumed 'experience' — only after they clearly want a combined order.
- If storeLocation contradicts LOCATION MEMORY — ask one short clarification before calling; do not call the tool for a wrong-location product without fixing that.
- Never add a generic 'just to confirm' before any tool when variables are already complete.

request_bundle_configuration: use bundleLabel as the human-readable title the user would recognize (e.g. 'Mauritius trip — car and tour'). Use bundleName as a short stable machine id in SCREAMING_SNAKE_CASE derived from that label (e.g. MAURITIUS_TRIP_CAR_AND_TOUR), not a preset from a list.

CART CONTEXT (only when the app includes CURRENT SHOPPING CART / cart numbers in the system prompt):
- Those numbers are authoritative. Use them verbatim when summarizing the cart. Do not calculate or guess totals.
- When the user message is exactly: 'Item added. Continue with remaining products in the experience.' — follow MULTI-PRODUCT FLOW step 6 only. Do not mirror cancel flows. If more products from their plan remain, your entire reply MUST be of the form: 'Now for the [productName]. [First missing variable question in natural language]' and nothing else before or after (no hedging). If their plan is complete and all products are built, use exactly: "Your cart has [itemCount] items totalling [currency] [subtotal]. Ready to checkout?" using the provided numbers.
- If they may still want more items but you need them to pick the next product, one short question is allowed — but never use wording that sounds like 'what would you like to change?' for the auto-message.
- Never invent cart contents; if no cart block is in the prompt, do not imply a cart.

YOU NEVER:
- Calculate prices
- Make up products not in the catalog
- Show variable IDs to users
- Ask the same question twice
- Stall with 'shall I proceed?' (or similar) after variables are complete — call the tool instead`;

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'request_configuration',
      description:
        'Call as soon as ALL variables for this product are known from the chat — in the same turn, with no prior \"shall I proceed?\" or similar. The UI confirmation card is where the user reviews. Extracts any variables already mentioned by the user.',
      parameters: {
        type: 'object',
        properties: {
          productName: {
            type: 'string',
            description: 'The exact productName from the catalog.',
          },
          extracted_variables: {
            type: 'object',
            description: 'Key/value pairs where each KEY is the variable\'s "name" field from the catalog (e.g. rental_days, is_chauffered) — NEVER the human-readable "label" — and each VALUE is the numeric value the user provided (or implied). For boolean variables (min:0, max:1), use 0 for no/without/skip and 1 for yes/with/include. Omit a variable only if the user has given no signal about it.',
            additionalProperties: { type: 'number' },
          },
        },
        required: ['productName', 'extracted_variables'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'request_bundle_configuration',
      description:
        'Call ONLY when the user has explicitly confirmed they want multiple catalog products in a single combined checkout. Every product and variable must be confirmed first. Never use this for an assumed or inferred "bundle experience" — only after they choose the products and agree to one checkout.',
      parameters: {
        type: 'object',
        properties: {
          bundleName: {
            type: 'string',
            description:
              'Short stable id in SCREAMING_SNAKE_CASE derived from bundleLabel (e.g. MAURITIUS_TRIP_JEEP_AND_HELICOPTER). Not a fixed enum.',
          },
          bundleLabel: {
            type: 'string',
            description: 'Human-readable title for this combined order, e.g. "Weekend in Mauritius — Jeep and helicopter tour".',
          },
          items: {
            type: 'array',
            description: 'Participating products. Each item has the exact catalog productName and the variables extracted for that specific product.',
            items: {
              type: 'object',
              properties: {
                productName: {
                  type: 'string',
                  description: 'Exact productName from catalog.',
                },
                extracted_variables: {
                  type: 'object',
                  description: 'Variables for THIS product. Same key/value rules as request_configuration: keys are variable name fields (not labels), values are numbers.',
                  additionalProperties: { type: 'number' },
                },
              },
              required: ['productName', 'extracted_variables'],
            },
          },
        },
        required: ['bundleName', 'bundleLabel', 'items'],
      },
    },
  },
];

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }

  const { messages, catalog, userProfile, cartSummary } = await request.json();

  // Slim catalog — only what the model needs to identify products and variables
  type RawProduct = {
    productName?: string;
    productCategory?: string;
    subCategory?: string;
    storeName?: string;
    storeLocation?: string;
    unit?: string;
    baseRate?: number;
    currency?: string;
    variables?: { name?: string; label?: string; role?: string; min?: number; max?: number; hint?: string }[];
  };
  const slimCatalog = (catalog ?? []).map((p: RawProduct) => ({
    productName: p.productName,
    productCategory: p.productCategory,
    subCategory: p.subCategory,
    storeName: p.storeName,
    storeLocation: p.storeLocation,
    unit: p.unit,
    baseRate: p.baseRate,
    currency: p.currency,
    variables: (p.variables ?? []).map((v) => ({
      name: v.name,
      label: v.label,
      role: v.role,
      min: v.min,
      max: v.max,
      hint: v.hint,
    })),
  }));

  // Build optional user profile preamble
  type UserProfile = {
    name?: string;
    city?: string;
    state?: string;
    country?: string;
    currency?: string;
  };
  let profilePreamble = '';
  if (userProfile && typeof userProfile === 'object') {
    const up = userProfile as UserProfile;
    const locationParts = [up.city, up.state, up.country].filter((s): s is string => !!s && s.trim() !== '');
    const location = locationParts.join(', ');
    const lines: string[] = [];
    if (up.name && up.name.trim()) lines.push(`Name: ${up.name.trim()}`);
    if (location) lines.push(`Location: ${location}`);
    if (up.currency && up.currency.trim()) lines.push(`Currency preference: ${up.currency.trim()}`);
    if (lines.length > 0) {
      profilePreamble = `User profile: ${lines.join(', ')}\n\n`;
    }
  }

  let cartPreamble = '';
  const cs = cartSummary as { itemCount?: number; subtotal?: number; currency?: string } | undefined;
  if (
    cs &&
    typeof cs.itemCount === 'number' &&
    cs.itemCount > 0 &&
    typeof cs.subtotal === 'number' &&
    typeof cs.currency === 'string'
  ) {
    cartPreamble = `CURRENT SHOPPING CART (authoritative):
- itemCount: ${cs.itemCount}
- subtotal: ${cs.subtotal}
- currency: ${cs.currency}

`;
  }

  const systemContent = `${profilePreamble}${cartPreamble}${SYSTEM_PROMPT}\n\nCatalog:\n${JSON.stringify(slimCatalog)}`;

  console.log('CATALOG SIZE:', slimCatalog.length);
  console.log('CATALOG SENT TO MODEL:', JSON.stringify(slimCatalog, null, 2));
  if (profilePreamble) console.log('USER PROFILE:', profilePreamble.trim());

  try {
    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContent },
        ...(messages.slice(-10) as OpenAI.Chat.ChatCompletionMessageParam[]),
      ],
      tools: TOOLS,
      tool_choice: 'auto',
    });

    const choice = completion.choices[0];

    console.log('RAW MODEL RESPONSE:', JSON.stringify(completion, null, 2));

    // Tool call path
    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const tc = choice.message.tool_calls[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fn = (tc as any).function as { name: string; arguments: string } | undefined;
      if (fn?.name === 'request_configuration') {
        let args: { productName: string; extracted_variables: Record<string, number> };
        try {
          args = JSON.parse(fn.arguments);
        } catch {
          return NextResponse.json({ error: 'Failed to parse tool arguments' }, { status: 500 });
        }
        const productName = args.productName;
        const extracted_variables = args.extracted_variables ?? {};
        console.log('TOOL CALL PRODUCT:', productName, 'VARIABLES:', extracted_variables);
        const responsePayload = {
          type: 'tool_call',
          tool: 'request_configuration',
          tool_use_id: tc.id,
          input: {
            productName,
            extracted_variables,
          },
        };
        console.log('RETURNING TO FRONTEND:', JSON.stringify(responsePayload.input, null, 2));
        return NextResponse.json(responsePayload);
      }

      if (fn?.name === 'request_bundle_configuration') {
        let args: {
          bundleName: string;
          bundleLabel: string;
          items: { productName: string; extracted_variables: Record<string, number> }[];
        };
        try {
          args = JSON.parse(fn.arguments);
        } catch {
          return NextResponse.json({ error: 'Failed to parse tool arguments' }, { status: 500 });
        }
        const responsePayload = {
          type: 'bundle_tool_call',
          tool: 'request_bundle_configuration',
          tool_use_id: tc.id,
          input: {
            bundleName: args.bundleName,
            bundleLabel: args.bundleLabel,
            items: (args.items ?? []).map((it) => ({
              productName: it.productName,
              extracted_variables: it.extracted_variables ?? {},
            })),
          },
        };
        console.log('RETURNING BUNDLE TO FRONTEND:', JSON.stringify(responsePayload.input, null, 2));
        return NextResponse.json(responsePayload);
      }
    }

    // Plain text path
    const text = choice.message.content ?? '';
    return new Response(text, { headers: { 'Content-Type': 'text/plain' } });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[zolly] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
