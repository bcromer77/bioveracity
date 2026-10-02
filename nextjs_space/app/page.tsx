import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'

export const metadata = {
  title: 'BioVeracity | Every place is changing.',
  description: 'BioVeracity gives places a memory — connecting what was observed, measured, reported and promised so change does not pass unnoticed.',
  openGraph: {
    title: 'BioVeracity | Every place is changing.',
    description: 'Someone should notice.',
  },
}

const RESPONSIBILITIES = [
  ['I run a place', 'Venues, tourism, landowners and communities.', '/wild/partners'],
  ['I manage land or development', 'Developers, planners and infrastructure teams.', '/bng'],
  ['I investigate environmental evidence', 'Ecologists, consultants and researchers.', '/professionals'],
  ['I report environmental commitments', 'UK SRS, BNG and CSRD evidence for sustainability teams and leadership.', '/evidence'],
] as const

const OBLIGATIONS = [
  ['FCA · UK SRS', 'Evidence behind sustainability disclosures for in-scope listed companies.', '/uk-srs'],
  ['Biodiversity Net Gain', 'A long-term evidence record for habitats, monitoring and reporting.', '/bng'],
  ['CSRD / ESRS', 'Evidence for European sustainability reporting and review.', '/csrd'],
] as const

export default function HomePage() {
  return (
    <PublicShell>
      <section className="bv-hero">
        <div className="bv-split">
          <div>
            <h1>Every place is changing.<br /><em>Someone should notice.</em></h1>
            <p className="bv-intro">BioVeracity gives places a memory — bringing together what was observed, measured, reported and promised so change does not pass unnoticed.</p>
            <div className="bv-actions">
              <Link className="bv-button" href="/wild">Explore a place</Link>
              <Link className="bv-text-link" href="/evidence">I&apos;m responsible for a place →</Link>
            </div>
          </div>
          <figure className="bv-hero-figure bv-wild-hero-photo">
            <div className="bv-preview-photo">
              <img src="/hero-otter.jpg" alt="A wild place — one of the places whose evidence can be understood through time" width={1400} height={1138} />
              <figcaption className="bv-photo-caption"><span className="bv-photo-species">A place through time</span><span className="bv-photo-credit">Observe · connect · remember · understand</span></figcaption>
            </div>
          </figure>
        </div>
      </section>

      <section className="bv-section">
        <h2>Different places.<br /><em>The same question.</em></h2>
        <p>Woodlands, wetlands, coastlines, cities and company sites all change over time. BioVeracity connects the evidence so you can see what changed, what it relates to and where the evidence came from.</p>
        <div className="bv-grid bv-three">
          <article className="bv-feature"><p className="bv-eyebrow">A woodland</p><h3>What changed here this spring?</h3><p>From moths and bats to seasonal flowers, invasive species and nearby planning applications.</p><Link href="/wild">See how a place remembers →</Link></article>
          <article className="bv-feature"><p className="bv-eyebrow">A wetland</p><h3>The water changed. What changed before it?</h3><p>Rainfall, birds, water quality, licences, development and monitoring records can live separately. BioVeracity connects their chronology.</p><Link href="/professionals">Follow the evidence →</Link></article>
          <article className="bv-feature"><p className="bv-eyebrow">A company site</p><h3>What have we promised about this place?</h3><p>Connect commitments, targets, monitoring data and external sources to see what happened afterwards.</p><Link href="/evidence">Review the evidence →</Link></article>
        </div>
      </section>

      <section className="bv-section bv-tinted">
        <p className="bv-eyebrow">Places matter</p>
        <h2>Empathy begins<br /><em>with noticing.</em></h2>
        <p>We notice when something changes in our garden, our street or somewhere we love.</p>
        <p>It is harder to notice small changes across a woodland, a wetland or hundreds of company sites when the evidence is scattered across organisations and years.</p>
        <p><strong>BioVeracity helps people responsible for places notice what changed.</strong></p>
        <div className="bv-perspectives">
          <p><strong>Observe</strong><br />Documents, surveys, sensors and public data.</p>
          <p><strong>Connect</strong><br />Evidence across sources, places and time.</p>
          <p><strong>Remember</strong><br />Build a clear chronology of what happened.</p>
          <p><strong>Understand</strong><br />See change, relationships and what may need attention.</p>
        </div>
      </section>

      <section className="bv-section">
        <p className="bv-eyebrow">How can we help?</p>
        <h2>Do you have a responsibility<br /><em>for a place?</em></h2>
        <p>BioVeracity supports people who care for, manage, study or report on places — from local venues to large organisations.</p>
        <div className="bv-grid bv-three">
          {RESPONSIBILITIES.map(([title, body, href]) => <article className="bv-feature" key={title}><h3>{title}</h3><p>{body}</p><Link href={href}>Find your route →</Link></article>)}
        </div>
      </section>

      <section className="bv-section bv-tinted">
        <p className="bv-eyebrow">Key obligations</p>
        <h2>Regulatory change is increasing<br /><em>the need for robust evidence.</em></h2>
        <div className="bv-grid bv-three">
          {OBLIGATIONS.map(([title, body, href]) => <article className="bv-feature" key={title}><h3>{title}</h3><p>{body}</p><Link href={href}>Learn more →</Link></article>)}
        </div>
      </section>
    </PublicShell>
  )
}
