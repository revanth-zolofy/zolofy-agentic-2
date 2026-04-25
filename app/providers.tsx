'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ReactNode, useMemo } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  const client = useMemo(
    () =>
      new ConvexReactClient(
        process.env.NEXT_PUBLIC_CONVEX_URL || 'https://placeholder.convex.cloud'
      ),
    []
  );
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
