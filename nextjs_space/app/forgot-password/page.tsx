'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e?.preventDefault?.()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/account/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 429) {
        setError('Too many requests. Please try again later.')
      } else if (res.status === 400) {
        setError('Please enter a valid email address.')
      } else {
        // Any other outcome returns the same confirmation, so account existence
        // is never revealed to the person using the form.
        setSubmitted(true)
      }
    } catch {
      // Even on a network error, show the neutral confirmation.
      setSubmitted(true)
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">Reset your password</h1>
          <p className="text-[15px] text-muted-foreground mt-2">Enter your email and we&apos;ll send you a link to choose a new password.</p>
        </div>
        {submitted ? (
          <div className="p-4 rounded-lg bg-muted text-[15px] text-foreground">
            If an account exists for that email address, a password reset link has been sent. The link expires in one hour.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-[15px]">{error}</div>}
            <div>
              <label className="block text-[15px] font-medium text-foreground mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e: any) => setEmail(e?.target?.value ?? '')} placeholder="you@example.com" required className="w-full px-3.5 py-3 rounded-lg border-2 border-input bg-background text-[17px] focus:outline-none focus:border-foreground transition-colors" />
            </div>
            <Button type="submit" disabled={loading} size="lg" className="w-full bg-accent text-accent-foreground hover:brightness-95 text-[16px] font-semibold">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Send reset link'}
            </Button>
          </form>
        )}
        <p className="text-center text-[15px] text-muted-foreground mt-6">
          <Link href="/login" className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">Back to sign in</Link>
        </p>
      </div>
    </div>
  )
}
