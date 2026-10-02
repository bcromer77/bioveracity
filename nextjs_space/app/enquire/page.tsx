import { PublicShell } from '@/components/wild/public-shell'
import { EnquiryForm } from '@/components/enquiry/enquiry-form'
import { ENQUIRY_SOURCES, resolveEnquiryContext } from '@/lib/enquiry/config'

export const metadata = {
  title: 'Raise a question with BioVeracity',
  description: 'Tell BioVeracity about one place, site, disclosure or evidence question.',
  robots: { index: false, follow: true },
}

export default async function EnquirePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
  const { source, cta } = resolveEnquiryContext(first(params.source), first(params.cta))
  const copy = ENQUIRY_SOURCES[source]
  return <PublicShell>
    <section className="bv-section bv-split" id="enquire" data-source={source} data-cta={cta ?? ''}>
      <div>
        <p className="bv-eyebrow">{copy.eyebrow}</p>
        <h1>{copy.heading}</h1>
        {/* .bv-intro is styled for dark heroes; on this light section keep the body text colour. */}
        <p className="bv-intro" style={{ color: 'inherit' }}>{copy.intro}</p>
        <p className="bv-small">A person at BioVeracity reads every enquiry and replies by email. No account, payment or commitment is needed.</p>
      </div>
      <EnquiryForm source={source} cta={cta} defaultType={copy.defaultType} />
    </section>
  </PublicShell>
}
