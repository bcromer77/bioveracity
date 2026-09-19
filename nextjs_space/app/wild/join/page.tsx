import { auth } from '@/auth'
import { PublicShell } from '@/components/wild/public-shell'
import { VenueJoin } from '@/components/wild/venue-join'
import { enabled } from '@/lib/wild-hubs/http'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Your place | BioVeracity', robots: { index: false, follow: false }, referrer: 'no-referrer' as const }
export default async function VenueJoinPage() {
  const session = await auth()
  return <PublicShell><section className="bv-section"><h1>Your place, ready to make your own.</h1>
    {enabled() ? <VenueJoin signedIn={Boolean(session?.user?.id)} /> : <p>Venue setup is not available yet. Please contact BioVeracity before continuing.</p>}
  </section></PublicShell>
}
