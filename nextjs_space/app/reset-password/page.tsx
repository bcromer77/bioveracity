'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/account/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setDone(true)
      } else {
        setError(data?.error ?? 'Unable to reset password.')
      }
    } catch {
      setError('Unable to reset password.')
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Choose a new password</h1>
          <p className="text-[15px] text-muted-foreground mt-2">Your new password must be at least 10 characters and include a letter and a number.</p>
        </div>
        {done ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted text-[15px] text-foreground">
              Your password has been reset. For your security, any existing sessions have been signed out.
            </div>
            <Button onClick={() => router.replace('/login')} size="lg" className="w-full bg-accent text-accent-foreground hover:brightness-95 text-[16px] font-semibold">
              Go to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-[15px]">{error}</div>}
            <div>
              <label className="block text-[15px] font-medium text-foreground mb-1.5">New password</label>
              <input type="password" value={password} onChange={(e: any) => setPassword(e?.target?.value ?? '')} placeholder="New password" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
            </div>
            <div>
              <label className="block text-[15px] font-medium text-foreground mb-1.5">Confirm new password</label>
              <input type="password" value={confirm} onChange={(e: any) => setConfirm(e?.target?.value ?? '')} placeholder="Confirm new password" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
            </div>
            <Button type="submit" disabled={loading || !token} size="lg" className="w-full bg-accent text-accent-foreground hover:brightness-95 text-[16px] font-semibold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Reset password'}
            </Button>
            {!token && <p className="text-[13px] text-muted-foreground text-center">This reset link is missing its token. Please use the link from your email.</p>}
          </form>
        )}
        <p className="text-center text-[15px] text-muted-foreground mt-6">
          <Link href="/login" className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-background px-4" />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
