'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { COUNTIES } from '@/lib/listens/domain.mjs'
type Plot = { id: string; name: string; county: string | null }
// Place mode (PILOT-001): the history belongs to a public Place resolved server-side from its slug.
export type ListeningPlaceProps = { slug: string; title: string }
type Visit = { id: string; plotId: string; receivedAt: string; payload: { observedAt: string; sourceTime: string; birds: string; wind: string; weather: string; note: string; method: string } }
type Home = { plots: Plot[]; visits: Visit[] }
const localTime = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
// Shows the time exactly as the participant recorded it, with its offset; no conversion, minute precision.
function recorded(source: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(source)
  if (!m) return source
  return `${Number(m[3])} ${MONTHS[Number(m[2])-1]} ${m[1]}, ${m[4]}:${m[5]} (UTC${m[6]==='Z' ? '' : m[6]})`
}
class SaveError extends Error { constructor(message: string, public status = 0) { super(message) } }
const UNCONFIRMED = 'The save could not be confirmed. Your form is kept: retry without changing it and it will not be saved twice.'
export function ListeningHome({ place }: { place?: ListeningPlaceProps } = {}) {
  const returnTo = encodeURIComponent(place ? `/place/${place.slug}/listen` : '/listen')
  const readUrl = place ? `/api/listen?place=${encodeURIComponent(place.slug)}` : '/api/listen'
  const [home,setHome] = useState<Home | null>(null), [error,setError] = useState(''), [errorStatus,setErrorStatus] = useState(0), [busy,setBusy] = useState(false), [notice,setNotice] = useState('')
  const [selected,setSelected] = useState(''), [name,setName] = useState(''), [county,setCounty] = useState('')
  const [placeId,setPlaceId] = useState(''), [visitId,setVisitId] = useState('')
  const [time,setTime] = useState(''), [birds,setBirds] = useState(''), [wind,setWind] = useState(''), [weather,setWeather] = useState(''), [note,setNote] = useState(''), [completed,setCompleted] = useState(false), [adult,setAdult] = useState(false)
  const [deleteId,setDeleteId] = useState('')
  function fail(e: unknown, fallback: string) { setError(e instanceof Error && e.message ? e.message : fallback); setErrorStatus(e instanceof SaveError ? e.status : 0) }
  async function call(init?: RequestInit) {
    let res: Response
    try { res = await fetch(init ? '/api/listen' : readUrl,{cache:'no-store',...init}) } catch { throw new SaveError(init ? UNCONFIRMED : 'Your places could not be loaded. Check your connection and reload.') }
    const data = await res.json().catch(() => null)
    if (!res.ok || !data) throw new SaveError(data?.error || (init ? UNCONFIRMED : 'Your places could not be loaded. Please reload.'), res.status)
    return data
  }
  const send = (input: Record<string,unknown>) => call({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)})
  async function load() { const data = await call() as Home; setHome(data); return data }
  // The identifier is kept across retries, so a lost response never creates a second history.
  const beginId = useRef('')
  // Place mode: the participant chose to listen here, so open (or reuse) their single private history for this Place.
  async function open() {
    let data = await call() as Home
    if (place && !data.plots.length) {
      beginId.current = beginId.current || crypto.randomUUID()
      await send({action:'place_listen',id:beginId.current,slug:place.slug})
      data = await call() as Home
    }
    return data
  }
  useEffect(() => {
    let active = true
    setTime(localTime())
    open().then((data: Home) => { if (!active) return; setHome(data); if (data.plots.length) setSelected(s => s || data.plots[0].id) }).catch(e => { if (active) fail(e, 'Your places could not be loaded') })
    return () => { active = false }
  },[])
  const refresh = () => load().catch(() => { setError('Saved. Your places could not be refreshed just now.'); setErrorStatus(0) })
  async function createPlace(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    const id = placeId || crypto.randomUUID(); setPlaceId(id)
    try { await send({action:'place',id,name,county}); setPlaceId(''); setName(''); setCounty(''); setSelected(id); setNotice('Your place is saved. Its first visit begins the memory.'); await refresh() }
    catch(e) { fail(e, UNCONFIRMED) } finally { setBusy(false) }
  }
  async function createVisit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('')
    const id = visitId || crypto.randomUUID(); setVisitId(id)
    try {
      // The browser interprets the participant-entered local time and supplies its offset.
      const date = new Date(time), offset = -date.getTimezoneOffset(), sign = offset >= 0 ? '+' : '-'
      const zone = sign + String(Math.floor(Math.abs(offset)/60)).padStart(2,'0') + ':' + String(Math.abs(offset)%60).padStart(2,'0')
      await send({action:'visit',id,plotId:selected,observedAt:time+':00'+zone,birds,wind,weather,note,completed,adult})
      setVisitId(''); setBirds(''); setWind(''); setWeather(''); setNote(''); setCompleted(false); setTime(localTime()); setNotice('Visit saved. Thank you for giving this place five minutes of attention.'); await refresh()
    } catch(e) { fail(e, UNCONFIRMED) } finally { setBusy(false) }
  }
  async function removePlace() {
    setBusy(true); setError('')
    try { await send({action:'delete',id:deleteId}); if (selected===deleteId) setSelected(''); setDeleteId(''); beginId.current = ''; setNotice(place ? 'Your listening history here was deleted from the active service.' : 'Place and its visits deleted from the active service.'); await refresh() }
    catch(e) { fail(e, 'Deletion could not be confirmed. Reload your places to check, then retry.') } finally { setBusy(false) }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({exportedAt:new Date().toISOString(),scope:place ? `Private listening history at ${place.title} only` : 'Ireland Listens pilot records only',...home},null,2)],{type:'application/json'}))
    const a = document.createElement('a'); a.href=url; a.download='my-listening-history.json'; a.style.display='none'
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const current = home?.plots.find(p=>p.id===selected)
  const visits = home?.visits.filter(v=>v.plotId===selected) || []
  return <section aria-label="Your listening places">
    {error && <div className="listen-alert" role="alert"><p>{error}</p><button disabled={busy} onClick={()=>{setError('');open().then(data=>{setHome(data);if (data.plots.length) setSelected(s => s || data.plots[0].id)}).catch(e=>fail(e,'Your places could not be loaded'))}}>Reload my places</button>{errorStatus===403 && <> <Link href={`/verify-email?callbackUrl=${returnTo}`}>Verify email</Link></>}{errorStatus===401 && <> <Link href={`/login?callbackUrl=${returnTo}`}>Sign in again</Link></>}</div>}
    {notice && <p className="listen-notice" role="status">{notice}</p>}
    {!home ? !error && <p role="status">Opening your place memories…</p> : <>
      <div className="listen-heading"><h2>{place ? 'Your private listening history here' : 'Your listening places'}</h2><button onClick={download}>Download my history</button></div>
      {!place && <div className="listen-plots">{home.plots.map(p=><button key={p.id} aria-pressed={selected===p.id} onClick={()=>{setSelected(p.id);setVisitId('');setDeleteId('')}}><span>{p.county}</span><strong>{p.name}</strong><small>{home.visits.filter(v=>v.plotId===p.id).length} listening visits · Private</small></button>)}</div>}
      {place && !home.plots.length && <div className="listen-card"><p>You have no listening history at {place.title}.</p><button className="listen-button" disabled={busy} onClick={()=>{setBusy(true);setError('');setNotice('');open().then(data=>{setHome(data);if (data.plots.length) setSelected(data.plots[0].id)}).catch(e=>fail(e,UNCONFIRMED)).finally(()=>setBusy(false))}}>Begin a listening history here</button></div>}
      {!place && home.plots.length<3 && <form className="listen-card" onSubmit={createPlace}><h3>{home.plots.length ? 'Add another familiar place' : 'Give your place a name'}</h3><p>A nickname is enough. Please leave out addresses, sensitive species locations and anyone else’s personal details.</p><fieldset disabled={busy}><div className="listen-fields"><label>Private nickname<input required maxLength={80} value={name} onChange={e=>{setName(e.target.value);setPlaceId('')}} placeholder="The garden bench" /></label><label>County<select required value={county} onChange={e=>{setCounty(e.target.value);setPlaceId('')}}><option value="">Choose a county</option>{COUNTIES.map(c=><option key={c}>{c}</option>)}</select></label></div><button className="listen-button" type="submit">{busy ? 'Saving…' : 'Save my place'}</button></fieldset></form>}
      {current && <div className="listen-workspace"><form className="listen-card" onSubmit={createVisit}><p className="listen-eyebrow">Your next quiet moment · {place ? place.title : current.county}</p><h2>Listen at {place ? place.title : current.name}</h2><p>Sit or stand safely at your usual spot. Listen for five minutes without playing calls. You do not need to identify a species. Try returning at a similar local time and in similar weather.</p><fieldset disabled={busy} onChange={()=>setVisitId('')}>
        <label>When did you listen?<input type="datetime-local" required value={time} onChange={e=>setTime(e.target.value)} /><small>Your device’s time zone is used. Check it matches your visit.</small></label>
        <label>Did you hear birds?<select required value={birds} onChange={e=>setBirds(e.target.value)}><option value="">Choose your observation</option><option value="heard">I heard birds</option><option value="not_heard">I did not hear birds during this visit</option><option value="unsure">I’m unsure</option></select></label>
        <div className="listen-fields"><label>Wind<select required value={wind} onChange={e=>setWind(e.target.value)}><option value="">Choose</option><option value="calm">Calm</option><option value="breezy">Breezy</option><option value="windy">Windy</option></select></label><label>Weather<select required value={weather} onChange={e=>setWeather(e.target.value)}><option value="">Choose</option><option value="dry">Dry</option><option value="rain">Raining</option></select></label></div>
        <label>A small detail you noticed <small>(optional, private)</small><textarea maxLength={500} rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Something you want to remember about this visit…" /></label>
        <label className="listen-check"><input type="checkbox" checked={completed} onChange={e=>setCompleted(e.target.checked)} required />I completed five minutes at this place.</label><label className="listen-check"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)} required />I am 18 or over. I have not included another person’s personal details.</label>
        <button className="listen-button" type="submit">{busy ? 'Confirming your visit…' : 'Save this moment'}</button>
      </fieldset></form><aside className="listen-card"><p className="listen-eyebrow">{place ? 'Private listening history' : 'Place memory'}</p><h2>{visits.length ? `${visits.length} quiet moments` : 'A beginning, waiting for you.'}</h2><p>{visits.length ? 'These are your observations, newest first. They do not yet establish a change in bird populations.' : 'Your first visit will appear here. Come back to the same spot to build its history.'}</p><ol className="listen-timeline">{visits.map(v=><li key={v.id}><time dateTime={v.payload.sourceTime}>{recorded(v.payload.sourceTime)}</time><strong>{v.payload.birds==='heard' ? 'Birds heard' : v.payload.birds==='not_heard' ? 'No birds heard in this visit' : 'Unsure'}</strong><span>{v.payload.wind} · {v.payload.weather} · 5 minutes</span>{v.payload.note && <p>{v.payload.note}</p>}<small>Participant observation · Unverified · Saved {recorded(new Date(v.receivedAt).toISOString().slice(0,16) + 'Z')}</small></li>)}</ol><p className="listen-small">Method: five-minute listening visit v1. Time and weather affect what can be heard. Species identification, audio analysis and national trends are not part of this pilot.</p></aside></div>}
      {current && <section className="listen-delete"><button disabled={busy} onClick={()=>setDeleteId(current.id)}>{place ? 'Delete my listening history here' : 'Delete this place and its visits'}</button>{deleteId && <div role="alert"><p>{place ? `Delete all your listening visits and any observations you made at ${place.title}?` : `Delete ${current.name} and all its listening visits?`} Download your history first if you want to keep a copy. This cannot be undone here. Backups follow the service’s retention policy.</p><button disabled={busy} onClick={removePlace}>Confirm deletion</button> <button onClick={()=>setDeleteId('')}>Keep my place</button></div>}</section>}
    </>}
  </section>
}
