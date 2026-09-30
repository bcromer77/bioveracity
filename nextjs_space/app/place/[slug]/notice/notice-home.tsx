'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

// PILOT-001 NE demo. Three evidence classes are kept visibly apart on one screen:
// the public institutional record (read-only counts), what the participant notices
// (private, unverified), and what they notice when they return (their own history).
// Nothing here identifies, scores, validates or publishes an observation.
export type PublicRecordSummary = { categories: { id: string; label: string; count: number }[]; dated: number }
type Place = { slug: string; title: string; mapCentre: { lat: number; lng: number } | null }
type Kind = 'PHOTO' | 'SOUND' | 'NOTE'
type Observation = { id: string; kind: Kind; category: string; observedAt: string; observedAtSource: string; observedAtProvenance: string; receivedAt: string; note: string | null; participantIdentification: string | null; participantConfidence: string | null; locationMethod: string; capturedAccuracyM: number | null; locationSharing: string; mime: string | null; byteLength: number | null; durationMs: number | null; hasDisplay: boolean }
type Visit = { id: string; receivedAt: string; payload: { observedAt: string; sourceTime: string; birds: string; wind: string; weather: string; note: string } }
type History = { observations: Observation[]; visits: Visit[]; statusLabel: string }
type Loc = { method: 'DEVICE'; lat: number; lng: number; accuracyM: number } | { method: 'MAP_APPROXIMATE'; lat: number; lng: number; cell: string } | { method: 'NONE' }

const STATUS = 'Participant observation · Unverified'
const CATEGORY: [string, string][] = [['ANIMAL', 'Animal'], ['PLANT', 'Plant'], ['WATER', 'Water'], ['HABITAT', 'Habitat'], ['DISTURBANCE', 'Pollution or disturbance'], ['OTHER', 'Something else']]
const CONFIDENCE: [string, string][] = [['NOT_SURE', 'Not sure'], ['FAIRLY_SURE', 'Fairly sure'], ['CERTAIN', 'Certain']]
const SHARING: [string, string, string][] = [['PRIVATE', 'Keep exact location private', 'Only you can see it.'], ['APPROXIMATE', 'Share approximate location', 'Rounded to about 1 km if it is ever used.'], ['EXACT', 'Share exact location', 'As precise as it was recorded, never more.']]
const label = (list: [string, string, ...string[]][], id: string | null) => list.find(([k]) => k === id)?.[1] ?? ''
const KIND_LABEL: Record<Kind, string> = { PHOTO: 'Photo', SOUND: 'Sound', NOTE: 'Note' }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')
// Local wall time with the device's own offset, second precision: the participant's time as they experienced it.
function withOffset(d: Date) {
  const o = -d.getTimezoneOffset(), s = o >= 0 ? '+' : '-'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${s}${pad(Math.floor(Math.abs(o) / 60))}:${pad(Math.abs(o) % 60)}`
}
function recorded(source: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d{3})?)?(Z|[+-]\d{2}:\d{2})$/.exec(source)
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}, ${m[4]}:${m[5]} (UTC${m[6] === 'Z' ? '' : m[6]})` : source
}
const utc = (iso: string) => recorded(new Date(iso).toISOString().slice(0, 19) + 'Z')
const duration = (ms: number | null) => ms == null ? '' : `${Math.floor(ms / 60000)}:${pad(Math.round(ms / 1000) % 60)}`
function locationText(o: { locationMethod: string; capturedAccuracyM: number | null; locationSharing: string }) {
  if (o.locationMethod === 'NONE') return 'No location recorded'
  const how = o.locationMethod === 'DEVICE' ? `Current location (device accuracy about ${Math.round(o.capturedAccuracyM ?? 0)} m)` : 'Chosen approximately on the map'
  return `${how} · ${label(SHARING, o.locationSharing)}`
}
// About 2–3 km squares around the Place centre. A tap records the square's centre as approximate, with no accuracy claimed.
const GRID = { rows: 7, cols: 5, step: 0.025 }

class SaveError extends Error { constructor(message: string, public status = 0) { super(message) } }
const UNCONFIRMED = 'The save could not be confirmed. Your observation is kept on this screen: retry and it will not be saved twice.'

export function NoticeHome({ place, publicRecord, listenHref }: { place: Place; publicRecord: PublicRecordSummary; listenHref: string | null }) {
  const readUrl = `/api/listen/observations?place=${encodeURIComponent(place.slug)}`
  const [history, setHistory] = useState<History | null>(null), [loadError, setLoadError] = useState('')
  const [step, setStep] = useState(0) // 0 = invitation, 1..6 = steps, 7 = saved
  const [category, setCategory] = useState(''), [kind, setKind] = useState<Kind | ''>('')
  const [file, setFile] = useState<Blob | null>(null), [preview, setPreview] = useState(''), [durationMs, setDurationMs] = useState<number | null>(null)
  const [note, setNote] = useState(''), [mediaMessage, setMediaMessage] = useState('')
  const [recording, setRecording] = useState(false), [elapsed, setElapsed] = useState(0)
  const [startedAt, setStartedAt] = useState(''), [corrected, setCorrected] = useState(''), [timeMode, setTimeMode] = useState<'NOW' | 'CORRECTED'>('NOW')
  const [loc, setLoc] = useState<Loc | null>(null), [locMessage, setLocMessage] = useState(''), [locating, setLocating] = useState(false), [showMap, setShowMap] = useState(false)
  const [sharing, setSharing] = useState('PRIVATE')
  const [identification, setIdentification] = useState(''), [confidence, setConfidence] = useState('')
  const [adult, setAdult] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [errorStatus, setErrorStatus] = useState(0)
  const [saved, setSaved] = useState<Record<string, string> | null>(null), [deleteId, setDeleteId] = useState(''), [notice, setNotice] = useState('')
  const recorder = useRef<MediaRecorder | null>(null), chunks = useRef<Blob[]>([]), recordStart = useRef(0), timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const submissionId = useRef(''), stepHeading = useRef<HTMLHeadingElement | null>(null)

  async function fetchHistory(): Promise<History> {
    const res = await fetch(readUrl, { cache: 'no-store' }).catch(() => null)
    const data = res ? await res.json().catch(() => null) : null
    if (!res || !res.ok || !data) throw new Error(data?.error || 'Your memory of this place could not be loaded. Check your connection and reload.')
    return data
  }
  async function load() { const data = await fetchHistory(); setHistory(data); setLoadError('') }
  useEffect(() => {
    let live = true
    fetchHistory().then(data => { if (live) { setHistory(data); setLoadError('') } }, e => { if (live) setLoadError(e.message) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per Place page
  }, [readUrl])
  useEffect(() => { if (step > 0) stepHeading.current?.focus() }, [step])
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  // Any change to the observation makes it a new submission; an unchanged retry reuses its identifier.
  useEffect(() => { submissionId.current = '' }, [category, kind, file, note, timeMode, corrected, loc, sharing, identification, confidence, adult])
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); recorder.current?.stream.getTracks().forEach(t => t.stop()) }, [])

  function begin() {
    setCategory(''); setKind(''); setMedia(null, null); setNote(''); setMediaMessage(''); setTimeMode('NOW'); setCorrected('')
    setLoc(null); setLocMessage(''); setShowMap(false); setSharing('PRIVATE'); setIdentification(''); setConfidence(''); setError(''); setSaved(null); setNotice('')
    const now = new Date(); now.setMilliseconds(0); setStartedAt(withOffset(now)); setStep(1)
  }
  function setMedia(blob: Blob | null, ms: number | null) {
    setFile(blob); setDurationMs(ms); setPreview(blob ? URL.createObjectURL(blob) : '')
  }
  function choose(e: React.ChangeEvent<HTMLInputElement>, which: 'PHOTO' | 'SOUND') {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    const limit = which === 'PHOTO' ? 8 : 10
    if (f.size > limit * 1024 * 1024) { setMediaMessage(`This file is larger than ${limit} MB. Choose a smaller one.`); return }
    setMediaMessage(''); setMedia(f, null)
    if (which === 'SOUND') {
      const probe = new Audio(); const url = URL.createObjectURL(f)
      probe.preload = 'metadata'; probe.onloadedmetadata = () => { if (Number.isFinite(probe.duration)) setDurationMs(Math.round(probe.duration * 1000)); URL.revokeObjectURL(url) }
      probe.onerror = () => URL.revokeObjectURL(url); probe.src = url
    }
  }
  async function startRecording() {
    setMediaMessage('')
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { setMediaMessage('This browser cannot record here. You can upload a sound recording instead.'); return }
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) }
    catch { setMediaMessage('Microphone access was not allowed, so nothing was recorded. You can allow it in your browser settings, upload a recording, or write a note instead.'); return }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t))
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
    chunks.current = []; recorder.current = rec
    rec.ondataavailable = ev => { if (ev.data.size) chunks.current.push(ev.data) }
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop()); if (timer.current) clearInterval(timer.current)
      setRecording(false); setMedia(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }), Date.now() - recordStart.current)
    }
    recordStart.current = Date.now(); setElapsed(0); setMedia(null, null); rec.start(1000); setRecording(true)
    timer.current = setInterval(() => { const ms = Date.now() - recordStart.current; setElapsed(ms); if (ms >= 10 * 60000) rec.stop() }, 250)
  }
  function locate() {
    setLocMessage(''); setShowMap(false)
    if (!navigator.geolocation) { setLocMessage('This browser cannot share your location. Choose on the map or record no location.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      p => { setLocating(false); setLoc({ method: 'DEVICE', lat: p.coords.latitude, lng: p.coords.longitude, accuracyM: p.coords.accuracy }) },
      err => { setLocating(false); setLoc(null); setLocMessage(err.code === err.PERMISSION_DENIED ? 'Location access was not allowed, so no location was recorded. You can choose approximately on the map or record no location.' : 'Your location could not be found. Try again, choose on the map or record no location.') },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  const observedAtSource = () => timeMode === 'NOW' ? startedAt : withOffset(new Date(corrected))
  const canContinue = [false, !!category, kind === 'NOTE' ? note.trim().length > 0 : !!file && !recording, timeMode === 'NOW' || !!corrected, !!loc, !confidence || !!identification.trim(), adult][step]

  async function save() {
    if (!loc || !kind) return
    setBusy(true); setError(''); setErrorStatus(0)
    submissionId.current = submissionId.current || crypto.randomUUID()
    const meta = {
      id: submissionId.current, slug: place.slug, kind, category, observedAt: observedAtSource(), observedAtProvenance: timeMode === 'NOW' ? 'DEVICE_NOW' : 'PARTICIPANT_CORRECTED',
      note: note.trim() || null, participantIdentification: identification.trim() || null, participantConfidence: identification.trim() && confidence ? confidence : null,
      locationMethod: loc.method, locationSharing: loc.method === 'NONE' ? 'PRIVATE' : sharing,
      ...(loc.method === 'NONE' ? {} : { lat: loc.lat, lng: loc.lng }), ...(loc.method === 'DEVICE' ? { accuracyM: loc.accuracyM } : {}),
      ...(kind === 'SOUND' && durationMs != null ? { durationMs: Math.round(durationMs) } : {}), adult,
    }
    const form = new FormData(); form.set('meta', JSON.stringify(meta))
    if (kind !== 'NOTE' && file) form.set('media', file, kind === 'PHOTO' ? 'photo' : 'sound')
    try {
      let res: Response
      try { res = await fetch('/api/listen/observations', { method: 'POST', body: form }) } catch { throw new SaveError(UNCONFIRMED) }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) throw new SaveError(data?.error || UNCONFIRMED, res.status)
      setSaved({ kind, observedAt: recorded(meta.observedAt), provenance: meta.observedAtProvenance, note: meta.note ?? '', identification: meta.participantIdentification ?? '', confidence: label(CONFIDENCE, meta.participantConfidence), location: locationText({ locationMethod: loc.method, capturedAccuracyM: loc.method === 'DEVICE' ? loc.accuracyM : null, locationSharing: meta.locationSharing }), duration: duration(meta.durationMs ?? null) })
      submissionId.current = ''; setStep(7)
      load().catch(() => setNotice('Saved. Your memory could not be refreshed just now; reload to see it.'))
    } catch (e) { setError(e instanceof Error ? e.message : UNCONFIRMED); setErrorStatus(e instanceof SaveError ? e.status : 0) }
    finally { setBusy(false) }
  }
  async function remove(id: string) {
    setBusy(true); setNotice('')
    try {
      const res = await fetch('/api/listen/observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error || 'Deletion could not be confirmed. Reload to check, then retry.')
      setDeleteId(''); setNotice('That observation and its media were deleted from the active service.'); await load()
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Deletion could not be confirmed.') } finally { setBusy(false) }
  }
  function download() {
    const body = { exportedAt: new Date().toISOString(), scope: `Your private memory of ${place.title} in this demonstration`, status: STATUS, note: 'Media files are not embedded. Download each original from its entry.', observations: history?.observations ?? [], listeningVisits: history?.visits ?? [] }
    const url = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'my-place-memory.json'; a.style.display = 'none'
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function downloadOriginal(id: string) {
    const a = document.createElement('a'); a.href = `/api/listen/observations/${encodeURIComponent(id)}/media?variant=original`; a.download = ''; a.style.display = 'none'
    document.body.appendChild(a); a.click(); a.remove()
  }

  const items = history ? [
    ...history.observations.map(o => ({ at: o.observedAt, key: 'o' + o.id, o })),
    ...history.visits.map(v => ({ at: v.payload.observedAt, key: 'v' + v.id, v })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key)) : []
  const mapCells = place.mapCentre ? Array.from({ length: GRID.rows * GRID.cols }, (_, i) => {
    const r = Math.floor(i / GRID.cols), c = i % GRID.cols
    return { id: `${r}-${c}`, lat: +(place.mapCentre!.lat + (Math.floor(GRID.rows / 2) - r) * GRID.step).toFixed(4), lng: +(place.mapCentre!.lng + (c - Math.floor(GRID.cols / 2)) * GRID.step * 1.7).toFixed(4), centre: r === Math.floor(GRID.rows / 2) && c === Math.floor(GRID.cols / 2) }
  }) : []
  const stepTitles = ['', 'What did you notice?', 'Record it', 'When did you notice it?', 'Where were you?', 'What do you think you noticed?', 'Save your observation']

  return <div className="notice-home">
    <section className="notice-panel notice-public" aria-labelledby="public-record">
      <p className="notice-class">Institutional evidence · Public sources</p>
      <h2 id="public-record">What the public record knows</h2>
      <ul className="notice-counts">{publicRecord.categories.map(c => <li key={c.id} data-category={c.id}><strong>{c.count}</strong><span>{c.label}</span></li>)}<li data-category="dated"><strong>{publicRecord.dated}</strong><span>Dated public records</span></li></ul>
      <p className="listen-small">From published institutional sources. Your observations are never added to these numbers, the public search or the public timeline.</p>
    </section>

    <section className="notice-panel notice-you" aria-labelledby="you-notice">
      <p className="notice-class notice-class-you">{STATUS} · Private to you</p>
      <h2 id="you-notice">What you notice</h2>
      {step === 0 && <div className="notice-invite"><p className="listen-eyebrow">Notice this place</p><p className="notice-lead">What have you seen, heard or noticed?</p><button className="listen-button notice-primary" onClick={begin}>Make an observation →</button></div>}
      {step >= 1 && step <= 6 && <div className="notice-step">
        <p className="notice-progress" aria-hidden="true">{[1, 2, 3, 4, 5, 6].map(n => <span key={n} data-done={n <= step} />)}</p>
        <h3 ref={stepHeading} tabIndex={-1}><span className="notice-stepno">Step {step} of 6</span>{stepTitles[step]}</h3>
        {step === 1 && <div className="notice-choices" role="group" aria-label="What did you notice?">{CATEGORY.map(([id, text]) => <button key={id} type="button" aria-pressed={category === id} onClick={() => { setCategory(id); setStep(2) }}>{text}</button>)}<p className="listen-small">Choose the closest. BioVeracity does not classify it for you.</p></div>}
        {step === 2 && <div>
          <div className="notice-choices notice-kinds" role="group" aria-label="How would you like to record it?">{(['PHOTO', 'SOUND', 'NOTE'] as Kind[]).map(k => <button key={k} type="button" aria-pressed={kind === k} disabled={recording} onClick={() => { if (k !== kind) { setKind(k); setMedia(null, null); setMediaMessage('') } }}>{KIND_LABEL[k]}</button>)}</div>
          {kind === 'PHOTO' && <div className="notice-media"><label className="notice-file">Take a photo<input type="file" accept="image/*" capture="environment" onChange={e => choose(e, 'PHOTO')} /></label><label className="notice-file">Upload a photo<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" onChange={e => choose(e, 'PHOTO')} /></label>{preview && <img className="notice-preview" src={preview} alt="Your photo, ready to save" />}</div>}
          {kind === 'SOUND' && <div className="notice-media">{recording ? <button type="button" className="listen-button" onClick={() => recorder.current?.stop()}>Stop recording · {duration(elapsed)}</button> : <button type="button" className="notice-file" onClick={startRecording}>{file ? 'Record again' : 'Record sound'}</button>}<label className="notice-file">Upload a recording<input type="file" accept="audio/*" onChange={e => choose(e, 'SOUND')} disabled={recording} /></label>{recording && <p role="status" className="listen-small">Recording… nothing is analysed or identified.</p>}{preview && <audio className="notice-audio" controls src={preview} aria-label="Your recording, ready to save" />}{file && durationMs != null && <p className="listen-small">Length {duration(durationMs)}</p>}</div>}
          {mediaMessage && <p className="listen-alert" role="alert">{mediaMessage}</p>}
          {kind && <label>{kind === 'NOTE' ? 'Your note' : <>A note <small>(optional)</small></>}<textarea rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="What did you see, hear or notice?" /><small>Private. Please leave out anyone else’s personal details.</small></label>}
          {kind && kind !== 'NOTE' && <p className="listen-small">Your {kind === 'PHOTO' ? 'photo' : 'recording'} stays your own material. It is not identified or analysed.</p>}
        </div>}
        {step === 3 && <div className="notice-choices notice-stack" role="radiogroup" aria-label="When did you notice it?">
          <button type="button" role="radio" aria-checked={timeMode === 'NOW'} onClick={() => setTimeMode('NOW')}>Now<small>{recorded(startedAt)}</small></button>
          <button type="button" role="radio" aria-checked={timeMode === 'CORRECTED'} onClick={() => { setTimeMode('CORRECTED'); setCorrected(c => c || startedAt.slice(0, 16)) }}>Earlier — let me correct it</button>
          {timeMode === 'CORRECTED' && <label>When you noticed it<input type="datetime-local" value={corrected} max={startedAt.slice(0, 16)} onChange={e => setCorrected(e.target.value)} /><small>Your device’s time zone is used. The time we receive it is kept separately.</small></label>}
        </div>}
        {step === 4 && <div>
          <div className="notice-choices notice-stack" role="radiogroup" aria-label="Location">
            <button type="button" role="radio" aria-checked={loc?.method === 'DEVICE'} disabled={locating} onClick={locate}>{locating ? 'Finding your location…' : 'Use my current location'}{loc?.method === 'DEVICE' && <small>Recorded with device accuracy about {Math.round(loc.accuracyM)} m</small>}</button>
            {place.mapCentre && <button type="button" role="radio" aria-checked={loc?.method === 'MAP_APPROXIMATE' || showMap} onClick={() => { setShowMap(true); setLocMessage(''); if (loc?.method !== 'MAP_APPROXIMATE') setLoc(null) }}>Choose approximately on map{loc?.method === 'MAP_APPROXIMATE' && <small>Approximate square chosen</small>}</button>}
            <button type="button" role="radio" aria-checked={loc?.method === 'NONE'} onClick={() => { setLoc({ method: 'NONE' }); setShowMap(false); setLocMessage('') }}>Don’t record my location</button>
          </div>
          {locMessage && <p className="listen-alert" role="alert">{locMessage}</p>}
          {showMap && <div className="notice-map"><p className="listen-small">Tap the square nearest to where you were. Each square is roughly 2–3 km; only the square is recorded.</p><div className="notice-grid" role="group" aria-label={`Approximate squares around ${place.title}`} style={{ gridTemplateColumns: `repeat(${GRID.cols},1fr)` }}>{mapCells.map(c => <button key={c.id} type="button" aria-pressed={loc?.method === 'MAP_APPROXIMATE' && loc.cell === c.id} aria-label={`Square ${c.id}${c.centre ? `, centre of ${place.title}` : ''}`} data-centre={c.centre} onClick={() => setLoc({ method: 'MAP_APPROXIMATE', lat: c.lat, lng: c.lng, cell: c.id })}>{c.centre ? '●' : ''}</button>)}</div><p className="notice-compass listen-small"><span>North ↑</span><span>● {place.title}</span></p></div>}
          {loc && loc.method !== 'NONE' && <fieldset className="notice-sharing"><legend>How may BioVeracity use this location?</legend>{SHARING.map(([id, text, help]) => <label key={id} className="listen-check"><input type="radio" name="sharing" value={id} checked={sharing === id} onChange={() => setSharing(id)} /><span>{text}<small>{help}</small></span></label>)}<p className="listen-small">Nothing is published in this demonstration. A captured location is never made public just because it was captured.</p></fieldset>}
        </div>}
        {step === 5 && <div><p className="listen-small">Optional. This is your own identification, not BioVeracity’s.</p><label>What do you think you noticed?<input maxLength={120} value={identification} onChange={e => { setIdentification(e.target.value); if (!e.target.value.trim()) setConfidence('') }} placeholder="For example: a tern, a seal, an oil sheen" /></label>
          <fieldset className="notice-choices notice-confidence" disabled={!identification.trim()}><legend>How sure are you?</legend>{CONFIDENCE.map(([id, text]) => <button key={id} type="button" aria-pressed={confidence === id} onClick={() => setConfidence(c => c === id ? '' : id)}>{text}</button>)}</fieldset></div>}
        {step === 6 && <div>
          <dl className="notice-summary"><div><dt>Noticed</dt><dd>{label(CATEGORY, category)}</dd></div><div><dt>Recorded as</dt><dd>{kind && KIND_LABEL[kind]}{kind === 'SOUND' && durationMs != null ? ` · ${duration(durationMs)}` : ''}</dd></div><div><dt>Observed</dt><dd>{recorded(observedAtSource())}{timeMode === 'CORRECTED' ? ' · corrected by you' : ''}</dd></div><div><dt>Location</dt><dd>{loc && locationText({ locationMethod: loc.method, capturedAccuracyM: loc.method === 'DEVICE' ? loc.accuracyM : null, locationSharing: loc.method === 'NONE' ? 'PRIVATE' : sharing })}</dd></div>{identification.trim() && <div><dt>Your identification</dt><dd>{identification.trim()}{confidence ? ` · ${label(CONFIDENCE, confidence)}` : ''}</dd></div>}</dl>
          <label className="listen-check"><input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} />I am 18 or over. I have not included another person’s personal details.</label>
          {error && <div className="listen-alert" role="alert"><p>{error}</p>{errorStatus === 401 && <Link href={`/login?callbackUrl=${encodeURIComponent(`/place/${place.slug}/notice`)}`}>Sign in again</Link>}</div>}
          <button type="button" className="listen-button notice-primary" disabled={busy || !adult} onClick={save}>{busy ? 'Saving…' : error ? 'Retry saving — it will not be saved twice' : 'Save observation'}</button>
        </div>}
        {step < 6 && <div className="notice-nav"><button type="button" onClick={() => setStep(s => s - 1)} disabled={recording}>{step === 1 ? 'Cancel' : 'Back'}</button>{step > 1 && <button type="button" className="listen-button" disabled={!canContinue} onClick={() => setStep(s => s + 1)}>{step === 5 && !identification.trim() ? 'Skip' : 'Continue'}</button>}</div>}
        {step === 6 && <div className="notice-nav"><button type="button" onClick={() => setStep(5)} disabled={busy}>Back</button></div>}
      </div>}
      {step === 7 && saved && <div className="notice-saved" role="status">
        <p className="notice-badge">Participant observation · Unverified</p>
        <dl className="notice-summary"><div><dt>Observed</dt><dd>{saved.observedAt}{saved.provenance === 'PARTICIPANT_CORRECTED' ? ' · corrected by you' : ''}</dd></div><div><dt>Media</dt><dd>{KIND_LABEL[saved.kind as Kind]}{saved.duration ? ` · ${saved.duration}` : ''}</dd></div>{saved.note && <div><dt>Your description</dt><dd>{saved.note}</dd></div>}<div><dt>Your identification</dt><dd>{saved.identification || 'None given'}</dd></div><div><dt>Your confidence</dt><dd>{saved.confidence || 'Not given'}</dd></div><div><dt>Location</dt><dd>{saved.location}</dd></div><div><dt>Place</dt><dd>{place.title}</dd></div></dl>
        {saved.kind === 'SOUND' && <div className="notice-again"><h3>Listen here again</h3><p>Return to this place another day and make another recording. Repeated observations can begin to show how your experience of this place changes through time.</p></div>}
        <button type="button" className="listen-button notice-primary" onClick={begin}>Return and notice again</button>
        <p className="listen-small">Each time you return, your private memory of this place grows. It is yours: it is not checked, scored or published.</p>
        <button type="button" onClick={() => setStep(0)}>Done for now</button>
      </div>}
    </section>

    <section className="notice-panel notice-memory" aria-labelledby="my-memory">
      <p className="notice-class notice-class-you">Your private history · Unverified</p>
      <h2 id="my-memory">What you notice when you return</h2>
      <div className="listen-heading"><h3>{`MY ${place.title.toUpperCase()} MEMORY`}</h3>{history && <button type="button" onClick={download}>Download my memory</button>}</div>
      {notice && <p className="listen-notice" role="status">{notice}</p>}
      {loadError && <div className="listen-alert" role="alert"><p>{loadError}</p><button type="button" onClick={() => load().catch(e => setLoadError(e.message))}>Reload my memory</button></div>}
      {!history ? !loadError && <p role="status">Opening your memory of this place…</p> : !items.length ? <p>Nothing yet. Your first observation will appear here, dated. Come back another day to add to it.</p> :
        <ol className="listen-timeline notice-timeline">{items.map(item => 'o' in item && item.o ? <li key={item.key} data-kind={item.o.kind}>
          <time dateTime={item.o.observedAtSource}>{recorded(item.o.observedAtSource)}{item.o.observedAtProvenance === 'PARTICIPANT_CORRECTED' ? ' · corrected by you' : ''}</time>
          <strong>{KIND_LABEL[item.o.kind]} · {label(CATEGORY, item.o.category)}{item.o.kind === 'SOUND' && item.o.durationMs != null ? ` · ${duration(item.o.durationMs)}` : ''}</strong>
          {item.o.kind === 'PHOTO' && item.o.hasDisplay && <img className="notice-thumb" src={`/api/listen/observations/${item.o.id}/media`} alt={`Your photo from ${recorded(item.o.observedAtSource)}`} loading="lazy" />}
          {item.o.kind === 'SOUND' && <audio className="notice-audio" controls preload="none" src={`/api/listen/observations/${item.o.id}/media`} aria-label={`Your recording from ${recorded(item.o.observedAtSource)}`} />}
          {item.o.note && <p>{item.o.note}</p>}
          {item.o.participantIdentification && <span>You thought: {item.o.participantIdentification}{item.o.participantConfidence ? ` (${label(CONFIDENCE, item.o.participantConfidence)})` : ''}</span>}
          <span>{locationText(item.o)}</span>
          <small className="notice-status">{STATUS} · Received {utc(item.o.receivedAt)}</small>
          <span className="notice-actions">{item.o.kind !== 'NOTE' && <button type="button" onClick={() => downloadOriginal(item.o!.id)}>Download original</button>}<button type="button" disabled={busy} onClick={() => setDeleteId(item.o!.id)}>Delete</button></span>
          {deleteId === item.o.id && <span role="alert" className="notice-confirm">Delete this observation and its media? This cannot be undone here. <button type="button" disabled={busy} onClick={() => remove(item.o!.id)}>Confirm deletion</button> <button type="button" onClick={() => setDeleteId('')}>Keep it</button></span>}
        </li> : 'v' in item && item.v ? <li key={item.key} data-kind="LISTENING">
          <time dateTime={item.v.payload.sourceTime}>{recorded(item.v.payload.sourceTime)}</time>
          <strong>Five-minute listening · {item.v.payload.birds === 'heard' ? 'Birds heard' : item.v.payload.birds === 'not_heard' ? 'No birds heard in this visit' : 'Unsure'}</strong>
          <span>{item.v.payload.wind} · {item.v.payload.weather}</span>{item.v.payload.note && <p>{item.v.payload.note}</p>}
          <small className="notice-status">{STATUS}</small>
        </li> : null)}</ol>}
      <p className="listen-small">Oldest first. Repeated observations describe your own experience of this place; they do not establish ecological change, presence or absence, abundance or trend.</p>
      {listenHref && <p><Link href={listenHref} prefetch={false}>Give this place five minutes of listening</Link></p>}
    </section>
  </div>
}
