'use client'

import { useState } from 'react'
import Link from 'next/link'
import { INTEREST_CATEGORIES, type InterestSource } from '@/lib/register-interest/interest'

const inputClass =
  'w-full rounded-md border-2 border-border bg-white px-3 py-2.5 text-[16px] text-foreground outline-none focus:border-foreground'

// PR54 — one reusable Register interest form. The originating surface is passed
// in by the page that renders it and validated again server-side.
export function RegisterInterestForm({ source = 'general' }: { source?: InterestSource }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [organisation, setOrganisation] = useState('')
  const [category, setCategory] = useState('')
  const [message, setMessage] = useState('')
  const [company, setCompany] = useState('') // honeypot
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!name.trim() || !email.trim() || !category) {
      setError('Please add your name, email and choose what best describes you.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, organisation, category, message, source, company }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error || 'Request failed')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-md border-2 border-border bg-secondary/40 p-6">
        <h2 className="font-display text-[20px] font-semibold text-foreground">Thanks. You&rsquo;re on the list.</h2>
        <p className="mt-2 text-[16px] leading-relaxed text-muted-foreground">
          BioVeracity is opening gradually to businesses, professionals and people working with places and nature.
          We&rsquo;ll get in touch when there&rsquo;s something relevant for you.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Honeypot: hidden from real users, catches naive bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} />
      </div>
      <div>
        <label htmlFor="name" className="block text-[15px] font-medium text-foreground">Your name</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="email" className="block text-[15px] font-medium text-foreground">Email address</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="organisation" className="block text-[15px] font-medium text-foreground">
          Organisation <span className="text-muted-foreground">(optional)</span>
        </label>
        <input id="organisation" value={organisation} onChange={(e) => setOrganisation(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      </div>
      <div>
        <label htmlFor="category" className="block text-[15px] font-medium text-foreground">What best describes you?</label>
        <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={`mt-1.5 ${inputClass}`}>
          <option value="">Please choose…</option>
          {INTEREST_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="message" className="block text-[15px] font-medium text-foreground">
          Anything you&rsquo;d like to add? <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} rows={4} className={`mt-1.5 ${inputClass} resize-y`} />
      </div>
      {error && <p className="text-[15px] text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-accent px-5 py-2.5 text-[16px] font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Sending…' : 'Register my interest'}
      </button>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        We&rsquo;ll only use your details to get in touch about BioVeracity. See our{' '}
        <Link href="/privacy" className="underline">privacy information</Link>.
      </p>
    </form>
  )
}
