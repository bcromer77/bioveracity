import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'

export const metadata = {
  title: 'BioVeracity | Give every place a memory.',
  description: 'Nature does not always announce what has changed. BioVeracity gives every place a shared memory — built from local observations, public records and professional evidence.',
  openGraph: {
    title: 'BioVeracity | Give every place a memory.',
    description: 'The otter hasn’t come back. When did it leave?',
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
      <section className="bv-hero bv-hero-otter">
        <img className="bv-hero-otter-img" src="/hero-otter.jpg" alt="A wild Eurasian otter at the water's edge — the kind of presence a place can lose without anyone recording it" width={1400} height={1138} />
        <div className="bv-hero-otter-overlay">
          <h1>The otter hasn’t come back.<br /><em>When did it leave?</em></h1>
          <p className="bv-intro">Nature does not always announce what has changed. BioVeracity gives every place a shared memory—built from local observations, public records and professional evidence.</p>
          <div className="bv-actions">
            <Link className="bv-button" href="/wild">Explore a living place</Link>
            <Link className="bv-text-link" href="/professionals">Follow the evidence →</Link>
          </div>
          <p className="bv-hero-otter-credit">Eurasian otter · Photograph: Byrdyak (CC BY-SA 4.0)</p>
        </div>
      </section>

      <section className="bv-section bv-tinted">
        <h2>Every place needs<br /><em>people who notice.</em></h2>
        <div className="bv-perspectives">
          <p>A walker notices the otter has not returned.</p>
          <p>A naturalist records fewer bats.</p>
          <p>A venue sees the seasons changing.</p>
          <p>A professional finds what was promised years ago.</p>
        </div>
        <p>BioVeracity keeps those perspectives distinct, dated and connected to the place they concern.</p>
        <p className="bv-noticed">What have you noticed?</p>
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

      <section className="bv-section bv-pricing">
        <h2>Give a place<br /><em>a memory.</em></h2>
        <p>Explore the living record of a place through Wild Counties, or follow the professional evidence behind a site. The same place, seen two ways.</p>
        <div className="bv-actions"><Link className="bv-button" href="/wild">Explore a living place</Link><Link className="bv-text-link" href="/professionals">Follow the evidence →</Link></div>
      </section>
    </PublicShell>
  )
}
