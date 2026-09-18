import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Deposit demo — server to server',
  description:
    'A React demo of a server-to-server deposit flow with hosted card fields.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
