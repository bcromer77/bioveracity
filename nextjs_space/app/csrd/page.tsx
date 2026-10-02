import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'
import { EvidenceLink } from '@/components/evidence-link'
import { enquiryHref } from '@/lib/enquiry/config'

export const metadata = { title: 'CSRD and ESRS evidence | BioVeracity', description: 'Connect ESRS disclosures, targets, metrics, sites and source evidence in a traceable chronology for sustainability review.' }

export default function CsrdPage() {
  return <PublicShell>
    <section className="bv-hero"><p className="bv-eyebrow">For sustainability, finance, legal and assurance teams reporting under CSRD / ESRS</p>
      <h1>Your sustainability statement is the end of the process.<br /><em>Keep the evidence chain underneath it.</em></h1>
      <p className="bv-intro">BioVeracity connects reported matters to the targets, metrics, sites, source documents and later evidence they concern. The result is a traceable chronology for review rather than another folder of sustainability documents.</p>
      <div className="bv-actions"><Link className="bv-button" href={enquiryHref('csrd-hero')}>Map one reported matter →</Link><EvidenceLink className="bv-text-link" href="https://finance.ec.europa.eu/capital-markets-union-and-financial-markets/company-reporting-and-auditing/company-reporting/corporate-sustainability-reporting_en">Read the European Commission overview</EvidenceLink></div>
    </section>
    <section className="bv-section bv-tinted"><p className="bv-eyebrow">Especially useful where evidence is place-based</p><h2>Disclosure → target → metric → site → evidence</h2>
      <div className="bv-grid bv-three"><article className="bv-feature"><h3>Keep the source</h3><p>Preserve where a statement or measurement came from, its document location and relevant dates.</p></article><article className="bv-feature"><h3>Connect the place</h3><p>Relate site-level environmental evidence to the target, metric or reported matter it may inform.</p></article><article className="bv-feature"><h3>Preserve uncertainty</h3><p>Keep conflicting, incomplete and later evidence visible for human review instead of forcing a compliance score.</p></article></div>
    </section>
    <section className="bv-section"><h2>One reporting regime should not require<br /><em>a second evidence universe.</em></h2><p>The same source-linked evidence model can support different reporting and review jobs. BioVeracity organises and traces evidence; it does not provide legal assurance or determine CSRD/ESRS compliance.</p>
      <div className="bv-actions"><Link className="bv-button" href={enquiryHref('csrd-end')}>Map one reported matter →</Link><Link className="bv-text-link" href="/evidence">See the evidence model →</Link></div>
    </section>
  </PublicShell>
}
