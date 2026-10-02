import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'

export const metadata = { title: '30-year BNG evidence records | BioVeracity', description: 'Keep Biodiversity Net Gain baselines, plans, legal commitments, monitoring and reporting evidence connected across the long term.' }

export default function BngPage() {
  return <PublicShell>
    <section className="bv-hero"><p className="bv-eyebrow">For developers, land managers, ecologists, responsible bodies and planning teams in England</p>
      <h1>BNG can last at least 30 years.<br /><em>Keep the evidence together for 30 years.</em></h1>
      <p className="bv-intro">BNG legal agreements for relevant on-site and off-site gains can require habitats to be maintained for at least 30 years. Habitat Management and Monitoring Plans set out management, monitoring, reporting and review. BioVeracity keeps the evidence record connected from baseline to later monitoring.</p>
      <div className="bv-actions"><Link className="bv-button" href="/institutional">Create a 30-year evidence ledger</Link><a className="bv-text-link" href="https://www.gov.uk/guidance/creating-a-habitat-management-and-monitoring-plan-for-bng">Read the government HMMP guidance →</a></div>
    </section>
    <section className="bv-section bv-tinted"><p className="bv-eyebrow">One site. One chronology.</p><h2>Baseline → commitment → management → monitoring → review</h2>
      <div className="bv-grid bv-three"><article className="bv-feature"><h3>Start with what was agreed</h3><p>Keep the baseline, biodiversity metric, gain plan, HMMP and relevant legal or register references connected to the site.</p></article><article className="bv-feature"><h3>Add monitoring evidence</h3><p>Connect later surveys and reports to the habitat, target, management action and period they concern.</p></article><article className="bv-feature"><h3>See the history</h3><p>Show what evidence exists, what changed, what is due for review and where evidence has not been located.</p></article></div>
    </section>
    <section className="bv-section"><h2>The question should never be<br /><em>“which folder was that in?”</em></h2><p>For NSIPs applying for development consent from 2 November 2026, government guidance requires relevant BNG responsibilities including management, monitoring and reporting. BioVeracity is an evidence record for those workflows; it does not replace the ecologist, HMMP, legal agreement, metric or discharging authority.</p>
      <div className="bv-actions"><Link className="bv-button" href="/institutional">Show me a 30-year record</Link><Link className="bv-text-link" href="/evidence">See the evidence model →</Link></div>
    </section>
  </PublicShell>
}
