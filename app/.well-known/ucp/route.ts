import { NextResponse } from 'next/server';

export async function GET() {
  const ucpProfile = {
    ucp_version: '2026-04-08',
    profile: 'dev.ucp',
    capabilities: {
      'dev.ucp.shopping.checkout': {
        version: '2026-04-08',
        endpoints: {
          zolly: '/api/zolly',
          mandate: '/api/mandate',
        },
      },
    },
  };

  return NextResponse.json(ucpProfile, {
    headers: { 'Content-Type': 'application/json' },
  });
}
