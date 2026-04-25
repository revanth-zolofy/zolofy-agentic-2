import { NextResponse } from 'next/server';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';

export const runtime = 'nodejs';

export async function GET() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_CONVEX_URL is not configured' }, { status: 500 });
  }

  try {
    const client = new ConvexHttpClient(convexUrl);
    const result = await client.mutation(api.seedCatalog.seedInitialCatalog, {});
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[seed] error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
