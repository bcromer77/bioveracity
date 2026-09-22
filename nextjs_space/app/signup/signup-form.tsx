'use client'

import { TERMS_VERSION, PRIVACY_VERSION, TERMS_LABEL } from '@/lib/data-rights/policy'
import { useState } from 'react'
import { authReturnPath } from '@/lib/auth-return-path'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SignupForm() {
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  // Derive the return path from the request's search params during render. Under
  // the page's force-dynamic rendering this value is present on both the server
  // and the client, so it hydrates cleanly without a post-mount state update.
  const searchParams = useSearchParams()
  const requestedReturn = searchParams.get('callbackUrl') && authReturnPath(searchParams.get('callbackUrl')) !== '/start' ? searchParams.get('callbackUrl') : null
  const [purpose, setPurpose] = useState(searchParams.get('type') === 'venue' ? 'venue' : '')
  const callbackUrl = requestedReturn ? authReturnPath(requestedReturn) : purpose === 'venue' ? '/wild/studio' : purpose === 'professional' ? '/workspace' : '/start'

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    if (!acceptTerms) { setError('Please read and accept the terms and acknowledge the privacy notice.'); return }
    if (!requestedReturn && !purpose) { setError('Choose your starting point.'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, acceptTerms, termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, callbackUrl }),
      })
      const data = await res?.json?.()
      if (!res?.ok) {
        setError(data?.error ?? 'Signup failed')
        return
      }
      if (data.verificationRequired) { router.replace(`/verify-email?callbackUrl=${encodeURIComponent(callbackUrl)}`); return }
      const signInRes = await signIn('credentials', { email, password, redirect: false })
      if (signInRes?.error) {
        router.replace(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`)
      } else {
        router.replace(callbackUrl)
      }
    } catch {
      setError('An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-foreground font-display font-bold text-sm">BV</div>
            <span className="font-display font-bold text-lg text-foreground">BioVeracity</span>
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{callbackUrl.startsWith('/wild/') ? 'Create your venue account' : callbackUrl.startsWith('/workspace') ? 'Create your professional account' : 'Create an account'}</h1>
          <p className="text-[15px] text-muted-foreground mt-2">{callbackUrl.startsWith('/wild/') ? 'Manage your place and its photographs in your venue studio.' : 'Your venues and private evidence stay connected to your own account.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!requestedReturn && <label className="block text-sm font-medium">What brings you here?<select required value={purpose} onChange={e=>setPurpose(e.target.value)} className="mt-2 w-full rounded border p-3"><option value="">Choose your starting point</option><option value="venue">I run a venue or ecology hub</option><option value="professional">I work with professional evidence</option><option value="both">I do both / explore places</option></select></label>}
          {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 text-destructive text-[15px]">{error}</div>}
          <div>
            <label htmlFor="auth-text" className="block text-[15px] font-medium text-foreground mb-1.5">Full name</label>
            <input id="auth-text" name="name" autoComplete="name" type="text" value={name} onChange={(e: any) => setName(e?.target?.value ?? '')} placeholder="Your name" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <div>
            <label htmlFor="auth-email" className="block text-[15px] font-medium text-foreground mb-1.5">Email</label>
            <input id="auth-email" name="email" autoComplete="email" type="email" value={email} onChange={(e: any) => setEmail(e?.target?.value ?? '')} placeholder="you@example.com" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <div>
            <label htmlFor="auth-password" className="block text-[15px] font-medium text-foreground mb-1.5">Password</label>
            <input id="auth-password" name="password" autoComplete="new-password" type="password" value={password} onChange={(e: any) => setPassword(e?.target?.value ?? '')} placeholder="At least 10 characters" required minLength={10} className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
          </div>
          {<div className="space-y-3 text-sm"><p><Link href="/terms" target="_blank" className="underline">Terms and Conditions</Link> · <Link href="/privacy" target="_blank" className="underline">Privacy Notice</Link></p><label className="flex gap-3 items-start"><input type="checkbox" required checked={acceptTerms} onChange={e=>setAcceptTerms(e.target.checked)}/><span>{TERMS_LABEL}</span></label><p>This is not consent to marketing or future publication of your photographs.</p></div>}
          <Button type="submit" disabled={loading || !acceptTerms} size="lg" className="w-full bg-accent text-accent-foreground hover:brightness-95 text-[16px] font-semibold">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Create account'}
          </Button>
        </form>
        <p className="text-center text-[15px] text-muted-foreground mt-6">
          Already have an account? <Link href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
