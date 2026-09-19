'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WILD_COUNTIES } from '@/lib/wild-counties/counties'
import { KINDS, type Profile } from '@/lib/wild-hubs/domain'
import { parseVenueCsv, venueSetupInput, VENUE_CSV_HEADER, type VenueSetupInput } from '@/lib/wild-hubs/onboarding-input'
import type { VenueLaunchRow } from '@/lib/wild-hubs/onboarding'

type List = { places: VenueLaunchRow[]; total: number; page: number; photoBytes: string }
const empty = { reference: '', email: '', profile: { name: '', county: 'down', kind: 'food', story: '', website: '', interests: ['nature'] } as Profile }
const fieldClass = 'block w-full rounded border border-border bg-background p-3'
export function VenueLaunchDesk() {
  const [data, setData] = useState<List | null>(null)
  const [form, setForm] = useState<VenueSetupInput>(empty)
  const [edit, setEdit] = useState<VenueLaunchRow | null>(null)
  const [batch, setBatch] = useState<VenueSetupInput[]>([])
  const [authorised, setAuthorised] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState<{ email: string; name: string; value: string } | null>(null)
  async function api(url: string, method = 'GET', body?: unknown) {
    const response = await fetch(url, { method, cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined })
    const json = await response.json()
    if (!response.ok) throw Error(json.error || 'Unable to complete setup.')
    return json
  }
  async function load(page = 0) { setData(await api(`/api/wild/launch?page=${page}`)) }
  useEffect(() => { load().catch(e => setError(e.message)) }, [])
  async function run(job: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('')
    try { await job() } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.') }
    finally { setBusy(false) }
  }
  function update(key: keyof Profile, value: string) { setForm({ ...form, profile: { ...form.profile, [key]: value } }); setAuthorised(false) }
  async function save() {
    await run(async () => {
      if (edit) await api(`/api/wild/launch/${edit.id}`, 'PATCH', { ...venueSetupInput(form), action: 'edit', revision: edit.revision, authorised })
      else await api('/api/wild/launch', 'POST', { places: batch.length ? batch : [venueSetupInput(form)], authorised })
      setForm(empty); setEdit(null); setBatch([]); setAuthorised(false); setLink(null)
      setMessage('Venue details saved. Issue a setup link when you are ready to hand the place to its owner.')
      await load(data?.page || 0)
    })
  }
  async function change(row: VenueLaunchRow, action: 'issue' | 'revoke') {
    if (action === 'revoke' && !window.confirm(`Revoke the setup link for ${row.profile.name}?`)) return
    if (action === 'issue' && row.expiresAt && !window.confirm('Create a replacement link? The previous link will stop working.')) return
    await run(async () => {
      setLink(null)
      const result = await api(`/api/wild/launch/${row.id}`, 'PATCH', { action, revision: row.revision })
      if (result.url) setLink({ email: row.email, name: row.profile.name, value: result.url })
      setMessage(action === 'issue' ? 'Link prepared for the named representative. Nothing has been sent.' : 'Setup link revoked.')
      await load(data?.page || 0)
    })
  }
  return <div className="space-y-8">
    <div><p className="text-sm text-muted-foreground">Wild Venue</p><h1 className="text-3xl font-semibold">Venue launch desk</h1>
      <p className="mt-3">Prepare places, hand them to their owners and follow each one through editorial review. Start with a small group, then expand to 50.</p>
      <Link className="underline" href="/admin/wild">Open editorial review</Link></div>
    {error && <p role="alert" className="rounded border border-red-300 p-4">{error}</p>}
    {message && <p role="status" className="rounded border border-green-700 p-4">{message}</p>}
    {link && <section className="rounded border border-green-700 p-4 space-y-3"><h2 className="text-xl font-semibold">Setup link for {link.name}</h2>
      <p>Intended recipient: <strong>{link.email}</strong>. Valid for seven days. Confirm the recipient before sharing.</p>
      <label className="block">Private setup link<input className={fieldClass} value={link.value} readOnly onFocus={e => e.target.select()} /></label>
      <button className="bv-button bv-green" onClick={() => navigator.clipboard.writeText(link.value).then(() => setMessage('Link copied. Nothing has been sent.')).catch(() => setError('Select the link and copy it manually.'))}>Copy setup link</button>
      <p className="text-sm">This link is shown here only. If you lose it, issue a replacement from the place list.</p></section>}
    <fieldset disabled={busy} className="rounded border border-border p-4 space-y-5"><legend className="px-2 text-xl font-semibold">{edit ? 'Edit prepared venue' : 'Prepare a venue'}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <label>Venue reference<input className={fieldClass} value={form.reference} disabled={Boolean(edit) || Boolean(batch.length)} onChange={e => { setForm({ ...form, reference: e.target.value }); setAuthorised(false) }} placeholder="woodland-cafe" /></label>
        <label>Representative’s email<input type="email" className={fieldClass} value={form.email} disabled={Boolean(batch.length)} onChange={e => { setForm({ ...form, email: e.target.value }); setAuthorised(false) }} /></label>
        <label>Venue name<input className={fieldClass} value={form.profile.name} disabled={Boolean(batch.length)} onChange={e => update('name', e.target.value)} /></label>
        <label>County<select className={fieldClass} value={form.profile.county} disabled={Boolean(batch.length)} onChange={e => update('county', e.target.value)}>{WILD_COUNTIES.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}</select></label>
        <label>Venue type<select className={fieldClass} value={form.profile.kind} disabled={Boolean(batch.length)} onChange={e => update('kind', e.target.value)}>{KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select></label>
        <label>Website (optional)<input className={fieldClass} value={form.profile.website} disabled={Boolean(batch.length)} onChange={e => update('website', e.target.value)} placeholder="https://" /></label>
      </div>
      <label className="block">Venue story<textarea className={fieldClass} rows={4} value={form.profile.story} disabled={Boolean(batch.length)} onChange={e => update('story', e.target.value)} /></label>
      {!edit && <details><summary className="cursor-pointer underline">Prepare up to 50 places from a CSV</summary><div className="space-y-3 mt-3">
        <p>Use one unique reference per place. Importing the same details again will reuse the prepared record.</p>
        <a className="underline" download="venue-intake.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(VENUE_CSV_HEADER + '\n')}`}>Download blank intake template</a>
        <label className="block">Choose intake CSV<input className={fieldClass} type="file" accept=".csv,text/csv" onChange={e => { const file = e.target.files?.[0]; if (!file) return; setBatch([]); setAuthorised(false); run(async () => { if (file.size > 180000) throw Error('Use a CSV smaller than 180 KB.'); setBatch(parseVenueCsv(await file.text())); setMessage('CSV checked. Review the places below before saving.'); }) }} /></label>
        {batch.length > 0 && <><p>{batch.length} places ready to prepare:</p><ul className="max-h-60 overflow-auto list-disc pl-6">{batch.map(p => <li key={p.reference}>{p.profile.name} · {p.profile.county} · {p.email}</li>)}</ul><button className="underline" onClick={() => { setBatch([]); setAuthorised(false) }}>Clear import</button></>}
      </div></details>}
      <label className="flex items-start gap-3"><input type="checkbox" checked={authorised} onChange={e => setAuthorised(e.target.checked)} />I have checked the representative’s email and am authorised to prepare these venue details. Preparation does not establish a partnership or payment.</label>
      <div className="flex gap-3 flex-wrap"><button className="bv-button bv-green" disabled={!authorised} onClick={save}>{busy ? 'Saving…' : edit ? 'Save details and invalidate old links' : `Prepare ${batch.length || 1} place${batch.length > 1 ? 's' : ''}`}</button>
        {edit && <button className="bv-button" onClick={() => { setEdit(null); setForm(empty); setAuthorised(false) }}>Cancel edit</button>}</div>
    </fieldset>
    <section className="space-y-4"><div className="flex flex-wrap gap-4 items-center"><h2 className="text-2xl font-semibold">Places in preparation</h2><button disabled={busy} className="underline" onClick={() => run(() => load(data?.page || 0))}>Refresh status</button></div>
      {!data ? <p role="status">Loading places…</p> : <><p>{data.total} prepared records · {(Number(data.photoBytes) / 1000000).toFixed(1)} MB of stored venue photos across the service.</p>
        {!data.places.length && <p>No prepared places yet.</p>}
        <div className="grid gap-4 md:grid-cols-2">{data.places.map(row => <article key={row.id} className="rounded border border-border p-4 space-y-3">
          <h3 className="font-semibold text-xl break-words">{row.profile.name}</h3><p className="break-all">{row.email}</p><p>{row.profile.county} · {row.status}</p>
          <p className="text-sm">{row.natureSourceConfigured ? "County biodiversity feed supported; check current results before promising coverage." : "County biodiversity feed not connected. Offer reviewed venue content only."}</p>
          {row.acceptedAt && <p className="text-sm">{row.photoCount} photos · Seasonal plan: {row.planYear ?? 'not prepared'}</p>}
          <div className="flex flex-wrap gap-3">
            {!row.acceptedAt && <><button className="underline" disabled={busy || Boolean(row.revokedAt)} onClick={() => change(row, 'issue')}>Prepare setup link</button>
              <button className="underline" disabled={busy} onClick={() => { setEdit(row); setForm({ reference: row.reference, email: row.email, profile: row.profile }); setBatch([]); setAuthorised(false); setLink(null); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Edit details</button>
              <button className="underline" disabled={busy || Boolean(row.revokedAt)} onClick={() => change(row, 'revoke')}>Revoke setup</button></>}
            {row.publicPath && <><Link className="underline" href={row.publicPath}>Guest page</Link><a className="underline" href={`/api/wild/qr/${row.hubId}?download=1`}>Download QR</a></>}
          </div>
        </article>)}</div>
        <div className="flex gap-4"><button disabled={busy || data.page === 0} className="bv-button" onClick={() => run(() => load(data.page - 1))}>Previous</button><span className="self-center">Page {data.page + 1}</span><button disabled={busy || (data.page + 1) * 50 >= data.total} className="bv-button" onClick={() => run(() => load(data.page + 1))}>Next</button></div>
      </>}
    </section>
  </div>
}
