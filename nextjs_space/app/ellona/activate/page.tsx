'use client'

// Public activation page. A single-use invitation token (from the emailed link)
// is exchanged, together with a password the customer chooses, for an activated
// account. This page is intentionally NOT gated behind membership: the account
// has no password yet, so the visitor cannot be signed in. Server enforcement
// (token validity, single-use, expiry, password policy, breach check) lives in
// POST /api/ellona/activate and the invitation library.

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function EllonaActivatePage() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || ''
    setToken(t)
  }, [])

  const submit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    setError('')
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/ellona/activate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || 'Activation failed. The link may have expired or already been used.')
        setLoading(false)
        return
      }
      setDone(true)
      setTimeout(() => router.replace('/login?callbackUrl=/ellona'), 1400)
    } catch {
      setError('Activation failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bv-ellona">
      <div className="bv-ellona-wrap" style={{ maxWidth: 520 }}>
        <div className="bv-ellona-panel" style={{ display: 'block' }}>
          <div className="bv-eyebrow">Ellona Environmental Opportunity Watch</div>
          <h1 style={{ marginTop: 8 }}>Activate your account</h1>
          {done ? (
            <div className="bv-ok" style={{ marginTop: 16 }}>
              Your account is active. Redirecting you to sign in…
            </div>
          ) : (
            <>
              <p className="bv-lead" style={{ marginTop: 8 }}>
                Choose a password to finish setting up your private workspace. Your password must be at least 12
                characters and include upper and lower case letters and a number.
              </p>
              {!token && (
                <div className="bv-notice" style={{ marginTop: 12 }}>
                  This activation link is missing its token. Please open the link from your invitation email again.
                </div>
              )}
              <form onSubmit={submit} style={{ marginTop: 16 }}>
                {error && (
                  <div className="bv-danger" style={{ marginBottom: 12 }}>
                    {error}
                  </div>
                )}
                <label className="bv-field-label" htmlFor="pw">
                  New password
                </label>
                <input
                  id="pw"
                  type="password"
                  value={password}
                  onChange={(e: any) => setPassword(e?.target?.value ?? '')}
                  autoComplete="new-password"
                  required
                  style={inputStyle}
                />
                <label className="bv-field-label" htmlFor="pw2" style={{ marginTop: 12 }}>
                  Confirm password
                </label>
                <input
                  id="pw2"
                  type="password"
                  value={confirm}
                  onChange={(e: any) => setConfirm(e?.target?.value ?? '')}
                  autoComplete="new-password"
                  required
                  style={inputStyle}
                />
                <button
                  type="submit"
                  className="bv-button bv-green"
                  disabled={loading || !token}
                  style={{ marginTop: 18, width: '100%' }}
                >
                  {loading ? 'Activating…' : 'Activate account'}
                </button>
              </form>
            </>
          )}
          <p style={{ marginTop: 18, fontSize: 14 }}>
            <Link className="bv-text-link" href="/login?callbackUrl=/ellona">
              Already activated? Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 8,
  border: '2px solid #d8d4c4',
  background: '#fff',
  fontSize: 16,
  marginTop: 6,
}
