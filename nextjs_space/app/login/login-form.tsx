'use client'

import { useState } from 'react'
import { authReturnPath } from '@/lib/auth-return-path'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

// `googleEnabled` is computed on the server from the full gate (feature flag AND
// both credentials) and passed in as a prop, so the Google control follows the
// exact same gate as the server-side provider registration.
export function LoginForm({ googleEnabled }: { googleEnabled: boolean }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [adminCode, setAdminCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  // Derive the return path from the request's search params during render. Under
  // the page's force-dynamic rendering this value is present on both the server
  // and the client, so it hydrates cleanly without a post-mount state update.
  const searchParams = useSearchParams()
  const callbackUrl = authReturnPath(searchParams.get('callbackUrl'))

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    setLoading(true)
    setError('')
    try {
      const res = await signIn('credentials', { email, password, adminCode, redirect: false })
      if (res?.error) {
        setError('Unable to sign in. Check your details, confirm your email, and enter an administrator code if required. Too many attempts may temporarily prevent sign-in.')
      } else {
        router.replace(callbackUrl)
      }
    } catch {
      setError('Sign in failed')
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{callbackUrl.startsWith('/wild/') ? 'Sign in to your venue' : callbackUrl.startsWith('/workspace') ? 'Sign in to your workspace' : 'Sign in'}</h1>
          <p className="text-[15px] text-muted-foreground mt-2">{callbackUrl.startsWith('/wild/') ? 'Return to your venue, photographs and publication reviews.' : 'Return to your saved work and the places you follow.'}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div role="alert" className="p-3 rounded-lg bg-destructive/10 text-destructive text-[15px]">{error}</div>}
          <div>
            <label htmlFor="auth-email" className="block text-[15px] font-medium text-foreground mb-1.5">Email</label>
            <input id="auth-email" name="email" autoComplete="email" type="email" value={email} onChange={(e: any) => setEmail(e?.target?.value ?? '')} placeholder="you@example.com" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="auth-password" className="block text-[15px] font-medium text-foreground">Password</label>
              <Link href={`/forgot-password?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-[13px] text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">Forgot password?</Link>
            </div>
            <input id="auth-password" name="password" autoComplete="current-password" type="password" value={password} onChange={(e: any) => setPassword(e?.target?.value ?? '')} placeholder="Your password" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <details className="text-sm space-y-3"><summary>Administrator sign-in</summary><p>Request a code after entering your email and password above.</p><button type="button" disabled={loading} className="underline" onClick={async()=>{setLoading(true);try{const r=await fetch('/api/account/identity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'admin-code',email,password})});const d=await r.json();setError(d.message||d.error)}catch{setError('Unable to request a code.')}finally{setLoading(false)}}}>Email my sign-in code</button><label className="block">Administrator code<input className="block w-full rounded border p-3" autoComplete="one-time-code" value={adminCode} onChange={e=>setAdminCode(e.target.value.trim())}/></label></details>
          <Link className="block text-sm underline" href={`/verify-email?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Confirm your email or resend verification</Link>
          <Button type="submit" disabled={loading} size="lg" className="w-full bg-accent text-accent-foreground hover:brightness-95 text-[16px] font-semibold">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
          </Button>
        </form>
        {googleEnabled && <>
        <div className="flex items-center gap-3 my-5">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[13px] text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <button type="button" onClick={() => signIn('google', { redirectTo: callbackUrl })} className="w-full flex items-center justify-center gap-3 px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[16px] font-semibold text-foreground hover:bg-muted transition-colors">
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign in with Google
        </button>
        </>}
        <p className="text-center text-[15px] text-muted-foreground mt-6">
          No account? <Link href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">Create one</Link>
        </p>
        <p className="text-center text-[15px] text-muted-foreground mt-2">
          <Link href="/" className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">Back to home</Link>
        </p>
      </div>
    </div>
  )
}
