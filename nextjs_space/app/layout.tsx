import './fonts.css'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler'
import { CookieConsent } from '@/components/cookie-consent'
import { SessionProvider } from 'next-auth/react'

export const dynamic = 'force-dynamic'


export const metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  title: 'BioVeracity — The memory of the physical environment',
  description: 'BioVeracity is the memory of the physical environment. Search any place to see what was measured, what was reported, what changed, and what we still cannot establish.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  openGraph: {
    title: 'BioVeracity — The memory of the physical environment',
    description: 'Search any place to see what was measured, what was reported, what changed, and what we still cannot establish.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preload" href="/fonts/web/dm-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/web/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/web/jetbrains-mono-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      {/* Do not load third-party scripts into an application carrying private case evidence. */}
      <body className="font-sans antialiased">
        <SessionProvider>
          <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} disableTransitionOnChange>
            {children}
            <Toaster />
            <CookieConsent />
            <ChunkLoadErrorHandler />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
