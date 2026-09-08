import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { LeadForm } from '@/components/lead/lead-form'

export const dynamic = 'force-dynamic'

export default function LeadPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <LeadForm />
      </main>
      <SiteFooter />
    </div>
  )
}
