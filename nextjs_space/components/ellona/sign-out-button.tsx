'use client'

import { signOut } from 'next-auth/react'
import Link from 'next/link'

export function SignOutButton() {
  return (
    <Link
      href="/"
      onClick={(e) => {
        e.preventDefault()
        signOut({ callbackUrl: '/' })
      }}
    >
      Sign out
    </Link>
  )
}
