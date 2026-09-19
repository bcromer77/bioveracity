'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Pref = {
  actionEmail: boolean
  importantChangeEmail: boolean
  weeklyDigest: boolean
  routineEmail: boolean
}

const defaults: Pref = {
  actionEmail: true,
  importantChangeEmail: true,
  weeklyDigest: true,
  routineEmail: false,
}

export function AttentionPreferences() {
  const [pref, setPref] = useState<Pref>(defaults)
  const [busy, setBusy] = useState(true)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/account/attention', { cache: 'no-store' })
      .then(async r => {
        const data = await r.json()
        if (!r.ok) throw new Error(data?.error || 'Preferences could not be loaded')
        if (data?.preference) setPref(data.preference)
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Preferences could not be loaded'))
      .finally(() => setBusy(false))
  }, [])

  async function save() {
    setBusy(true); setSaved(''); setError('')
    try {
      const r = await fetch('/api/account/attention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pref),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data?.error || 'Preferences could not be saved')
      setPref(data.preference)
      setSaved('Saved')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preferences could not be saved')
    } finally {
      setBusy(false)
    }
  }

  const toggle = (key: keyof Pref) => setPref(current => ({ ...current, [key]: !current[key] }))
  const row = (key: keyof Pref, title: string, text: string) => (
    <label className="flex cursor-pointer items-start justify-between gap-5 border-b border-border py-4 last:border-b-0">
      <span>
        <span className="block font-medium">{title}</span>
        <span className="mt-1 block text-sm leading-6 text-muted-foreground">{text}</span>
      </span>
      <input type="checkbox" checked={pref[key]} onChange={() => toggle(key)} disabled={busy} className="mt-1 h-5 w-5" />
    </label>
  )

  return <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Your attention</p>
    <h1 className="mt-2 font-display text-3xl font-bold">Only interrupt me when it matters.</h1>
    <p className="mt-3 max-w-2xl text-muted-foreground">BioVeracity can watch quietly in the background. Routine arrivals stay in the product unless you ask for more. Important changes are bundled where possible.</p>
    <div className="mt-6">
      {row('actionEmail', 'Something needs me', 'Email me when a review, deadline or decision genuinely needs my attention.')}
      {row('importantChangeEmail', 'Something important changed', 'Email me when new evidence materially changes the position of a place I follow.')}
      {row('weeklyDigest', 'A quiet weekly summary', 'Send one calm summary of useful changes I may want to catch up on.')}
      {row('routineEmail', 'Routine arrivals', 'Include routine background updates in email. Off is recommended.')}
    </div>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {saved && <p role="status" className="mt-4 text-sm text-muted-foreground">{saved}</p>}
    <div className="mt-6 flex items-center gap-3"><Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save preferences'}</Button><span className="text-xs text-muted-foreground">Security and access messages may still be sent when necessary.</span></div>
  </section>
}
