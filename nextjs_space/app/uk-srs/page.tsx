import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'

export const metadata = { title: 'UK SRS evidence for listed companies | BioVeracity', description: 'Build the source-linked evidence record behind UK SRS disclosures: claims, targets, metrics, source documents, changes and review.' }

export default function UkSrsPage() {
  return <PublicShell>
    <section className="bv-hero"><p className="bv-eyebrow">For UK listed-company sustainability, finance, legal and assurance teams</p>
      <h1>Your sustainability disclosure is the output.<br /><em>Where is the evidence behind it?</em></h1>
      <p className="bv-intro">The FCA is asking in-scope listed companies to prepare for UK SRS by developing the data, metrics and targets needed to support disclosures and establishing internal controls and review processes. BioVeracity is designed for the evidence layer underneath that work.</p>
      <div className="bv-actions"><Link className="bv-button" href="/institutional">Build your UK SRS evidence map</Link><a className="bv-text-link" href="https://www.fca.org.uk/publications/newsletters/primary-market-bulletin-66">Read the FCA implementation guidance →</a></div>
    </section>
    <section className="bv-section bv-tinted"><p className="bv-eyebrow">The problem</p><h2>A claim can live in one report.<br /><em>Its evidence rarely does.</em></h2>
      <div className="bv-grid bv-three"><article className="bv-feature"><h3>Claims and targets</h3><p>Record what was disclosed, the target or metric it refers to and the reporting period.</p></article><article className="bv-feature"><h3>Source evidence</h3><p>Connect supporting documents while preserving source, locator, dates and provenance.</p></article><article className="bv-feature"><h3>What changed</h3><p>Read later evidence against the earlier statement and route uncertainty or divergence for human review.</p></article></div>
    </section>
    <section className="bv-section"><h2>Built for the review question.</h2><div className="bv-perspectives"><p>What exactly did we say?</p><p>Which metric, target or site did it concern?</p><p>What evidence supported it at the time?</p><p>Has anything material changed since?</p></div>
      <p>BioVeracity organises evidence for review. It does not certify UK SRS compliance or turn an absent record into a legal conclusion.</p><div className="bv-actions"><Link className="bv-button" href="/institutional">Map one disclosure</Link><Link className="bv-text-link" href="/evidence">See the evidence model →</Link></div>
    </section>
  </PublicShell>
}
