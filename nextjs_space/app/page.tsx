import { auth } from '@/auth'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { LandingHero } from '@/components/home/landing-hero'
import { LandingSections } from '@/components/home/landing-sections'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const session = await auth()
  // Signed-in visitors go straight to their workspace; signed-out visitors are
  // sent to sign-in / account creation.
  const openHref = session?.user?.id ? '/workspace' : '/login?callbackUrl=/workspace'

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <LandingHero openHref={openHref} />
        <LandingSections openHref={openHref} />
      </main>
      <SiteFooter />
    </div>
  )
}
