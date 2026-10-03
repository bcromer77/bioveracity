'use client'
import {useEffect,useState} from 'react'
type Photo={id:string;venueName:string;caption:string;credit:string;location:string;observedOn:string|null;revision:number}
export function VenuePhotoReviews(){
 const [photos,setPhotos]=useState<Photo[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false)
 async function load(){const r=await fetch('/api/wild/journal/reviews');const j=await r.json();if(!r.ok)throw Error(j.error);setPhotos(j.photos)}
 useEffect(()=>{load().catch(e=>setError(e.message))},[])
 async function decide(p:Photo,action:string){const reason=window.prompt('Record your content/rights review or requested correction.');if(!reason)return;setBusy(true);setError('');try{const r=await fetch('/api/wild/journal/reviews',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({photoId:p.id,revision:p.revision,action,confirmed:true,reason})});const j=await r.json();if(!r.ok)throw Error(j.error);await load()}catch(e){setError(e instanceof Error?e.message:'Review unavailable.')}finally{setBusy(false)}}
 return <section><h2>Guest photographs awaiting publication</h2><p>Check image, description, credit, consent and location sensitivity. The venue has requested publication. Approval publishes this photograph when the venue page is public; it does not verify a species identification.</p>{error&&<p role="alert">{error}</p>}<div className="grid gap-6 md:grid-cols-2">{photos.map(p=><article key={p.id}><h3>{p.venueName}</h3><img src={`/api/wild/journal/photos/${p.id}?mode=review`} alt={p.caption}/><p>{p.caption} · {p.credit}</p><p>{p.location} · {p.observedOn||'Date unknown'}</p><div className="flex gap-4"><button disabled={busy} onClick={()=>decide(p,'approve')}>Approve and publish</button><button disabled={busy} onClick={()=>decide(p,'reject')}>Request changes</button></div></article>)}</div>{!photos.length&&!error&&<p>No photographs awaiting review.</p>}</section>
}
