import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Zolofy Agentic — Vibe Shopping',
  description: 'UCP-compliant agentic commerce interface',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body
        className="antialiased"
        style={{
          fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#F2F2F7',
          color: '#000000',
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
