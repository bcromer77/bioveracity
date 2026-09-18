import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { PublicShell } from '@/components/wild/public-shell'
import { ContributionCurator } from '@/components/wild/contribution-curator'
import { enabled, hubDb } from '@/lib/wild-hubs/http'
import { hubService } from '@/lib/wild-hubs/service'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Visitor contributions | BioVeracity',
  robots: { index: false, follow: false },
}

export default async function CuratePage() {
  if (!enabled())
    return (
      <PublicShell>
        <section className="bv-section">
          <h1>The story of your woods, in your hands</h1>
          <p>
            When your hub is live, everything your visitors notice waits quietly
            here for you to read and, if you wish, add to your public story.
          </p>
          <Link className="bv-button bv-green" href="/wild/partners#enquire">
            Contact us for pricing
          </Link>
        </section>
      </PublicShell>
    )
  const session = await auth()
  if (!session?.user?.id) redirect('/login?callbackUrl=%2Fwild%2Fstudio%2Fcurate')
  const hubs = (await hubService(hubDb, session.user.id).list()).map((h) => ({
    id: h.id,
    name: h.profile.name,
  }))
  return (
    <PublicShell>
      <section className="bv-section">
        <p className="bv-eyebrow">Visitor contributions</p>
        <h1>What people have noticed.</h1>
        <p>
          Read each sighting your visitors have shared, and decide gently what
          becomes part of the public story of the place. Nothing here is public
          until you say so, and adding something never turns it into verified
          ecological evidence — it stays a visitor’s observation, always.
        </p>
        {hubs.length === 0 ? (
          <p>Once your hub is set up, visitor contributions will appear here.</p>
        ) : (
          <ContributionCurator hubs={hubs} />
        )}
      </section>
    </PublicShell>
  )
}
