'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const storageKey = 'bioveracity-venue-setup'
export function VenueJoin({ signedIn }: { signedIn: boolean }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    try {
      const incoming = new URLSearchParams(window.location.hash.slice(1)).get('token')
      if (incoming && /^[A-Za-z0-9_-]{43}$/.test(incoming)) {
        sessionStorage.setItem(storageKey, incoming)
        window.history.replaceState(null, '', '/wild/join')
      }
      setToken(sessionStorage.getItem(storageKey) || '')
    } catch { setError('Allow storage for this tab, then reopen your setup link.') }
    setReady(true)
  }, [])
  async function accept() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/wild/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, confirmed }) })
      const data = await response.json()
      if (!response.ok) throw Error(data.error || 'Unable to open your place.')
      if (typeof data.destination !== 'string' || !/^\/wild\/studio\?hub=[a-f0-9-]{36}$/.test(data.destination)) throw Error('Unable to open your place.')
      sessionStorage.removeItem(storageKey)
      window.location.assign(data.destination)
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setBusy(false) }
  }
  return <div className="space-y-5 mt-6 max-w-xl">
    <p>Open your prepared venue page, make it yours and review the seasonal content. It stays private until you approve it and our team completes editorial review.</p>
    {error && <p role="alert" className="bv-error">{error}</p>}
    {!ready ? <p role="status">Opening your setup link…</p> : !token ? <p>Open the setup link BioVeracity sent you. If it has expired, ask us for a replacement.</p> : !signedIn ? <>
      <p>Use the email address your setup link was sent to. Return in this same browser tab after signing in.</p>
      <div className="bv-actions"><Link className="bv-button bv-green" href="/signup?callbackUrl=%2Fwild%2Fjoin">Create your account</Link><Link className="bv-button" href="/login?callbackUrl=%2Fwild%2Fjoin">I already have an account</Link></div>
    </> : <>
      <label className="flex gap-3 items-start"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I am authorised to manage the venue this setup link is for.</label>
      <button className="bv-button bv-green" disabled={!confirmed || busy} onClick={accept}>{busy ? 'Opening your place…' : 'Open my prepared place'}</button>
      <Link className="underline block" href="/login?callbackUrl=%2Fwild%2Fjoin">Use a different account</Link>
      <p className="bv-small">This does not purchase a subscription or publish your page.</p>
    </>}
  </div>
}
