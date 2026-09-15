import Link from 'next/link'
import type { ReactNode } from 'react'
import { REPRESENTATION_LINE, ELLONA } from '@/lib/ellona/config'
import { SignOutButton } from './sign-out-button'

export function EllonaShell({ children, showAdmin = false }: { children: ReactNode; showAdmin?: boolean }) {
  return (
    <div className="bv-ellona">
      <header className="bv-ellona-head">
        <Link className="bv-brand" href="/ellona">
          BioVeracity<span>Environmental Opportunity Watch</span>
        </Link>
        <nav aria-label="Opportunity watch navigation">
          <Link href="/ellona">Dashboard</Link>
          <Link href="/ellona/assess">Analyse your own opportunity</Link>
          {showAdmin ? <Link href="/ellona/admin">Admin</Link> : null}
          <SignOutButton />
        </nav>
      </header>
      <div className="bv-ellona-wrap">{children}</div>
      <footer className="bv-ellona-head" style={{ fontSize: 12, alignItems: 'flex-start' }}>
        <div>
          <strong>{ELLONA.workspaceName}</strong>
          <div style={{ color: '#cdd6c8', marginTop: 6, maxWidth: 640, lineHeight: 1.6 }}>{REPRESENTATION_LINE}</div>
        </div>
      </footer>
    </div>
  )
}
