import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { RegisterInterestForm } from '@/components/interest/register-interest-form'
import { normaliseSource } from '@/lib/register-interest/interest'

export const metadata = {
  title: 'Register your interest — BioVeracity',
  description: 'Raise your hand and we’ll get in touch when there’s something relevant for you.',
}

export const dynamic = 'force-dynamic'

export default async function RegisterInterestPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>
}) {
  const { source } = await searchParams
  const controlledSource = normaliseSource(source)

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[640px] px-4 py-12">
          <h1 className="font-display text-[32px] font-bold leading-tight text-foreground">Register your interest</h1>
          <p className="mt-3 text-[17px] leading-relaxed text-muted-foreground">
            BioVeracity is opening gradually. Tell us a little about you and we&rsquo;ll get in touch when there&rsquo;s
            something relevant. This doesn&rsquo;t create an account or commit you to anything.
          </p>
          <div className="mt-8">
            <RegisterInterestForm source={controlledSource} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
