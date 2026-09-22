'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const storageKey = 'bioveracity-venue-setup'
const rememberedByServer = 'http-only-cookie'
export function VenueJoin({ signedIn }: { signedIn: boolean }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    void (async () => {
      let fallback = ''
      try {
        const incoming = new URLSearchParams(window.location.hash.slice(1)).get('token')
        if (incoming && /^[A-Za-z0-9_-]{43}$/.test(incoming)) {
          fallback = incoming
          try { sessionStorage.setItem(storageKey, incoming) } catch { /* server cookie remains available */ }
          window.history.replaceState(null, '', '/wild/join')
        }
        if (!fallback) try { fallback = sessionStorage.getItem(storageKey) || '' } catch { /* use the server cookie */ }
        if (fallback) {
          const response = await fetch('/api/wild/join', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'remember', token: fallback }),
          })
          if (response.ok) {
            try { sessionStorage.removeItem(storageKey) } catch { /* expires with the tab */ }
            if (active) setToken(rememberedByServer)
          } else {
            if (active) {
              setToken(fallback)
              setError('Keep this browser tab open while you confirm your email, then return here.')
            }
          }
        } else {
          const response = await fetch('/api/wild/join', { headers: { Accept: 'application/json' } })
          const data = await response.json()
          if (active) setToken(response.ok && data.available ? rememberedByServer : '')
        }
      } catch {
        if (active) {
          setToken(fallback)
          setError(fallback ? 'Keep this browser tab open while you confirm your email, then return here.' : 'Reopen your venue setup link and try again.')
        }
      } finally { if (active) setReady(true) }
    })()
    return () => { active = false }
  }, [])
  async function accept() {
    setBusy(true); setError('')
    try {
      const response = await fetch('/api/wild/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(token === rememberedByServer ? { confirmed } : { token, confirmed }) })
      const data = await response.json()
      if (!response.ok) throw Error(data.error || 'Unable to open your place.')
      if (typeof data.destination !== 'string' || !/^\/wild\/studio\?hub=[a-f0-9-]{36}$/.test(data.destination)) throw Error('Unable to open your place.')
      try { sessionStorage.removeItem(storageKey) } catch { /* the server has already consumed the link */ }
      window.location.assign(data.destination)
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); setBusy(false) }
  }
  return <div className="space-y-5 mt-6 max-w-xl">
    <p>Open your prepared venue page, make it yours and review the seasonal content. It stays private until you approve it and our team completes editorial review.</p>
    {error && <p role="alert" className="bv-error">{error}</p>}
    {!ready ? <p role="status">Opening your setup link…</p> : !token ? <p>Open the setup link BioVeracity sent you. If it has expired, ask us for a replacement.</p> : !signedIn ? <>
      <p>Use the email address your setup link was sent to. You may open the verification email in another tab; this browser will remember your place.</p>
      <div className="bv-actions"><Link className="bv-button bv-green" href="/signup?callbackUrl=%2Fwild%2Fjoin">Create your account</Link><Link className="bv-button" href="/login?callbackUrl=%2Fwild%2Fjoin">I already have an account</Link></div>
    </> : <>
      <label className="flex gap-3 items-start"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I am authorised to manage the venue this setup link is for.</label>
      <button className="bv-button bv-green" disabled={!confirmed || busy} onClick={accept}>{busy ? 'Opening your place…' : 'Open my prepared place'}</button>
      <Link className="underline block" href="/login?callbackUrl=%2Fwild%2Fjoin">Use a different account</Link>
      <p className="bv-small">This does not purchase a subscription or publish your page.</p>
    </>}
  </div>
}
