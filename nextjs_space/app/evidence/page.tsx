import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'

export const metadata = {
  title: 'Environmental evidence for organisations | BioVeracity',
  description: 'Connect commitments, claims, targets and monitoring evidence across time so teams can see what was said, what changed and where the evidence came from.',
}

const ROUTES = [
  ['UK listed company', 'Prepare the evidence behind UK SRS sustainability disclosures.', '/uk-srs', 'UK SRS evidence'],
  ['Developer, land manager or ecologist', 'Keep BNG commitments, habitat plans and monitoring evidence connected across the long term.', '/bng', 'BNG evidence'],
  ['European sustainability team', 'Connect ESRS disclosures, targets, metrics, sites and supporting evidence.', '/csrd', 'CSRD / ESRS evidence'],
] as const

export default function EvidencePage() {
  return <PublicShell>
    <section className="bv-hero"><p className="bv-eyebrow">For organisations</p><h1>What did you commit to?<br /><em>What happened next?</em></h1>
      <p className="bv-intro">BioVeracity gives organisations a source-linked record of environmental claims, commitments and evidence over time. See what is supported, what changed and what still needs review — without turning missing evidence into a compliance conclusion.</p>
      <div className="bv-actions"><Link className="bv-button" href="/institutional">Discuss your evidence problem</Link><Link className="bv-text-link" href="/professionals">See the professional workspace →</Link></div>
    </section>
    <section className="bv-section bv-tinted"><p className="bv-eyebrow">Choose the job you need to do</p><h2>One evidence system.<br /><em>Different obligations.</em></h2>
      <div className="bv-grid bv-three">{ROUTES.map(([title,body,href,action])=><article className="bv-feature" key={title}><h3>{title}</h3><p>{body}</p><Link href={href}>{action} →</Link></article>)}</div>
    </section>
    <section className="bv-section"><p className="bv-eyebrow">The common evidence chain</p><h2>Statement → target → evidence → change → review</h2>
      <div className="bv-perspectives"><p><strong>Evidence located.</strong> Supporting material is present and traceable.</p><p><strong>Evidence not located.</strong> Not found in sources reviewed; not a finding of non-compliance.</p><p><strong>Under review.</strong> Human judgement is still required.</p><p><strong>Changed evidence.</strong> Later material changes the context of an earlier statement.</p></div>
    </section>
  </PublicShell>
}
