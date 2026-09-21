import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { PublicShell } from '@/components/wild/public-shell'
import { journalEnabled } from '@/lib/venue-journal/http'
import { HubStudio } from '@/components/wild/hub-studio'
import { enabled } from '@/lib/wild-hubs/http'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Your ecology hubs | BioVeracity',
  robots: { index: false, follow: false },
}
export default async function StudioPage() {
  if (!enabled())
    return (
      <PublicShell>
        <section className="bv-section">
          <h1>Your ecology hub, prepared with our team</h1>
          <p>
            We set up each founding partner’s hub personally — there is nothing to
            build on your own. Tell us about your venue and we’ll prepare your
            page, seasonal features and signage with you.
          </p>
          <Link className="bv-button bv-green" href="/wild/partners#enquire">
            Contact us for pricing
          </Link>
        </section>
      </PublicShell>
    )
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Fwild%2Fstudio')
  return (
    <PublicShell>
      <HubStudio photoJournalEnabled={journalEnabled()} />
    </PublicShell>
  )
}
