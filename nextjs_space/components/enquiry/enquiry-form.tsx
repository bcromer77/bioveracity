'use client'
import { useEffect, useRef, useState } from 'react'
import { EvidenceLink } from '@/components/evidence-link'
import { ENQUIRY_LIMITS, ENQUIRY_TYPES, type EnquiryCta, type EnquirySource, type EnquiryType } from '@/lib/enquiry/config'

// Submits only to the first-party endpoint. The browser never knows where the
// enquiry is delivered.
export function EnquiryForm({ source, cta, defaultType }: { source: EnquirySource; cta: EnquiryCta | null; defaultType: EnquiryType }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const requestId = useRef('')
  const confirmation = useRef<HTMLDivElement>(null)
  useEffect(() => { if (done) confirmation.current?.focus() }, [done])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    if (!form.reportValidity()) return
    const data = new FormData(form)
    if (!requestId.current) requestId.current = crypto.randomUUID()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/enquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'), email: data.get('email'), organisation: data.get('organisation'),
          type: data.get('type'), message: data.get('message'), website_url: data.get('website_url'),
          source, cta, requestId: requestId.current,
        }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok || result.ok !== true) throw new Error(typeof result.error === 'string' ? result.error : 'We could not send your enquiry just now. Please try again later.')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'We could not send your enquiry just now. Please try again later.')
    } finally {
      setBusy(false)
    }
  }

  if (done) return <div ref={confirmation} className="bv-form bv-confirmation" role="status" aria-live="polite" tabIndex={-1} data-testid="enquiry-success">
    <p className="bv-eyebrow">Enquiry sent</p>
    <h3>Thank you. Your enquiry is with BioVeracity.</h3>
    <p>We will reply to the work email you gave us. You have not created an account or agreed to anything.</p>
    <EvidenceLink className="bv-button bv-green" href="/">Back to BioVeracity</EvidenceLink>
  </div>

  return <form className="bv-form" onSubmit={submit} noValidate={false} data-testid="enquiry-form">
    <label htmlFor="enq-name">Name <span>Required</span></label>
    <input id="enq-name" name="name" required maxLength={ENQUIRY_LIMITS.name} autoComplete="name" />
    <label htmlFor="enq-email">Work email <span>Required</span></label>
    <input id="enq-email" name="email" type="email" required maxLength={ENQUIRY_LIMITS.email} autoComplete="email" />
    <label htmlFor="enq-org">Organisation <span>Optional</span></label>
    <input id="enq-org" name="organisation" maxLength={ENQUIRY_LIMITS.organisation} autoComplete="organization" />
    <label htmlFor="enq-type">What are you responsible for? <span>Required</span></label>
    <select id="enq-type" name="type" required defaultValue={defaultType}>
      {(Object.keys(ENQUIRY_TYPES) as EnquiryType[]).map((k) => <option key={k} value={k}>{ENQUIRY_TYPES[k]}</option>)}
    </select>
    <label htmlFor="enq-message">A short message <span>Required</span></label>
    <textarea id="enq-message" name="message" required rows={4} maxLength={ENQUIRY_LIMITS.message} />
    <div className="bv-honeypot" aria-hidden="true"><label htmlFor="enq-website">Leave this empty</label><input id="enq-website" name="website_url" tabIndex={-1} autoComplete="off" /></div>
    <p className="bv-small">We use these details only to reply to your enquiry. <EvidenceLink href="/privacy">Privacy information</EvidenceLink>.</p>
    <div aria-live="assertive">{error && <p role="alert" className="bv-error">{error}</p>}</div>
    <button type="submit" className="bv-button bv-green" disabled={busy} aria-disabled={busy}>{busy ? 'Sending your enquiry…' : 'Send to BioVeracity'}</button>
  </form>
}
