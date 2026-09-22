'use client'

import { EvidenceLink } from '@/components/evidence-link'

import { RELEASE_VERSION, RELEASE_CORE, RELEASE_VENUE, RELEASE_BIO, RELEASE_LIMITS } from '@/lib/venue-journal/release'

import {useState} from 'react'
export function VenuePhotoContribute({hubId}:{hubId:string}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<{id:string;withdrawalToken:string}|null>(null)
 async function submit(e:React.FormEvent<HTMLFormElement>) {
  e.preventDefault();setError('');setBusy(true)
  const form=e.currentTarget, data=new FormData(form)
  try {
   const file=data.get('photo') as File
   if(!file?.size||file.size>3*1024*1024)throw Error('Choose a JPEG or PNG up to 3 MB.')
   let binary='';for(const byte of new Uint8Array(await file.arrayBuffer()))binary+=String.fromCharCode(byte)
   const r=await fetch(`/api/wild/journal/contribute/${hubId}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base64:btoa(binary),contactName:data.get('contactName'),contactEmail:data.get('contactEmail'),releaseVersion:RELEASE_VERSION,releaseAccepted:data.get('release')==='on',venuePublications:data.get('venuePublications')==='on',bioPublications:data.get('bioPublications')==='on',caption:data.get('caption'),credit:data.get('credit'),location:data.get('location'),observedOn:data.get('observedOn'),adult:data.get('adult')==='on',rightsConfirmed:data.get('rights')==='on',venueUseConsent:data.get('permission')==='on',scannerConsent:data.get('scanner')==='on'})})
   const j=await r.json();if(!r.ok)throw Error(j.error||'Upload unavailable.');setReceipt(j);form.reset()
  } catch(e){setError(e instanceof Error?e.message:'Upload unavailable.')}finally{setBusy(false)}
 }
 const receiptUrl=receipt?`/wild/photos/withdraw?id=${encodeURIComponent(receipt.id)}#${receipt.withdrawalToken}`:''
 return <section className="bv-section bv-tinted"><h2>What did you notice?</h2><p>A bird. A beetle. Lichen on a wall. Your photograph adds another way of seeing this place.</p>
  {error&&<p role="alert">{error}</p>}
  {receipt?<div role="status"><h3>Thank you. Your photograph is private with the venue.</h3><p>It may appear in the owner’s weekly review. Public display requires venue approval and editorial review.</p><EvidenceLink className="bv-button" href={receiptUrl}>Open your withdrawal receipt</EvidenceLink><p>Bookmark the receipt page or save its link. You do not need an account. It is your private way to withdraw this photograph; keep it safe.</p></div>:<form onSubmit={submit} className="bv-form"><fieldset disabled={busy}><legend>Add your photograph</legend>
   <label>JPEG or PNG, up to 3 MB<input name="photo" type="file" accept="image/jpeg,image/png" required/></label>
   <label>What did you notice?<input name="caption" maxLength={300} required/></label>
   <label>Your contact name (private)<input name="contactName" maxLength={160} autoComplete="name" required/></label>
   <label>Your email (private; permissions and rights requests only)<input name="contactEmail" type="email" maxLength={254} autoComplete="email" required/></label>
   <label>Photographer credit (a first name or chosen credit is fine)<input name="credit" maxLength={160} required/></label>
   <label>General location, such as “woodland path”<input name="location" maxLength={160} required/></label>
   <label>Date photographed (leave blank if unknown)<input name="observedOn" type="date"/></label>
   <label className="bv-check"><input name="adult" type="checkbox" required/>I am 18 or over.</label>
   <label className="bv-check"><input name="rights" type="checkbox" required/>I took this photograph or have permission to contribute it. It contains no identifiable children, private personal information or sensitive wildlife locations.</label>
   <label className="bv-check"><input name="permission" type="checkbox" required/>I allow BioVeracity and this venue to store and review this photograph, include a private preview in the venue’s weekly email, publish it with my credit on the venue’s BioVeracity page after approval, and let the venue download it for that purpose.</label>
   <label className="bv-check"><input name="scanner" type="checkbox" required/>I agree to this file being sent to Cloudmersive for security scanning.</label>
   <details><summary>Read the contributor release</summary><p>{RELEASE_CORE}</p><p>{RELEASE_LIMITS}</p><EvidenceLink href="/contributor-release" target="_blank" rel="noreferrer">Open release form</EvidenceLink> · <EvidenceLink href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</EvidenceLink></details>
   <label className="bv-check"><input name="release" type="checkbox" required/>I have read and agree to the contributor release and acknowledge the Privacy Notice.</label>
   <label className="bv-check"><input name="venuePublications" type="checkbox"/>{RELEASE_VENUE}</label>
   <label className="bv-check"><input name="bioPublications" type="checkbox"/>{RELEASE_BIO}</label>
   <p>Your name and email stay private with BioVeracity’s rights administrators. We verify contact and authority before future publication. These choices do not subscribe you to marketing.</p>
   <p>Embedded metadata is removed. Record only a general location. Species names are contributions, not verified identifications. Your receipt lets you withdraw the stored image; copies already downloaded or emailed cannot be recalled.</p>
   <button className="bv-button bv-green" type="submit">{busy?'Checking and contributing…':'Contribute privately'}</button>
  </fieldset></form>}
 </section>
}
