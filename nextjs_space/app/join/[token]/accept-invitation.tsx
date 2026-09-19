'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    if (busy) return
    setBusy(true); setError('')
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data?.error || 'Invitation could not be accepted')
      router.replace(data.destination || '/start')
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invitation could not be accepted')
      setBusy(false)
    }
  }

  return <div className="space-y-3">
    {error && <p role="alert" className="rounded-md border border-destructive p-3 text-sm text-destructive">{error}</p>}
    <Button size="lg" className="w-full" onClick={accept} disabled={busy}>{busy ? 'Opening…' : 'Open your workspace'}</Button>
  </div>
}
