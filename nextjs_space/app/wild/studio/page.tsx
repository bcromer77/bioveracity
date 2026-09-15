import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { PublicShell } from '@/components/wild/public-shell'
import { HubStudio } from '@/components/wild/hub-studio'
import { enabled } from '@/lib/wild-hubs/http'
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Your local guides | BioVeracity',
  robots: { index: false, follow: false },
}
export default async function StudioPage() {
  if (!enabled())
    return (
      <PublicShell>
        <section className="bv-section">
          <h1>Let’s bring your place to life</h1>
          <p>
            You can’t create your guide online just yet. Tell us about your place
            and we can discuss the next steps.
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
      <HubStudio />
    </PublicShell>
  )
}
