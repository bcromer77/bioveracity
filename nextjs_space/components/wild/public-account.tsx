'use client'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
export function PublicAccount() {
  const { data: session, status } = useSession()
  if (status === 'loading')
    return <span aria-label="Loading account" style={{ minWidth: 65 }} />
  return session?.user ? (
    <>
      <Link href="/wild/studio">My ecology hubs</Link>
      <Link href="/workspace">My workspace</Link>
    </>
  ) : (
    <Link href="/login">Sign in</Link>
  )
}
