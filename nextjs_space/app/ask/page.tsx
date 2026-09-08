import { redirect } from 'next/navigation'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AskInterface } from '@/components/ask/ask-interface'
import { ASK_ENABLED } from '@/lib/features'

export const dynamic = 'force-dynamic'

export default function AskPage() {
  if (!ASK_ENABLED) redirect('/search')
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <AskInterface />
      </main>
      <SiteFooter />
    </div>
  )
}
