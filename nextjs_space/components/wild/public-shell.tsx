import Link from 'next/link'
import type { ReactNode } from 'react'
import { PublicAccount } from './public-account'

export function PublicShell({ children }: { children: ReactNode }) {
  return <div className="bv-public">
    <a className="bv-skip" href="#main-content">Skip to content</a>
    <header className="bv-header"><Link className="bv-brand" href="/">BioVeracity<span>Evidence & discovery</span></Link>
      <nav aria-label="Main navigation"><Link href="/professionals">For professionals</Link><Link href="/wild">Wild Counties</Link><Link href="/wild/partners">For venues</Link><PublicAccount /></nav>
    </header>
    <main id="main-content">{children}</main>
    <footer className="bv-footer"><div><Link className="bv-brand" href="/">BioVeracity</Link><p>Understand a site. Discover a place.</p></div><nav aria-label="Footer navigation"><Link href="/professionals">For professionals</Link><Link href="/wild/partners">For venues</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link></nav><p className="bv-fine">An independent platform. Community participation does not imply environmental certification or regulator endorsement.</p></footer>
  </div>
}
