'use client'

import { signOut } from 'next-auth/react'

export function SignOutButton() {
  return (
    <a
      href="/"
      onClick={(e) => {
        e.preventDefault()
        signOut({ callbackUrl: '/' })
      }}
    >
      Sign out
    </a>
  )
}
