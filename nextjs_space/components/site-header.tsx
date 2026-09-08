'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { ChevronDown, LogOut } from 'lucide-react'

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: session } = useSession() || {}

  return (
    <header className="w-full border-b border-border bg-white">
      <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent font-display text-xs font-bold text-accent-foreground">
            BV
          </span>
          <span className="font-display text-[17px] font-bold text-foreground">BioVeracity</span>
        </Link>

        {session?.user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-[15px] text-foreground hover:bg-secondary"
            >
              {session.user.name || session.user.email || 'Account'}
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-50 mt-1 w-52 rounded-md border border-border bg-popover p-1 shadow-lg">
                  <Link
                    href="/my-places"
                    className="block rounded-sm px-3 py-2 text-[15px] text-foreground hover:bg-secondary"
                    onClick={() => setMenuOpen(false)}
                  >
                    My places
                  </Link>
                  <Link
                    href="/account"
                    className="block rounded-sm px-3 py-2 text-[15px] text-foreground hover:bg-secondary"
                    onClick={() => setMenuOpen(false)}
                  >
                    Account
                  </Link>
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      signOut({ redirectTo: '/' })
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-[15px] text-foreground hover:bg-secondary"
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
            className="rounded-md px-3 py-2 text-[15px] font-medium text-foreground hover:bg-secondary"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  )
}
