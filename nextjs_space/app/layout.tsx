import { DM_Sans, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ChunkLoadErrorHandler } from '@/components/chunk-load-error-handler'
import { CookieConsent } from '@/components/cookie-consent'
import { SessionProvider } from 'next-auth/react'

export const dynamic = 'force-dynamic'

const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
const jakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

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
        <script src="https://apps.abacus.ai/chatllm/appllm-lib.js" />
      </head>
      <body className={`${dmSans.variable} ${jakartaSans.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
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
