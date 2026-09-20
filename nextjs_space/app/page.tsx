import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'

export const metadata = {
  title: 'BioVeracity | Environmental evidence, connected to place.',
  description: 'BioVeracity connects places, people and environmental evidence — from local observations to professional reports and long-term commitments.',
  openGraph: {
    title: 'BioVeracity | Environmental evidence, connected to place.',
    description: 'Different reasons to care. The same place. Evidence that stays connected.',
  },
}

const ROUTES = [
  ['I run a place', 'Make your venue a meeting point for its local ecology.', '/wild/partners', 'For venues'],
  ['I investigate places', 'Find environmental evidence and build a source-linked record.', '/professionals', 'For ecologists & professionals'],
  ['I manage environmental commitments', 'Make sense of years of reports, monitoring and engineering evidence.', '/professionals#sustainability', 'For sustainability teams'],
  ['I work in planning or enforcement', 'Follow what was promised, what should have happened and what evidence exists.', '/institutional', 'For councils & public bodies'],
  ['I look for environmental opportunities', 'See how BioVeracity can follow emerging environmental needs and programmes.', '/contact', 'Discuss horizon scanning'],
  ['I know my local wildlife', 'Explore the living record of your county and the places connected to it.', '/wild', 'Explore Wild Counties'],
] as const

export default function HomePage() {
  return (
    <PublicShell>
      <section className="bv-hero">
        <p className="bv-eyebrow">Environmental evidence, connected to place</p>
        <h1>Every place has a story.<br /><em>Keep the evidence connected to it.</em></h1>
        <p className="bv-intro">BioVeracity brings places, people and environmental evidence together — from local observations to professional reports and long-term commitments.</p>
      </section>

      <section className="bv-section">
        <p className="bv-eyebrow">Start with you</p>
        <h2>What brings you here?</h2>
        <div className="bv-grid bv-three">
          {ROUTES.map(([title, body, href, action]) => (
            <article className="bv-feature" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
              <Link href={href}>{action} →</Link>
            </article>
          ))}
        </div>
      </section>

      <section className="bv-section bv-tinted">
        <p className="bv-eyebrow">One place. Many reasons to care.</p>
        <h2>Different people.<br /><em>The same evidence network.</em></h2>
        <div className="bv-grid bv-three">
          <article className="bv-feature"><h3>Places create attention</h3><p>Venues give people a reason to notice the landscape around them and return as it changes.</p></article>
          <article className="bv-feature"><h3>People and professionals add context</h3><p>Local observations, public records and professional evidence remain distinct, dated and traceable to their sources.</p></article>
          <article className="bv-feature"><h3>The record stays with the place</h3><p>Reports, observations and long-term commitments can be understood in context rather than disappearing into separate systems.</p></article>
        </div>
      </section>

      <section className="bv-section bv-pricing">
        <p className="bv-eyebrow">BioVeracity</p>
        <h2>Different reasons.<br /><em>Same place.</em></h2>
        <p>Explore local ecology through Wild Counties, understand a site through professional evidence, or keep long-term environmental records connected to the place they concern.</p>
        <div className="bv-actions"><Link className="bv-button" href="/wild">Explore Wild Counties</Link><Link className="bv-text-link" href="/professionals">Understand a site →</Link></div>
      </section>
    </PublicShell>
  )
}
