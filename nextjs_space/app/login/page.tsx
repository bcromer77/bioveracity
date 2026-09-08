'use client'

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [callbackUrl, setCallbackUrl] = useState('/account')
  const router = useRouter()

  useEffect(() => {
    const cb = new URLSearchParams(window.location.search).get('callbackUrl')
    if (cb) setCallbackUrl(cb)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    setLoading(true)
    setError('')
    try {
      const res = await signIn('credentials', { email, password, redirect: false })
      if (res?.error) {
        setError('Invalid email or password')
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Sign in</h1>
          <p className="text-[15px] text-muted-foreground mt-2">Access the places you follow and produce reports.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-[15px]">{error}</div>}
          <div>
            <label className="block text-[15px] font-medium text-foreground mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e: any) => setEmail(e?.target?.value ?? '')} placeholder="you@example.com" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <div>
            <label className="block text-[15px] font-medium text-foreground mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e: any) => setPassword(e?.target?.value ?? '')} placeholder="Your password" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
          </div>
          <Button type="submit" disabled={loading} size="lg" className="w-full bg-accent text-accent-foreground hover:brightness-95 text-[16px] font-semibold">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign in'}
          </Button>
        </form>
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
