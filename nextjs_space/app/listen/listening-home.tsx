'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { COUNTIES } from '@/lib/listens/domain.mjs'
type Plot = { id: string; name: string; county: string }
type Visit = { id: string; plotId: string; receivedAt: string; payload: { observedAt: string; sourceTime: string; birds: string; wind: string; weather: string; note: string; method: string } }
type Home = { plots: Plot[]; visits: Visit[] }
const localTime = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
export function ListeningHome() {
  const [home,setHome] = useState<Home | null>(null), [error,setError] = useState(''), [busy,setBusy] = useState(false), [notice,setNotice] = useState('')
  const [selected,setSelected] = useState(''), [name,setName] = useState(''), [county,setCounty] = useState('')
  const [placeId,setPlaceId] = useState(''), [visitId,setVisitId] = useState('')
  const [time,setTime] = useState(localTime), [birds,setBirds] = useState(''), [wind,setWind] = useState(''), [weather,setWeather] = useState(''), [note,setNote] = useState(''), [completed,setCompleted] = useState(false), [adult,setAdult] = useState(false)
  const [deleteId,setDeleteId] = useState('')
  async function load() {
    const res = await fetch('/api/listen',{cache:'no-store'})
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Your places could not be loaded')
    setHome(data)
    return data as Home
  }
  useEffect(() => { let active = true; fetch('/api/listen',{cache:'no-store'}).then(async res => { const data = await res.json(); if (!res.ok) throw new Error(data.error); if (active) setHome(data) }).catch(e => { if (active) setError(e.message) }); return () => { active = false } },[])
  async function send(input: Record<string,unknown>) {
    const res = await fetch('/api/listen',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'The save could not be confirmed. Please retry.')
    return data
  }
  async function createPlace(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    const id = placeId || crypto.randomUUID(); setPlaceId(id)
    try { await send({action:'place',id,name,county}); setPlaceId(''); setName(''); setCounty(''); setSelected(id); setNotice('Your place is saved. Its first visit begins the memory.'); await load() }
    catch(e) { setError(e instanceof Error ? e.message : 'Save could not be confirmed. Retry with this form.') } finally { setBusy(false) }
  }
  async function createVisit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    const id = visitId || crypto.randomUUID(); setVisitId(id)
    try {
      // The browser interprets the participant-entered local time and supplies its offset.
      const date = new Date(time), offset = -date.getTimezoneOffset(), sign = offset >= 0 ? '+' : '-'
      const zone = sign + String(Math.floor(Math.abs(offset)/60)).padStart(2,'0') + ':' + String(Math.abs(offset)%60).padStart(2,'0')
      await send({action:'visit',id,plotId:selected,observedAt:time+':00'+zone,birds,wind,weather,note,completed,adult})
      setVisitId(''); setBirds(''); setWind(''); setWeather(''); setNote(''); setCompleted(false); setTime(localTime()); setNotice('Visit saved. Thank you for giving this place five minutes of attention.'); await load()
    } catch(e) { setError(e instanceof Error ? e.message : 'Save could not be confirmed. Retry with this form.') } finally { setBusy(false) }
  }
  async function removePlace() {
    setBusy(true); setError('')
    try { await send({action:'delete',id:deleteId}); if (selected===deleteId) setSelected(''); setDeleteId(''); setNotice('Place and its visits deleted from the active service.'); await load() }
    catch(e) { setError(e instanceof Error ? e.message : 'Deletion could not be confirmed') } finally { setBusy(false) }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),scope:'Ireland Listens pilot records only',...home},null,2)],{type:'application/json'}))
    const a = document.createElement('a'); a.href=url; a.download='my-listening-history.json'; a.click(); URL.revokeObjectURL(url)
  }
  const current = home?.plots.find(p=>p.id===selected)
  const visits = home?.visits.filter(v=>v.plotId===selected) || []
  return <section aria-label="Your listening places">
    {error && <div className="listen-alert" role="alert"><p>{error}</p><button disabled={busy} onClick={()=>{setError('');load().catch(e=>setError(e.message))}}>Reload my places</button> <Link href="/verify-email?callbackUrl=%2Flisten">Verify email</Link> · <Link href="/login?callbackUrl=%2Flisten">Sign in</Link></div>}
    {notice && <p className="listen-notice" role="status">{notice}</p>}
    {!home ? !error && <p role="status">Opening your place memories…</p> : <>
      <div className="listen-heading"><h2>Your listening places</h2><button onClick={download}>Download my history</button></div>
      <div className="listen-plots">{home.plots.map(p=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>{setSelected(p.id);setVisitId('');setDeleteId('')}}><span>{p.county}</span><strong>{p.name}</strong><small>{home.visits.filter(v=>v.plotId===p.id).length} listening visits · Private</small></button>)}</div>
      {home.plots.length<3 && <form className="listen-card" onSubmit={createPlace}><h3>{home.plots.length ? 'Add another familiar place' : 'Give your place a name'}</h3><p>A nickname is enough. Please leave out addresses, sensitive species locations and anyone else’s personal details.</p><fieldset disabled={busy}><div className="listen-fields"><label>Private nickname<input required maxLength={80} value={name} onChange={e=>{setName(e.target.value);setPlaceId('')}} placeholder="The garden bench" /></label><label>County<select required value={county} onChange={e=>{setCounty(e.target.value);setPlaceId('')}}><option value="">Choose a county</option>{COUNTIES.map(c=><option key={c}>{c}</option>)}</select></label></div><button className="listen-button" type="submit">{busy ? 'Saving…' : 'Save my place'}</button></fieldset></form>}
      {current && <div className="listen-workspace"><form className="listen-card" onSubmit={createVisit}><p className="listen-eyebrow">Your next quiet moment · {current.county}</p><h2>Listen at {current.name}</h2><p>Sit or stand safely at your usual spot. Listen for five minutes without playing calls. You do not need to identify a species. Try returning at a similar local time and in similar weather.</p><fieldset disabled={busy} onChange={()=>setVisitId('')}>
        <label>When did you listen?<input type="datetime-local" required value={time} onChange={e=>setTime(e.target.value)} /><small>Your device’s time zone is used. Check it matches your visit.</small></label>
        <label>Did you hear birds?<select required value={birds} onChange={e=>setBirds(e.target.value)}><option value="">Choose your observation</option><option value="heard">I heard birds</option><option value="not_heard">I did not hear birds during this visit</option><option value="unsure">I’m unsure</option></select></label>
        <div className="listen-fields"><label>Wind<select required value={wind} onChange={e=>setWind(e.target.value)}><option value="">Choose</option><option value="calm">Calm</option><option value="breezy">Breezy</option><option value="windy">Windy</option></select></label><label>Weather<select required value={weather} onChange={e=>setWeather(e.target.value)}><option value="">Choose</option><option value="dry">Dry</option><option value="rain">Raining</option></select></label></div>
        <label>A small detail you noticed <small>(optional, private)</small><textarea maxLength={500} rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Something you want to remember about this visit…" /></label>
        <label className="listen-check"><input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)} required />I completed five minutes at this place.</label><label className="listen-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)} required />I am 18 or over. I have not included another person’s personal details.</label>
        <button className="listen-button" type="submit">{busy ? 'Confirming your visit…' : 'Save this moment'}</button>
      </fieldset></form><aside className="listen-card"><p className="listen-eyebrow">Place memory</p><h2>{visits.length ? `${visits.length} quiet moments` : 'A beginning, waiting for you.'}</h2><p>{visits.length ? 'These are your observations, in time order. They do not yet establish a change in bird populations.' : 'Your first visit will appear here. Come back to the same spot to build its history.'}</p><ol className="listen-timeline">{visits.map(v=><li key={v.id}><time dateTime={v.payload.observedAt}>{new Date(v.payload.observedAt).toLocaleString('en-IE')}</time><strong>{v.payload.birds==='heard' ? 'Birds heard' : v.payload.birds==='not_heard' ? 'No birds heard in this visit' : 'Unsure'}</strong><span>{v.payload.wind} · {v.payload.weather} · 5 minutes</span>{v.payload.note && <p>{v.payload.note}</p>}<small>Participant observation · Unverified</small></li>)}</ol><p className="listen-small">Method: five-minute listening visit v1. Time and weather affect what can be heard. Species identification, audio analysis and national trends are not part of this pilot.</p></aside></div>}
      {current && <section className="listen-delete"><button disabled={busy} onClick={()=>setDeleteId(current.id)}>Delete this place and its visits</button>{deleteId && <div role="alert"><p>Delete {current.name} and all its listening visits? Download your history first if you want to keep a copy. This cannot be undone here. Backups follow the service’s retention policy.</p><button disabled={busy} onClick={removePlace}>Confirm deletion</button> <button onClick={()=>setDeleteId('')}>Keep my place</button></div>}</section>}
    </>}
  </section>
}
