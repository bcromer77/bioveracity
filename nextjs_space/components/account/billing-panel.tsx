'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Plan = { key: string; label: string }
type Billing = {
  enabled: boolean
  plans: Plan[]
  account: null | {
    status: string
    planKey: string | null
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
    canManage: boolean
  }
}

export function BillingPanel() {
  const [data, setData] = useState<Billing | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/account/billing', { cache: 'no-store' })
      .then(async r => {
        const json = await r.json()
        if (!r.ok) throw new Error(json?.error || 'Billing could not be loaded')
        setData(json)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Billing could not be loaded'))
  }, [])

  async function post(path: string, payload: Record<string, unknown>, marker: string) {
    setBusy(marker); setError('')
    try {
      const r = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await r.json()
      if (!r.ok) throw new Error(json?.error || 'Billing request failed')
      if (typeof json?.url !== 'string' || !json.url.startsWith('https://')) throw new Error('Billing provider returned an invalid address')
      window.location.assign(json.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Billing request failed')
      setBusy(null)
    }
  }

  if (!data && !error) return <section className="rounded-xl border border-border bg-card p-6 shadow-sm"><p className="text-sm text-muted-foreground">Loading billing…</p></section>
  if (!data?.enabled) return null

  const active = data.account && !['NONE', 'CANCELED', 'INCOMPLETE_EXPIRED'].includes(data.account.status)

  return <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Billing</p>
    <h2 className="mt-2 font-display text-2xl font-bold">Your BioVeracity plan</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      Payment details are handled by Stripe. BioVeracity stores only the customer, subscription and plan references needed to keep your account in sync.
    </p>

    {active ? <div className="mt-5 rounded-lg border border-border p-4">
      <p className="font-medium">{data.account?.planKey || 'Subscription'}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Status: {data.account?.status.toLowerCase().replaceAll('_', ' ')}
        {data.account?.cancelAtPeriodEnd ? ' · cancels at the end of the current period' : ''}
      </p>
      {data.account?.currentPeriodEnd && <p className="mt-1 text-sm text-muted-foreground">Current period ends {new Date(data.account.currentPeriodEnd).toLocaleDateString()}</p>}
      {data.account?.canManage && <Button className="mt-4" variant="outline" disabled={busy === 'portal'} onClick={() => post('/api/billing/portal', {}, 'portal')}>
        {busy === 'portal' ? 'Opening…' : 'Manage billing'}
      </Button>}
    </div> : <div className="mt-5 grid gap-3">
      {data.plans.map(plan => <div key={plan.key} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
        <div>
          <p className="font-medium">{plan.label}</p>
          <p className="mt-1 text-sm text-muted-foreground">Price is shown and confirmed on Stripe Checkout.</p>
        </div>
        <Button disabled={Boolean(busy)} onClick={() => post('/api/billing/checkout', { planKey: plan.key }, plan.key)}>
          {busy === plan.key ? 'Opening…' : 'Choose'}
        </Button>
      </div>)}
      {data.plans.length === 0 && <p className="text-sm text-muted-foreground">Self-service plans are not currently available.</p>}
    </div>}

    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </section>
}
