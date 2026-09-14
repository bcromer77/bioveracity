import { EvidenceLink } from '@/components/evidence-link'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PublicNav } from './public-nav'

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="bv-public">
    <EvidenceLink className="bv-skip" href="#main-content">Skip to content</EvidenceLink>
    <header className="bv-header"><Link className="bv-brand" href="/">BioVeracity<span>Evidence & discovery</span></Link>
      <PublicNav />
    </header>
    <main id="main-content">{children}</main>
    <footer className="bv-footer"><div><Link className="bv-brand" href="/">BioVeracity</Link><p>Understand a site. Discover a place.</p></div><nav aria-label="Footer navigation"><Link href="/professionals">For professionals</Link><Link href="/wild/partners">For venues</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link></nav><p className="bv-fine">An independent platform. Community participation does not imply environmental certification or regulator endorsement.</p></footer>
  </div>
}
