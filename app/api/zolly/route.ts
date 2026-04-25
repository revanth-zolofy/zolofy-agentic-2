import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const SYSTEM_PROMPT = `You are Zolly, a UCP-compliant purchasing agent. You extract variables from natural language. You NEVER calculate prices. You NEVER make up inventory. When user intent is clear for a specific product, use the request_configuration tool. If the intent is unclear or you need more information, respond conversationally as plain text.`;

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
            description: 'Key/value pairs of variable names → numeric values the user has already provided. Omit variables not yet mentioned.',
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

  const { messages, catalog } = await request.json();

  // Slim catalog — only what the model needs to identify products and variables
  type RawProduct = {
    productName?: string;
    productCategory?: string;
    storeName?: string;
    unit?: string;
    baseRate?: number;
    currency?: string;
    variables?: { name?: string; hint?: string }[];
  };
  const slimCatalog = (catalog ?? []).map((p: RawProduct) => ({
    productName: p.productName,
    productCategory: p.productCategory,
    storeName: p.storeName,
    unit: p.unit,
    baseRate: p.baseRate,
    currency: p.currency,
    variables: (p.variables ?? []).map((v) => ({ name: v.name, hint: v.hint })),
  }));

  const systemContent = `${SYSTEM_PROMPT}\n\nCatalog:\n${JSON.stringify(slimCatalog)}`;

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
        return NextResponse.json({
          type: 'tool_call',
          tool: 'request_configuration',
          input: {
            productName: args.productName,
            extracted_variables: args.extracted_variables ?? {},
          },
        });
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
