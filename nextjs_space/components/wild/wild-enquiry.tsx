'use client'
import { EvidenceLink } from '@/components/evidence-link'

import { useRef, useState } from 'react'

export function WildEnquiry() {
  const [busy,setBusy]=useState(false)
  const [done,setDone]=useState(false)
  const [error,setError]=useState('')
  const requestId=useRef('')
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(busy) return
    const data=new FormData(event.currentTarget)
    if(!requestId.current) requestId.current=crypto.randomUUID()
    setBusy(true);setError('')
    try {
      const response=await fetch('/api/wild/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({venue:data.get('venue'),email:data.get('email'),website:data.get('website'),message:data.get('message'),company:data.get('company'),requestId:requestId.current})})
      const result=await response.json()
      if(!response.ok||result.received!==true) throw new Error(result.error||'We could not save your enquiry. Please try again.')
      setDone(true)
    } catch(e) {setError(e instanceof Error?e.message:'We could not save your enquiry. Please try again.')} finally {setBusy(false)}
  }
  if(done) return <div className="bv-form bv-confirmation" role="status" tabIndex={-1}><p className="bv-eyebrow">Enquiry received</p><h3>Thank you. Let’s discover your place.</h3><p>Your enquiry has been saved. We’ll use the email you supplied to discuss your page and pricing.</p><p>You have not subscribed or been charged.</p></div>
  return <form className="bv-form" onSubmit={submit}>
    <label htmlFor="wild-venue">Venue name <span>Required</span></label><input id="wild-venue" name="venue" required maxLength={160} autoComplete="organization" placeholder="Your venue" />
    <label htmlFor="wild-email">Email address <span>Required</span></label><input id="wild-email" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="you@example.com" />
    <label htmlFor="wild-website">Website <span>Optional</span></label><input id="wild-website" name="website" type="url" maxLength={500} autoComplete="url" placeholder="https://" />
    <label htmlFor="wild-message">Anything you’d like us to know? <span>Optional</span></label><textarea id="wild-message" name="message" rows={3} maxLength={2000} />
    <div className="bv-honeypot" aria-hidden="true"><label htmlFor="wild-company">Leave this empty</label><input id="wild-company" name="company" tabIndex={-1} autoComplete="off" /></div>
    <p className="bv-small">We use these details to respond to your enquiry. <EvidenceLink href="/privacy">Privacy information</EvidenceLink>.</p>
    {error&&<p role="alert" className="bv-error">{error}</p>}
    <button className="bv-button bv-green" disabled={busy}>{busy?'Saving your enquiry…':'Contact us for pricing'}</button>
  </form>
}
