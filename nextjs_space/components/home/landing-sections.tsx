import Link from 'next/link'
import { Button } from '@/components/ui/button'

// Plain-English landing sections. Restrained, professional identity: no bright
// gradients, excessive cards or decorative complexity. All copy is fixed marketing
// text — no private workspace data is read or rendered here.

const container = 'mx-auto w-full max-w-[1000px] px-4'

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">{children}</h2>
}

export function LandingSections({ openHref }: { openHref: string }) {
  return (
    <>
      {/* Section 1: The problem */}
      <section className="border-b border-border bg-white py-16">
        <div className={container + ' max-w-[760px]'}>
          <SectionHeading>Environmental decisions rarely arrive in one tidy file.</SectionHeading>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground/80">
            A planning condition may sit in one system, a species record in another, flood
            information somewhere else, and the reason for a later decision inside a report or
            email. By the time someone needs the complete account, the original team may have
            moved on and the evidence may have changed.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            BioVeracity preserves the sources, dates and changes so the next person does not have
            to reconstruct the case from the beginning.
          </p>
        </div>
      </section>

      {/* Section 2: How it works */}
      <section id="how-it-works" className="scroll-mt-20 border-b border-border bg-secondary/40 py-16">
        <div className={container}>
          <SectionHeading>How it works</SectionHeading>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              { n: 1, t: 'Open a case', d: 'Choose the decision or place you need to understand. BioVeracity can retrieve relevant public records and keep them separate from your private case evidence.' },
              { n: 2, t: 'Add and review the evidence', d: 'Upload authorised documents and review the extracted dates, claims and source passages. Nothing becomes an accepted finding until a user reviews it.' },
              { n: 3, t: 'Build the record', d: 'See the chronology, compare conflicting statements, identify missing evidence and create a reviewed report with links back to the supporting sources.' },
            ].map(step => (
              <div key={step.n} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{step.n}</span>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{step.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{step.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-border bg-card p-4 shadow-sm">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm font-medium text-foreground">
              {['Open a case', 'Gather records', 'Review source passages', 'Build chronology', 'Export report'].map((label, i, arr) => (
                <li key={label} className="flex items-center gap-2">
                  <span>{label}</span>
                  {i < arr.length - 1 && <span aria-hidden className="text-accent">→</span>}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Section 3: A practical example */}
      <section className="border-b border-border bg-white py-16">
        <div className={container + ' max-w-[760px]'}>
          <SectionHeading>From a question to a defensible evidence record</SectionHeading>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground/80">
            An ecology or planning officer needs to understand whether development records,
            protected-species observations and flood or water evidence overlap around a site.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            BioVeracity retrieves the available public records, preserves their dates and location
            precision, and shows what is near the site. The officer can then add assessments,
            correspondence and planning documents, review the relevant passages and build a
            traceable chronology.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            Proximity is treated as something to investigate—not proof of ecological conflict.
          </p>
          <div className="mt-6">
            <Button asChild variant="outline">
              <Link href="/search?q=Enniscorthy">View the example</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Section 4: Who it helps */}
      <section className="border-b border-border bg-secondary/40 py-16">
        <div className={container}>
          <SectionHeading>Who it helps</SectionHeading>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {[
              { t: 'Planning and enforcement', d: 'Reconstruct conditions, representations, decisions and subsequent evidence.' },
              { t: 'Ecology and environment', d: 'Connect species, habitat, water and development records while preserving location precision.' },
              { t: 'Infrastructure and water', d: 'Follow permits, monitoring, interventions, complaints and changing operational evidence.' },
              { t: 'Legal and expert review', d: 'Find the source passage behind a claim and distinguish accepted, disputed and missing evidence.' },
            ].map(card => (
              <div key={card.t} className="rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="font-display text-lg font-semibold text-foreground">{card.t}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{card.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5: What makes it different */}
      <section className="border-b border-border bg-white py-16">
        <div className={container + ' max-w-[760px]'}>
          <SectionHeading>Evidence first. Conclusions remain reviewable.</SectionHeading>
          <ul className="mt-6 space-y-4">
            {[
              'Every displayed claim links back to a source.',
              'Event dates remain separate from publication and retrieval dates.',
              'Unknown or conflicting information stays visible.',
              'Public context remains separate from private case evidence.',
            ].map(point => (
              <li key={point} className="flex items-start gap-3 text-[17px] leading-relaxed text-foreground/80">
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Section 6: Pricing */}
      <section id="pricing" className="scroll-mt-20 border-b border-border bg-secondary/40 py-16">
        <div className={container}>
          <SectionHeading>Pricing built around the work you need to complete</SectionHeading>
          <p className="mt-5 max-w-[760px] text-[17px] leading-relaxed text-foreground/80">
            BioVeracity can support one difficult case, a team managing ongoing casework, or an
            institution following evidence across multiple places.
          </p>
          <p className="mt-4 max-w-[760px] text-[17px] leading-relaxed text-foreground/80">
            Pricing depends on the number of cases, named users, locations, evidence volume,
            reporting requirements and level of support required.
          </p>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {[
              { t: 'Guided case pilot', d: 'Use BioVeracity on one defined case or decision, with agreed evidence sources, a source-linked chronology and a reviewed report.' },
              { t: 'Professional workspace', d: 'For individual professionals or small teams managing multiple investigations and evidence records.' },
              { t: 'Institutional access', d: 'For councils, regulators, infrastructure operators and expert teams managing portfolios of places or cases.' },
            ].map(tier => (
              <div key={tier.t} className="flex flex-col rounded-lg border border-border bg-card p-6 shadow-sm">
                <h3 className="font-display text-lg font-semibold text-foreground">{tier.t}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-muted-foreground">{tier.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild>
              <Link href="/contact">Contact us for pricing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/contact">Request institutional access</Link>
            </Button>
          </div>
          <p className="mt-5 max-w-[760px] text-[15px] leading-relaxed text-muted-foreground">
            We will confirm the scope, deliverables and price before any commitment. BioVeracity
            does not charge for an initial scoping conversation.
          </p>
        </div>
      </section>

      {/* Section 7: Trust and boundaries */}
      <section className="border-b border-border bg-white py-16">
        <div className={container + ' max-w-[760px]'}>
          <SectionHeading>Trust and boundaries</SectionHeading>
          <p className="mt-5 text-[17px] leading-relaxed text-foreground/80">
            BioVeracity organises evidence; it does not replace the judgement of planners,
            ecologists, regulators, engineers or legal professionals.
          </p>
          <p className="mt-4 text-[17px] leading-relaxed text-foreground/80">
            Community observations are retained as observations, not treated as verified pollution
            or causation. Users must only upload records they are authorised to hold. Identifiable
            children’s material must not be uploaded.
          </p>
        </div>
      </section>

      {/* Section 8: Final call to action */}
      <section className="bg-secondary/40 py-16">
        <div className={container + ' max-w-[760px] text-center'}>
          <SectionHeading>Stop rebuilding the same evidence trail.</SectionHeading>
          <p className="mx-auto mt-5 max-w-[620px] text-[17px] leading-relaxed text-foreground/80">
            Bring one difficult case to BioVeracity and establish what the available evidence
            can—and cannot—support.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/contact">Discuss a pilot</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={openHref}>Open BioVeracity</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  )
}
