import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'
import { WildEnquiry } from '@/components/wild/wild-enquiry'

export const metadata = {
  title: 'A living story for your destination | BioVeracity',
  description: 'Explore a small regional pilot connecting venues, local knowledge and the changing seasons.',
}
export default function DestinationsPage() {
  return <PublicShell>
    <section className="bv-hero bv-split"><div>
      <p className="bv-eyebrow">For tourism teams across the UK and Ireland</p>
      <h1>A place to visit.<br /><em>A place to care about.</em></h1>
      <p className="bv-intro">The birds beyond the breakfast table. The flowers along the path. Help your venues bring the life around them into the story of a visit.</p>
      <div className="bv-actions"><Link className="bv-button" href="#enquire">Discuss a regional pilot</Link><Link className="bv-text-link" href="/wild/places/example-woodland-venue">Explore an example venue</Link></div>
      <p className="bv-small">Start with your region and work email. No account or payment needed.</p>
    </div><div className="bv-phone"><div className="bv-phone-top">YOUR REGION <span>Illustrative journey</span></div><div className="bv-phone-story"><p className="bv-eyebrow">Your place. Every season.</p><h3>Stay a little.<br />Notice more.</h3><p>A guest scans a sign. A nature page opens. There is something to look for, a story to return to, and room for their own observations.</p></div><div className="bv-phone-bottom"><h4>Each place keeps its character.</h4><p>The ambition is a shared memory of local nature, built one willing venue at a time.</p></div></div></section>
    <section className="bv-section"><p className="bv-eyebrow">Begin with a useful pilot</p><h2>Three places. One local story.</h2><div className="bv-grid bv-three">{[
      ['1', 'Choose the places together.', 'Introduce a few interested venues with a real connection to gardens, rivers, woodland or coast. Each decides whether to take part.'],
      ['2', 'Agree what we can deliver.', 'Define the nature page, seasonal guidance, sources, responsibilities, costs and review process before work begins.'],
      ['3', 'Learn from the first season.', 'Review what guests found useful, what the venues used and how much work it took. Decide together whether to continue.'],
    ].map(([n,title,copy]) => <article className="bv-feature" key={n}><span className="bv-number">{n}</span><h3>{title}</h3><p>{copy}</p></article>)}</div></section>
    <section className="bv-section bv-tinted"><h2>Local knowledge belongs in the story.</h2><p>Ecologists, record centres and community groups may help us understand a place. Their involvement, permissions and any fees are agreed with them. A guest observation remains distinct from a professional finding.</p><p>Seasonal suggestions describe what may be worth noticing. They do not promise sightings or certify environmental performance.</p></section>
    <section id="enquire" className="bv-section bv-split"><div><p className="bv-eyebrow">Start a conversation</p><h2>Tell us about<br /><em>your destination.</em></h2><p>Tell us your organisation, region and what you would like a small pilot to achieve. We will discuss the fit and scope with you.</p><p className="bv-small">No payment or member list required. This enquiry does not start a subscription.</p></div><WildEnquiry audience="destination" /></section>
  </PublicShell>
}
