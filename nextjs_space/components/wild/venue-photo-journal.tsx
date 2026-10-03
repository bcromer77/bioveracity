'use client'

import { EvidenceLink } from '@/components/evidence-link'



import { useEffect, useState } from 'react'
import Link from 'next/link'

type Photo = { id: string; caption: string; credit: string; location: string; observedOn: string | null; createdAt: string; status: string; revision: number; reason: string }
const statusLabel: Record<string, string> = { RECEIVED: 'Private · ready to review', REVIEW: 'Awaiting editorial review', PUBLISHED: 'Published', REJECTED: 'Changes requested' }
const seasons = ['Winter', 'Spring', 'Summer', 'Autumn']
function seasonOf(date: string | null) {
  if (!date) return 'unknown'
  return seasons[Math.floor((Number(date.slice(5, 7)) % 12) / 3)]
}
const imageUrl = (id: string) => `/api/wild/journal/photos/${encodeURIComponent(id)}?mode=owner`
const taken = (p: Photo) => p.observedOn || 'Date unknown'

export function VenuePhotoJournal({ hubId }: { hubId: string }) {
  // A venue change must clear private photos and outstanding selections immediately.
  return <PhotoDesk key={hubId} hubId={hubId} />
}

function PhotoDesk({ hubId }: { hubId: string }) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [settings, setSettings] = useState({ contributionsEnabled: false, weeklyEnabled: false })
  const [year, setYear] = useState('all'), [season, setSeason] = useState('all'), [status, setStatus] = useState('all'), [search, setSearch] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(true)
  const endpoint = `/api/wild/journal/hubs/${encodeURIComponent(hubId)}`
  async function api(method = 'GET', data?: unknown) {
    const r = await fetch(endpoint, { method, headers: data ? { 'Content-Type': 'application/json' } : undefined, body: data ? JSON.stringify(data) : undefined })
    const j = await r.json()
    if (!r.ok) throw Error(j.error || 'Please try again.')
    return j
  }
  useEffect(() => {
    let active = true
    api().then(j => { if (active) { setPhotos(j.photos); setSettings(j.settings) } })
      .catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setBusy(false) })
    return () => { active = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  async function change(data: unknown, success: string) {
    setBusy(true); setError(''); setMessage('')
    try {
      await api('PATCH', data)
      const j = await api()
      setPhotos(j.photos); setSettings(j.settings)
      setSelected(ids => ids.filter(id => j.photos.some((p: Photo) => p.id === id)))
      setMessage(success)
    } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.') }
    finally { setBusy(false) }
  }
  const years = Array.from(new Set(photos.flatMap(p => p.observedOn ? [p.observedOn.slice(0, 4)] : []))).sort().reverse()
  const shown = photos.filter(p =>
    (year === 'all' || (year === 'unknown' ? !p.observedOn : p.observedOn?.startsWith(year))) &&
    (season === 'all' || seasonOf(p.observedOn) === season) &&
    (status === 'all' || p.status === status) &&
    `${p.caption} ${p.credit} ${p.location}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
  ).sort((a, b) => (b.observedOn || '').localeCompare(a.observedOn || '') || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
  const inspected = selected.flatMap(id => photos.find(p => p.id === id) || [])
  function select(id: string) {
    setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : ids.length < 2 ? [...ids, id] : ids)
  }
  function actions(p: Photo) {
    return <div className="bv-photo-actions">
      <div className="bv-actions">
        <EvidenceLink className="bv-button" href={`${imageUrl(p.id)}&download=1`}>Download photo</EvidenceLink>
        <EvidenceLink href={`${imageUrl(p.id)}&metadata=1`}>Download date and credit</EvidenceLink>
      </div>
      <div className="bv-actions">
        {['RECEIVED', 'REJECTED'].includes(p.status) && <button className="bv-button bv-green" disabled={busy} onClick={() => {
          if (window.confirm('Approve this photograph, caption, location and credit for your public page? It will go through editorial review before publication.'))
            change({ action: 'submit', photoId: p.id, revision: p.revision }, 'Submitted for editorial review. It remains private until approved.')
        }}>Publish to public page</button>}
        {['PUBLISHED', 'REVIEW'].includes(p.status) && <button className="bv-button" disabled={busy} onClick={() => change({ action: 'unpublish', photoId: p.id, revision: p.revision }, 'Photograph is private again.')}>{p.status === 'PUBLISHED' ? 'Unpublish' : 'Cancel submission'}</button>}
        <button disabled={busy} className="bv-text-link" onClick={() => {
          if (window.confirm('Withdraw this photograph and delete its stored image? Download a permitted copy first if needed.'))
            change({ action: 'withdraw', photoId: p.id, revision: p.revision }, 'Photograph withdrawn and stored image deleted.')
        }}>Withdraw photograph</button>
      </div>
    </div>
  }
  return <section className="bv-section bv-photo-desk">
    <header className="bv-photo-heading">
      <p className="bv-eyebrow">Everyone sees something different.</p><h1>Your photo journal</h1>
      <p>One place, seen through many eyes. Choose a photograph. Look closer. See what the seasons bring.</p>
      <div className="bv-actions"><Link href={`/wild/studio?hub=${encodeURIComponent(hubId)}`}>Back to venue studio</Link><Link href={`/wild/places/${encodeURIComponent(hubId)}`}>View public page</Link></div>
    </header>
    {error && <p role="alert" className="bv-error">{error}</p>}{message && <p role="status">{message}</p>}{busy && <p role="status">Loading or saving…</p>}
    <details className="bv-photo-preferences" id="preferences">
      <summary>Contributions and weekly email</summary>
      <fieldset className="bv-form" disabled={busy}><legend>Your preferences</legend>
        <label className="bv-check"><input type="checkbox" checked={settings.contributionsEnabled} onChange={e => setSettings({ ...settings, contributionsEnabled: e.target.checked })} />Accept guest photographs on your published venue page</label>
        <label className="bv-check"><input type="checkbox" checked={settings.weeklyEnabled} onChange={e => setSettings({ ...settings, weeklyEnabled: e.target.checked })} />Email me a weekly photo review</label>
        <p>One email per venue, covering the previous Monday–Sunday in UTC. Up to twelve previews link to your complete journal. Your account’s weekly-summary preference also applies. Nothing publishes automatically.</p>
        <button className="bv-button bv-green" onClick={() => change({ action: 'settings', ...settings }, 'Photo and email preferences saved.')}>Save preferences</button>
        <p>This pilot holds 200 journal photographs per venue, separate from your venue gallery. Downloads are processed images with embedded location metadata removed.</p>
      </fieldset>
    </details>
    <div className="bv-photo-filters" role="group" aria-label="Filter photographs">
      <label htmlFor="photo-year">Year photographed<select id="photo-year" value={year} onChange={e => setYear(e.target.value)}><option value="all">All years</option>{years.map(y => <option key={y} value={y}>{y}</option>)}<option value="unknown">Date unknown</option></select></label>
      <label htmlFor="photo-season">UK season<select id="photo-season" value={season} onChange={e => setSeason(e.target.value)}><option value="all">All seasons</option>{seasons.map(s => <option key={s}>{s}</option>)}</select></label>
      <label htmlFor="photo-status">Publication<select id="photo-status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All photographs</option>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label htmlFor="photo-search">Find a photograph<input id="photo-search" type="search" placeholder="Caption, photographer or place" value={search} onChange={e => setSearch(e.target.value)} /></label>
    </div>
    <p className="bv-photo-count" role="status">{shown.length} of {photos.length} photographs · Newest known observation dates first.</p>
    {!!inspected.length && <section className="bv-photo-inspector" aria-label="Selected photographs">
      <div className="bv-photo-inspector-title"><h2>{inspected.length === 2 ? 'Across time. Side by side.' : 'A closer look.'}</h2><button className="bv-button" onClick={() => setSelected([])}>Clear selection</button></div>
      <p>{inspected.length === 2 ? 'Compare the recorded dates and places. Different viewpoints, seasons and cameras can change how a place appears.' : 'Select a second photograph to compare. Selections stay here while you browse other years.'}</p>
      <div className={`bv-photo-compare ${inspected.length === 1 ? 'bv-photo-single' : ''}`}>
        {inspected.map(p => <figure key={p.id}>
          <EvidenceLink href={imageUrl(p.id)} target="_blank" rel="noopener noreferrer" aria-label={`Open full frame: ${p.caption}`}><img src={imageUrl(p.id)} alt={p.caption} /></EvidenceLink>
          <figcaption><p className="bv-eyebrow">{taken(p)} · {p.location}</p><h3>{p.caption}</h3><p>Photograph by {p.credit}</p><p>{statusLabel[p.status] || p.status}</p><p>Community photograph · identification unverified</p>{p.reason && <p>Editorial note: {p.reason}</p>}</figcaption>
          <button className="bv-text-link" onClick={() => select(p.id)} aria-label={`Remove from comparison: ${p.caption}`}>Remove from comparison</button>
          {actions(p)}
        </figure>)}
      </div>
    </section>}
    {!busy && !photos.length && <p>No guest photographs yet. Open contributions and weekly email above, then invite guests to use your venue’s QR page.</p>}
    {!busy && !!photos.length && !shown.length && <p>No photographs match these filters. <button className="bv-text-link" onClick={() => { setYear('all'); setSeason('all'); setStatus('all'); setSearch('') }}>Clear filters</button></p>}
    {!!shown.length && <p className="bv-photo-help">Select up to two photographs to inspect, compare, publish or download. Unknown dates stay unknown.</p>}
    <div className="bv-contact-sheet">{shown.map(p => <figure key={p.id}>
      <button className="bv-photo-select" aria-label={`Select photograph: ${p.caption}`} aria-pressed={selected.includes(p.id)} disabled={selected.length === 2 && !selected.includes(p.id)} onClick={() => select(p.id)}>
        <img src={imageUrl(p.id)} alt={p.caption} loading="lazy" /><span>{selected.includes(p.id) ? 'Selected' : 'Select photograph'}</span>
      </button>
      <figcaption><p className="bv-eyebrow">{taken(p)}</p><h3>{p.caption}</h3><p>{p.credit} · {p.location}</p><p>{statusLabel[p.status] || p.status}</p><p className="bv-photo-added">Added {new Date(p.createdAt).toLocaleDateString('en-GB', { timeZone: 'UTC' })}</p></figcaption>
    </figure>)}</div>
  </section>
}
