import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});

const departureMono = localFont({
  src: '../../public/fonts/DepartureMono-Regular.woff2',
  variable: '--font-departure-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Khaali — Departure Board',
  description: 'Mechanical split-flap classroom vacancy board for School of Computer Science & Engineering, IILM University Greater Noida.',
  applicationName: 'Khaali',
  appleWebApp: {
    capable: true,
    title: 'Khaali',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0D0D0F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${ibmPlexSans.variable} ${departureMono.variable}`}>
      <body className="min-h-screen bg-page-bg text-cell-ink selection:bg-brand selection:text-white">
        {children}
      </body>
    </html>
  );
}

