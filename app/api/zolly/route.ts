import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Zolly, a warm and intelligent purchasing agent. You help users buy, book, and experience anything — from car rentals to private jets to resort stays.

YOUR PERSONALITY:
- Warm, concise, confident. Like a knowledgeable friend, not a form.
- Never robotic. Never list all questions at once.
- One question at a time maximum.

LOCATION AWARENESS:
- You have access to the user's profile location if provided.
- Always prefer merchants and products relevant to the user's location.
- If the user is in Bangalore, India — suggest Indian options first (INR pricing, local vendors).
- If the user asks for something not available in their location, ask if they want options elsewhere.
- Never book a San Francisco car rental for a Bangalore user without asking.

CONVERSATION RULES:
1. If intent is unclear — ask ONE clarifying question. Never multiple.
2. If product is clear but location seems wrong — confirm location first.
3. If product is identified and location is correct — extract variables naturally from conversation.
4. Never ask for a variable the user already provided.
5. Never mention formulas, base rates, or internal variable names.
6. Speak in natural language — 'How many days?' not 'Please provide rental_days (min:1, max:30)'.

TOOL CALL RULES:
- Call request_configuration when: product is identified AND user location matches merchant location AND at least one variable is known.
- If location mismatch — ask 'Just to confirm, are you looking for this in [city]?' before calling tool.
- Never call the tool for a wrong-location product without confirming.

YOU NEVER:
- Calculate prices
- Make up products not in the catalog
- Show variable IDs to users
- Ask the same question twice`;

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'request_configuration',
      description: 'Called when the user intent maps to a specific product in the catalog. Extracts any variables already mentioned by the user.',
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
];

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }

  const { messages, catalog, userProfile } = await request.json();

  // Slim catalog — only what the model needs to identify products and variables
  type RawProduct = {
    productName?: string;
    productCategory?: string;
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

  const systemContent = `${profilePreamble}${SYSTEM_PROMPT}\n\nCatalog:\n${JSON.stringify(slimCatalog)}`;

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
        const responsePayload = {
          type: 'tool_call',
          tool: 'request_configuration',
          tool_use_id: tc.id,
          input: {
            productName: args.productName,
            extracted_variables: args.extracted_variables ?? {},
          },
        };
        console.log('RETURNING TO FRONTEND:', JSON.stringify(responsePayload.input, null, 2));
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
