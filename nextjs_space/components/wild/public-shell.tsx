import { EvidenceLink } from '@/components/evidence-link'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { PUBLIC_NAV_LINKS } from '@/lib/public-navigation'
import { PublicNav } from './public-nav'

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="bv-public">
    <EvidenceLink className="bv-skip" href="#main-content">Skip to content</EvidenceLink>
    <header className="bv-header"><Link className="bv-brand" href="/">BioVeracity<span>Evidence & discovery</span></Link><PublicNav /></header>
    <main id="main-content">{children}</main>
    <footer className="bv-footer"><div><Link className="bv-brand" href="/">BioVeracity</Link><p>Environmental evidence, connected to place.</p></div><nav aria-label="Footer navigation">{PUBLIC_NAV_LINKS.map((l) => <Link key={l.href} href={l.href}>{l.label}</Link>)}<Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link></nav><p className="bv-fine">An independent platform. Community participation does not imply environmental certification or regulator endorsement.</p></footer>
  </div>
}
