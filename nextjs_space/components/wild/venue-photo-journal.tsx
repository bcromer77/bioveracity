'use client'
import { EvidenceLink } from '@/components/evidence-link'
import {useEffect,useState} from 'react'
import Link from 'next/link'
type Photo={id:string;caption:string;credit:string;location:string;observedOn:string|null;createdAt:string;status:string;revision:number;reason:string}
const statusLabel:Record<string,string>={RECEIVED:'Private · ready to review',REVIEW:'Awaiting editorial review',PUBLISHED:'Published',REJECTED:'Changes requested'}
export function VenuePhotoJournal({hubId}:{hubId:string}) {
 const [photos,setPhotos]=useState<Photo[]>([]),[settings,setSettings]=useState({contributionsEnabled:false,weeklyEnabled:false}),[year,setYear]=useState('all'),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(true)
 const endpoint=`/api/wild/journal/hubs/${encodeURIComponent(hubId)}`
 async function api(method='GET',data?:unknown) {
  const r=await fetch(endpoint,{method,headers:data?{'Content-Type':'application/json'}:undefined,body:data?JSON.stringify(data):undefined})
  const j=await r.json();if(!r.ok)throw Error(j.error||'Please try again.');return j
 }
 async function load(){const j=await api();setPhotos(j.photos);setSettings(j.settings)}
 useEffect(()=>{let active=true;api().then(j=>{if(active){setPhotos(j.photos);setSettings(j.settings)}}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setBusy(false)});return()=>{active=false}},[hubId]) // eslint-disable-line react-hooks/exhaustive-deps
 async function change(data:unknown,success:string){setBusy(true);setError('');setMessage('');try{await api('PATCH',data);await load();setMessage(success)}catch(e){setError(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}}
 const years=Array.from(new Set(photos.map(p=>p.observedOn?.slice(0,4)).filter(Boolean))).sort().reverse()
 const shown=photos.filter(p=>year==='all'||(year==='unknown'?!p.observedOn:p.observedOn?.startsWith(year)))
 return <section className="bv-section">
  <p className="bv-eyebrow">Your place. Every season. Year after year.</p><h1>Your photo journal</h1>
  <p>Different people notice different things. Keep their photographs together, choose what to share and revisit the record through the years.</p>
  <div className="bv-actions"><Link href={`/wild/studio?hub=${hubId}`}>Back to venue studio</Link><Link href={`/wild/places/${hubId}`}>View public page</Link></div>
  {error&&<p role="alert" className="bv-error">{error}</p>}{message&&<p role="status">{message}</p>}{busy&&<p role="status">Loading or saving…</p>}
  <fieldset className="bv-form" disabled={busy} id="preferences"><legend>Contributions and weekly email</legend>
   <label className="bv-check"><input type="checkbox" checked={settings.contributionsEnabled} onChange={e=>setSettings({...settings,contributionsEnabled:e.target.checked})}/>Accept guest photographs on your published venue page</label>
   <label className="bv-check"><input type="checkbox" checked={settings.weeklyEnabled} onChange={e=>setSettings({...settings,weeklyEnabled:e.target.checked})}/>Email me a weekly photo review</label>
   <p>One email per venue, covering the previous Monday–Sunday in UTC. It includes up to twelve previews and a link to all new photographs. Your account’s weekly-summary preference also applies. Nothing publishes automatically.</p>
   <button className="bv-button bv-green" onClick={()=>change({action:'settings',...settings},'Photo and email preferences saved.')}>Save preferences</button>
   <p>Guest contributions begin on your published page. This pilot holds up to 200 journal photographs per venue, separate from your twelve-image venue gallery. Downloads contain processed images, with embedded location metadata removed.</p>
  </fieldset>
  <label htmlFor="photo-year">Browse by year photographed</label><select id="photo-year" value={year} onChange={e=>setYear(e.target.value)}><option value="all">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}<option value="unknown">Date unknown</option></select>
  {!busy&&!photos.length&&<p>No guest photographs yet. Enable contributions, then invite guests to use your venue’s QR page.</p>}
  <p>{shown.length} photographs · Newest known observation dates first. Unknown dates stay unknown.</p>
  <div className="bv-photo-grid">{shown.map(p=><figure key={p.id} className="bv-form">
   <img src={`/api/wild/journal/photos/${p.id}?mode=owner`} alt={p.caption} loading="lazy"/>
   <figcaption><strong>{p.caption}</strong><p>{p.credit} · {p.location}</p><p>Taken: {p.observedOn||'Unknown'} · Added: {new Date(p.createdAt).toLocaleDateString('en-GB',{timeZone:'UTC'})}</p><p>{statusLabel[p.status]||p.status}</p>{p.reason&&<p>Editorial note: {p.reason}</p>}</figcaption>
   <div className="bv-actions"><EvidenceLink className="bv-button" href={`/api/wild/journal/photos/${p.id}?mode=owner&download=1`}>Download photo</EvidenceLink><EvidenceLink href={`/api/wild/journal/photos/${p.id}?mode=owner&metadata=1`}>Download date and credit</EvidenceLink></div>
   <div className="bv-actions">
    {['RECEIVED','REJECTED'].includes(p.status)&&<button className="bv-button bv-green" disabled={busy} onClick={()=>{if(window.confirm('Approve this photograph, caption, location and credit for your public page? It will go through editorial review before publication.'))change({action:'submit',photoId:p.id,revision:p.revision},'Submitted for editorial review. It remains private until approved.')}}>Publish to public page</button>}
    {['PUBLISHED','REVIEW'].includes(p.status)&&<button className="bv-button" disabled={busy} onClick={()=>change({action:'unpublish',photoId:p.id,revision:p.revision},'Photograph is private again.')}>{p.status==='PUBLISHED'?'Unpublish':'Cancel submission'}</button>}
    <button disabled={busy} className="bv-text-link" onClick={()=>{if(window.confirm('Withdraw this photograph and delete its stored image? Download a permitted copy first if needed.'))change({action:'withdraw',photoId:p.id,revision:p.revision},'Photograph withdrawn and stored image deleted.')}}>Withdraw photograph</button>
   </div>
  </figure>)}</div>
 </section>
}
