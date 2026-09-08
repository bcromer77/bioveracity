'use client'

import { useState } from 'react'

const inputClass =
  'w-full rounded-md border-2 border-border bg-white px-3 py-2.5 text-[16px] text-foreground outline-none focus:border-foreground'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please add your name, email and a message.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, issue: message }),
      })
      if (!res.ok) throw new Error('Request failed')
      setDone(true)
    } catch {
      setError('Something went wrong sending your message. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-md border-2 border-border bg-secondary/40 p-6">
        <h2 className="font-display text-[20px] font-semibold text-foreground">Thank you — your message is with us.</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">
          We have received what you sent and will get back to you at the email address you provided.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-[15px] font-medium text-foreground">Your name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="email" className="block text-[15px] font-medium text-foreground">Email address</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="message" className="block text-[15px] font-medium text-foreground">Your message</label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          className={`mt-1.5 ${inputClass} resize-y`}
        />
      </div>
      {error && <p className="text-[15px] text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-accent px-5 py-2.5 text-[16px] font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Send message'}
      </button>
    </form>
  )
}
