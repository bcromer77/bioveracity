'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { ChevronDown, LogOut } from 'lucide-react'
import { PUBLIC_NAV_LINKS } from '@/lib/public-navigation'

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [authError, setAuthError] = useState('')
  const { data: session, status } = useSession() || {}
  const resolving = status === 'loading'

  return (
    <header className="w-full border-b border-[#34574a] bg-[#173d35] text-[#f7f4ec]">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent font-display text-xs font-bold text-accent-foreground">BV</span>
          <span className="font-display text-[17px] font-bold text-[#f7f4ec]">BioVeracity</span>
        </Link>
        {resolving ? <span className="h-9 w-24 rounded-md bg-secondary/60" aria-hidden /> : session?.user ? (
          <div className="relative">
            <button onClick={() => setMenuOpen((o) => !o)} className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]">
              {session.user.name || session.user.email || 'Account'}<ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {menuOpen && <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-border bg-[#173d35] p-1 shadow-lg">
                <Link href="/start" className="block rounded-sm px-3 py-2 text-[15px]" onClick={() => setMenuOpen(false)}>My home</Link>
                <Link href="/wild/studio" className="block rounded-sm px-3 py-2 text-[15px]" onClick={() => setMenuOpen(false)}>My venues</Link>
                <Link href="/search" className="block rounded-sm px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]" onClick={() => setMenuOpen(false)}>Search BioVeracity</Link>
                <Link href="/workspace" className="block rounded-sm px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]" onClick={() => setMenuOpen(false)}>My workspace</Link>
                <Link href="/my-places" className="block rounded-sm px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]" onClick={() => setMenuOpen(false)}>My places</Link>
                <Link href="/account" className="block rounded-sm px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]" onClick={() => setMenuOpen(false)}>Account</Link>
                <button onClick={() => { setMenuOpen(false); signOut({ redirect: false }).then(() => window.location.assign('/')).catch(() => setAuthError('Sign out could not be confirmed. Please try again.')) }} className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[15px] text-[#f7f4ec] hover:bg-[#34574a]"><LogOut className="h-4 w-4 text-muted-foreground" />Sign out</button>
              </div>
            </>}
          </div>
        ) : <Link href="/login" className="rounded-md px-3 py-2 text-[15px] font-medium text-[#f7f4ec] hover:bg-[#34574a]">Sign in</Link>}
      </div>
      {authError && <p role="alert" className="px-4 py-2">{authError}</p>}
      <nav aria-label="Main navigation" className="mx-auto flex max-w-[1100px] flex-wrap gap-x-6 gap-y-1 px-4 pb-3 text-sm">
        {PUBLIC_NAV_LINKS.map((l) => <Link key={l.href} href={l.href} className="py-2 hover:underline">{l.label}</Link>)}
        <Link href="/contact" className="py-2 hover:underline">Contact</Link>
      </nav>
    </header>
  )
}
