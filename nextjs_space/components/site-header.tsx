'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { ChevronDown, LogOut } from 'lucide-react'

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: session } = useSession() || {}

  return (
    <header className="w-full border-b border-[#34574a] bg-[#173d35] text-[#f7f4ec]">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent font-display text-xs font-bold text-accent-foreground">
            BV
          </span>
          <span className="font-display text-[17px] font-bold text-[#f7f4ec]">BioVeracity</span>
        </Link>

        {session?.user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]"
            >
              {session.user.name || session.user.email || 'Account'}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-border bg-[#173d35] p-1 shadow-lg">
                  <Link
                    href="/my-places"
                    className="block rounded-sm px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]"
                    onClick={() => setMenuOpen(false)}
                  >
                    My places
                  </Link>
                  <Link
                    href="/account"
                    className="block rounded-sm px-3 py-2 text-[15px] text-[#f7f4ec] hover:bg-[#34574a]"
                    onClick={() => setMenuOpen(false)}
                  >
                    Account
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      signOut({ redirectTo: '/' })
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[15px] text-[#f7f4ec] hover:bg-[#34574a]"
                  >
                    <LogOut className="h-4 w-4 text-muted-foreground" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="rounded-md px-3 py-2 text-[15px] font-medium text-[#f7f4ec] hover:bg-[#34574a]"
          >
            Sign in
          </Link>
        )}
      </div>
      <nav aria-label="Main navigation" className="mx-auto flex max-w-[1100px] flex-wrap gap-x-6 gap-y-1 px-4 pb-3 text-sm">
        <Link href="/professionals" className="py-2 hover:underline">For professionals</Link>
        <Link href="/wild" className="py-2 hover:underline">Wild Counties</Link>
        <Link href="/wild/partners" className="py-2 hover:underline">For venues</Link>
        <Link href="/contact" className="py-2 hover:underline">Contact</Link>
      </nav>
    </header>
  )
}
