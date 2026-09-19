'use client'
import { CountyNature } from '@/components/wild/county-nature'

import { EvidenceLink } from '@/components/evidence-link'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { WILD_COUNTIES, getWildCounty } from '@/lib/wild-counties/counties'
import {
  KINDS,
  MONTHS,
  trendSummary,
  type Profile,
  type Plan,
  type Trend,
  type Snapshot,
} from '@/lib/wild-hubs/domain'
type Hub = {
  id: string
  profile: Profile
  plan: Plan | null
  trend: Trend | null
  revision: number
  published: Snapshot | null
  review?: { id: string; status: string; reason: string; photoIds: string[] } | null
  photos: { id: string; caption: string; credit: string }[]
}
const empty: Profile = {
  name: '',
  county: 'down',
  kind: 'hotel',
  story: '',
  website: '',
  interests: ['nature'],
  locality: '',
  invitation: '',
  visitUrl: '',
  visitPrompt: '',
  natureStory: '',
  recommendations: [],
}
export function HubStudio() {
  const [list, setList] = useState<{ id: string; profile: Profile }[]>([]),
    [hub, setHub] = useState<Hub | null>(null),
    [profile, setProfile] = useState<Profile>(empty),
    [plan, setPlan] = useState<Plan | null>(null)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [dirty, setDirty] = useState(false),
    [approved, setApproved] = useState(false),
    [authorised, setAuthorised] = useState(false)
  const [currentYear, setCurrentYear] = useState(0)
  const [year, setYear] = useState(0),
    [month, setMonth] = useState(0),
    [csv, setCsv] = useState(''),
    [term, setTerm] = useState(''),
    [geo, setGeo] = useState(''),
    [sourceUrl, setSourceUrl] = useState(''),
    [photo, setPhoto] = useState<File | null>(null),
    [caption, setCaption] = useState(''),
    [credit, setCredit] = useState(''),
    [rights, setRights] = useState(false),
    [scanConsent, setScanConsent] = useState(false)
  async function api(url: string, method = 'GET', data?: unknown) {
    const response = await fetch(url, {
      method,
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    })
    const json = await response.json()
    if (!response.ok) throw Error(json.error || 'Please try again.')
    return json
  }
  async function refresh() {
    const json = await api('/api/wild/hubs')
    setList(json.hubs)
  }
  useEffect(() => {
    const y = new Date().getFullYear()
    setCurrentYear(y)
    setYear((prev) => (prev ? prev : y))
  }, [])
  useEffect(() => {
    refresh().catch((e) => setError(e.message))
  }, [])
  const autoOpened = useRef(false)
  useEffect(() => {
    // When a partner has exactly one place, open it automatically on load so
    // their saved content is visible immediately instead of a blank form.
    if (autoOpened.current) return
    if (busy || dirty || hub) return
    if (list.length === 1) {
      autoOpened.current = true
      open(list[0].id)
    }
  }, [list, busy, dirty, hub])
  useEffect(() => {
    const guard = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', guard)
    return () => window.removeEventListener('beforeunload', guard)
  }, [dirty])
  function receive(next: Hub) {
    setHub(next)
    setProfile(next.profile)
    setPlan(next.plan)
    setMonth((next.plan?.suggestedLeadMonth || 1) - 1)
    setDirty(false)
    setApproved(false)
    setAuthorised(false)
  }
  async function run(job: () => Promise<void>) {
    setBusy(true)
    setMessage('')
    setError('')
    try {
      await job()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }
  async function open(id: string) {
    if (dirty && !window.confirm('Discard unsaved changes and open this place?'))
      return
    await run(async () => {
      receive((await api(`/api/wild/hubs/${id}`)).hub)
    })
  }
  function update<K extends keyof Profile>(key: K, value: Profile[K]) {
    setProfile({ ...profile, [key]: value })
    setDirty(true)
    setApproved(false)
  }
  function recField(i: number, key: 'name' | 'note', value: string) {
    const recs = [...(profile.recommendations || [])]
    while (recs.length < 3) recs.push({ name: '', note: '' })
    recs[i] = { ...recs[i], [key]: value }
    setProfile({ ...profile, recommendations: recs })
    setDirty(true)
    setApproved(false)
  }
  async function action(data: Record<string, unknown>, success: string) {
    if (!hub) return
    await run(async () => {
      const next = await api(`/api/wild/hubs/${hub.id}`, 'PATCH', {
        ...data,
        revision: hub.revision,
      })
      receive(next.hub)
      setMessage(success)
      await refresh()
    })
  }
  function campaignField(
    key: 'title' | 'introduction' | 'activity' | 'caption',
    value: string,
  ) {
    if (!plan) return
    setPlan({
      ...plan,
      campaigns: plan.campaigns.map((c, i) =>
        i === month ? { ...c, [key]: value } : c,
      ),
    })
    setDirty(true)
    setApproved(false)
  }
  const profileDirty =
    !!hub && JSON.stringify(profile) !== JSON.stringify(hub.profile)
  const planDirty = !!hub && JSON.stringify(plan) !== JSON.stringify(hub.plan)
  const campaign = plan?.campaigns[month]
  const recs = profile.recommendations || []
  const countyBrand = getWildCounty(profile.county)?.brandName || profile.county
  return (
    <section className="bv-section bv-studio">
      <p className="bv-eyebrow">Your place. Your words. Your approval.</p>
      <h1>Your Wild Counties page</h1>
      <p>
        Create your place, add your photographs and preview your page exactly as a
        visitor will see it. Your draft stays private. Publishing needs your
        approval and a short review by our team; it does not buy signage or start a
        paid membership.
      </p>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="bv-error">
            {error}
          </p>
        )}
        {message && (
          <p className="bv-success" role="status">
            {message}
          </p>
        )}
        {busy && <p role="status">Saving or preparing your content…</p>}
      </div>
      <fieldset disabled={busy} className="bv-studio-controls">
        <legend>Your places</legend>
        <div className="bv-actions">
          {list.map((item) => (
            <button
              className="bv-button bv-green"
              key={item.id}
              onClick={() => open(item.id)}
            >
              {item.profile.name}
            </button>
          ))}
          <button
            className="bv-button"
            onClick={() => {
              if (dirty && !window.confirm('Discard unsaved changes?')) return
              setHub(null)
              setRequestId(crypto.randomUUID())
              setProfile(empty)
              setPlan(null)
              setDirty(false)
              setApproved(false)
              setAuthorised(false)
            }}
          >
            Add another place
          </button>
          {hub && (
            <button className="bv-text-link" onClick={() => open(hub.id)}>
              Reload saved version
            </button>
          )}
        </div>
      </fieldset>
      <div className="bv-studio-grid">
        <div>
          <form
            className="bv-form"
            onSubmit={(e) => {
              e.preventDefault()
              run(async () => {
                const next = hub
                  ? await api(`/api/wild/hubs/${hub.id}`, 'PATCH', {
                      action: 'save',
                      profile,
                      revision: hub.revision,
                    })
                  : await api('/api/wild/hubs', 'POST', {
                      ...profile,
                      requestId,
                    })
                receive(next.hub)
                setMessage(
                  'Your place is saved. Preview it, then send it for review when ready.',
                )
                await refresh()
              })
            }}
          >
            {planDirty && (
              <p>Save your seasonal plan edits before changing your place.</p>
            )}
            <fieldset disabled={busy || planDirty}>
              <legend>Your place</legend>
              <label htmlFor="hub-name">Place name</label>
              <input
                id="hub-name"
                value={profile.name}
                required
                maxLength={100}
                onChange={(e) => update('name', e.target.value)}
              />
              <label htmlFor="hub-kind">Kind of place</label>
              <select
                id="hub-kind"
                value={profile.kind}
                onChange={(e) =>
                  update('kind', e.target.value as Profile['kind'])
                }
              >
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
              <label htmlFor="hub-county">Wild County</label>
              <select
                id="hub-county"
                value={profile.county}
                onChange={(e) => update('county', e.target.value)}
              >
                {WILD_COUNTIES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
              <label htmlFor="hub-locality">Town or area (optional)</label>
              <input
                id="hub-locality"
                value={profile.locality || ''}
                maxLength={160}
                placeholder="e.g. near Downpatrick"
                onChange={(e) => update('locality', e.target.value)}
              />
            </fieldset>
            <fieldset disabled={busy || planDirty}>
              <legend>Your story</legend>
              <label htmlFor="hub-invitation">
                One-line welcome (optional)
              </label>
              <input
                id="hub-invitation"
                value={profile.invitation || ''}
                maxLength={200}
                placeholder="A short invitation to visitors"
                onChange={(e) => update('invitation', e.target.value)}
              />
              <label htmlFor="hub-story">Your story</label>
              <textarea
                id="hub-story"
                rows={5}
                value={profile.story}
                maxLength={2000}
                required
                onChange={(e) => update('story', e.target.value)}
              />
              <p>What should visitors explore?</p>
              {['nature', 'coast', 'food', 'craft'].map((i) => (
                <label className="bv-check" key={i}>
                  <input
                    type="checkbox"
                    checked={profile.interests.includes(i)}
                    onChange={(e) =>
                      update(
                        'interests',
                        e.target.checked
                          ? [...profile.interests, i]
                          : profile.interests.filter((v) => v !== i),
                      )
                    }
                  />
                  {i}
                </label>
              ))}
            </fieldset>
            <fieldset disabled={busy || planDirty}>
              <legend>Plan a visit</legend>
              <label htmlFor="hub-website">
                Your website (HTTPS, optional)
              </label>
              <input
                id="hub-website"
                type="url"
                value={profile.website}
                onChange={(e) => update('website', e.target.value)}
                maxLength={500}
              />
              <label htmlFor="hub-visit-url">
                Booking or visit link (HTTPS, optional)
              </label>
              <input
                id="hub-visit-url"
                type="url"
                value={profile.visitUrl || ''}
                onChange={(e) => update('visitUrl', e.target.value)}
                maxLength={500}
              />
              <label htmlFor="hub-visit-prompt">
                Before you come (optional)
              </label>
              <textarea
                id="hub-visit-prompt"
                rows={3}
                value={profile.visitPrompt || ''}
                maxLength={400}
                placeholder="Opening times, parking, access notes"
                onChange={(e) => update('visitPrompt', e.target.value)}
              />
            </fieldset>
            <fieldset disabled={busy || planDirty}>
              <legend>Nature around your place</legend>
              <label htmlFor="hub-nature-story">
                In your own words (optional)
              </label>
              <textarea
                id="hub-nature-story"
                rows={4}
                value={profile.natureStory || ''}
                maxLength={1500}
                placeholder="What visitors might notice in the landscape and wildlife around you"
                onChange={(e) => update('natureStory', e.target.value)}
              />
              <p>Nearby, worth a look (optional, up to three)</p>
              <p className="bv-small">
                These are shown as your own recommendations, clearly marked as not
                verified by BioVeracity.
              </p>
              {[0, 1, 2].map((i) => (
                <div key={i} className="bv-rec">
                  <label htmlFor={`hub-rec-name-${i}`}>Name</label>
                  <input
                    id={`hub-rec-name-${i}`}
                    value={recs[i]?.name || ''}
                    maxLength={120}
                    onChange={(e) => recField(i, 'name', e.target.value)}
                  />
                  <label htmlFor={`hub-rec-note-${i}`}>Why you like it</label>
                  <input
                    id={`hub-rec-note-${i}`}
                    value={recs[i]?.note || ''}
                    maxLength={300}
                    onChange={(e) => recField(i, 'note', e.target.value)}
                  />
                </div>
              ))}
              <button
                className="bv-button bv-green"
                type="submit"
                disabled={planDirty}
              >
                {hub ? 'Save your place' : 'Create private draft'}
              </button>
            </fieldset>
          </form>
          {hub && (
            <form
              className="bv-form"
              onSubmit={(e) => {
                e.preventDefault()
                run(async () => {
                  if (!photo) return
                  if (dirty)
                    throw Error('Save your changes before uploading a photo.')
                  if (photo.size > 3 * 1024 * 1024)
                    throw Error('Choose a JPEG or PNG up to 3 MB.')
                  const bytes = new Uint8Array(await photo.arrayBuffer())
                  let binary = ''
                  for (const byte of bytes) binary += String.fromCharCode(byte)
                  receive(
                    (
                      await api(`/api/wild/hubs/${hub.id}/photos`, 'POST', {
                        base64: btoa(binary),
                        caption,
                        credit,
                        rightsConfirmed: rights,
                        scannerConsent: scanConsent,
                      })
                    ).hub,
                  )
                  setPhoto(null)
                  setCaption('')
                  setCredit('')
                  setRights(false)
                  setScanConsent(false)
                  setMessage(
                    'Photo saved privately. Select it when you send for review.',
                  )
                })
              }}
            >
              <fieldset disabled={busy}>
                <legend>Your photographs</legend>
                <p>
                  JPEG or PNG, up to 3 MB each. Twelve photos per place. Location
                  metadata is removed.
                </p>
                <label htmlFor="hub-photo">Choose a photograph</label>
                <input
                  id="hub-photo"
                  type="file"
                  accept="image/jpeg,image/png"
                  required
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                />
                <label htmlFor="hub-caption">
                  Description and alternative text
                </label>
                <input
                  id="hub-caption"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={300}
                  required
                />
                <label htmlFor="hub-credit">Photographer / credit</label>
                <input
                  id="hub-credit"
                  value={credit}
                  onChange={(e) => setCredit(e.target.value)}
                  maxLength={160}
                  required
                />
                <label className="bv-check">
                  <input
                    type="checkbox"
                    checked={rights}
                    required
                    onChange={(e) => setRights(e.target.checked)}
                  />
                  I have permission to publish this photo. It contains no
                  identifiable children, private personal information or
                  sensitive wildlife-location details.
                </label>
                <label className="bv-check">
                  <input
                    type="checkbox"
                    checked={scanConsent}
                    required
                    onChange={(e) => setScanConsent(e.target.checked)}
                  />
                  I agree to this file being sent to Cloudmersive for security
                  scanning.
                </label>
                <button
                  className="bv-button bv-green"
                  disabled={!photo || dirty}
                >
                  Upload privately
                </button>
              </fieldset>
            </form>
          )}
        </div>
        <div>
          {!hub ? (
            <div className="bv-topic">
              <h2>Start with your place.</h2>
              <p>
                Save your details to unlock photographs, a private preview and
                sending your page for review.
              </p>
            </div>
          ) : (
            <>
              <section className="bv-form">
                <h2>Preview my page</h2>
                <p>
                  See your place exactly as a Wild Counties visitor will, using
                  your saved words and photographs. Only you can see this preview
                  and nothing is published.
                </p>
                {dirty ? (
                  <p className="bv-small">
                    Save your changes to update the preview.
                  </p>
                ) : (
                  <Link
                    className="bv-button bv-green"
                    href={`/wild/studio/${hub.id}/preview`}
                    target="_blank"
                  >
                    Preview my page ↗
                  </Link>
                )}
              </section>
              <section className="bv-form">
                <h2>Send for review</h2>
                {hub.review && <p role="status">Status: {hub.review.status}{hub.review.reason ? ' · ' + hub.review.reason : ''}. Saving changes needs a new submission.</p>}
                <p>
                  Choose the photographs to include, confirm you are happy, then
                  send your saved page to our team. Your published page, if any,
                  stays unchanged until a new version is approved.
                </p>
                <div className="bv-photo-grid">
                  {hub.photos.map((p) => (
                    <figure key={p.id}>
                      <img src={`/api/wild/photos/${p.id}`} alt={p.caption} />
                      <figcaption>
                        {p.caption} · {p.credit}
                      </figcaption>
                      <label className="bv-check">
                        <input
                          type="checkbox"
                          checked={(
                            profile.photoIds ?? hub.photos.map((x) => x.id)
                          ).includes(p.id)}
                          onChange={(e) => {
                            const current =
                              profile.photoIds ?? hub.photos.map((x) => x.id)
                            update(
                              'photoIds',
                              e.target.checked
                                ? [...current, p.id]
                                : current.filter((x) => x !== p.id),
                            )
                          }}
                        />
                        Show on my page
                      </label>
                      <button
                        className="bv-text-link"
                        disabled={busy || dirty}
                        onClick={() => {
                          if (
                            !window.confirm(
                              'Permanently delete this photo from your place?',
                            )
                          )
                            return
                          run(async () =>
                            receive(
                              (
                                await api(
                                  `/api/wild/hubs/${hub.id}/photos`,
                                  'DELETE',
                                  { photoId: p.id, revision: hub.revision },
                                )
                              ).hub,
                            ),
                          )
                        }}
                      >
                        Delete photo
                      </button>
                    </figure>
                  ))}
                </div>
                <CountyNature county={profile.county}/><p className="bv-small">Source-linked county records are shown for context and update separately from your approved words and photographs.</p>
                <label className="bv-check">
                  <input
                    type="checkbox"
                    checked={authorised}
                    onChange={(e) => setAuthorised(e.target.checked)}
                  />
                  I am authorised to represent this place and publish the
                  selected material.
                </label>
                <label className="bv-check">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                  />
                  I have reviewed my place details and selected photographs. I
                  approve this version for public use, including any optional
                  seasonal plan and its automatic monthly selection.
                </label>
                <button
                  className="bv-button bv-green"
                  disabled={busy || dirty || !approved || !authorised}
                  onClick={() =>
                    action(
                      {
                        action: 'submit',
                        approved,
                        authorised,
                      },
                      'Version submitted for editorial review. Your public page stays unchanged until approval.',
                    )
                  }
                >
                  Submit for editorial review
                </button>
                {hub.published && (
                  <div className="bv-published">
                    <p>
                      Published version {hub.published.version} ·{' '}
                      {new Date(hub.published.approvedAt).toLocaleDateString(
                        'en-GB',
                      )}
                    </p>
                    <Link href={`/wild/places/${hub.id}`} target="_blank">
                      Open published page ↗
                    </Link>
                    <p>
                      <button
                        className="bv-text-link"
                        disabled={busy || dirty}
                        onClick={() =>
                          action(
                            { action: 'unpublish' },
                            'Page unpublished. Its public page and QR destination are no longer available.',
                          )
                        }
                      >
                        Unpublish page
                      </button>
                    </p>
                  </div>
                )}
                <div className="bv-plaque">
                  <p className="bv-eyebrow">{countyBrand}</p>
                  <h3>{profile.name || 'Your place'}</h3>
                  {hub.published ? (
                    <>
                      <img
                        width={180}
                        height={180}
                        src={`/api/wild/qr/${hub.id}`}
                        alt="QR code for your published Wild Counties page"
                      />
                      <EvidenceLink href={`/api/wild/qr/${hub.id}?download=1`} download>
                        Download QR
                      </EvidenceLink>
                      <p className="bv-small">
                        Digital plaque preview. This QR opens your published page.
                        It is a preview only — no plaque is ordered or
                        manufactured here. Check the destination before printing.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="bv-plaque-qr" aria-hidden="true">QR</div>
                      <p className="bv-small">
                        Digital plaque preview. Your QR opens this page once it is
                        published. This is a preview only — no plaque is ordered or
                        manufactured here.
                      </p>
                    </>
                  )}
                </div>
              </section>
              <section className="bv-form">
                <h2>Seasonal plan</h2>
                <p className="bv-small">
                  Optional twelve-month set of gentle discovery ideas. You can
                  preview, submit and publish your page without one, and add a
                  plan later whenever you like.
                </p>
                <p>{trendSummary(hub.trend)}</p>
                {hub.trend && (
                  <p className="bv-small">
                    Original series: {hub.trend.seriesLabel} (
                    {hub.trend.interval}). Imported{' '}
                    {new Date(hub.trend.importedAt).toLocaleDateString('en-GB')}{' '}
                    · {hub.trend.periodStart} to {hub.trend.periodEnd}. Region
                    label supplied by you.
                  </p>
                )}
                <details>
                  <summary>Use Google Trends (optional)</summary>
                  <p>
                    Import an English “Interest over time” CSV for one search
                    term. Record the exact term, region and original explore
                    link. Search interest is relative and does not predict
                    bookings. No live Trends connection is implied.
                  </p>
                  <label htmlFor="trend-term">Exact search term or topic</label>
                  <input
                    id="trend-term"
                    value={term}
                    maxLength={100}
                    onChange={(e) => setTerm(e.target.value)}
                  />
                  <label htmlFor="trend-geo">Geography used</label>
                  <input
                    id="trend-geo"
                    value={geo}
                    maxLength={100}
                    onChange={(e) => setGeo(e.target.value)}
                  />
                  <label htmlFor="trend-url">Google Trends explore link</label>
                  <input
                    id="trend-url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                  />
                  <label htmlFor="trend-csv">Google Trends CSV</label>
                  <input
                    id="trend-csv"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={async (e) => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      if (f.size > 64000) {
                        setError('CSV must be below 64 KB.')
                        return
                      }
                      setCsv(await f.text())
                    }}
                  />
                  <button
                    className="bv-button"
                    disabled={
                      busy || dirty || !csv || !term || !geo || !sourceUrl
                    }
                    onClick={() =>
                      action(
                        {
                          action: 'trends',
                          trends: { csv, term, geography: geo, sourceUrl },
                        },
                        'Trends data imported. Generate a fresh plan to use it.',
                      )
                    }
                  >
                    Import search-interest data
                  </button>
                  {hub.trend && (
                    <button
                      className="bv-text-link"
                      disabled={busy || dirty}
                      onClick={() =>
                        action(
                          { action: 'trends', trends: null },
                          'Trends removed. Generate a fresh plan.',
                        )
                      }
                    >
                      Remove imported data
                    </button>
                  )}
                </details>
                <label htmlFor="plan-year">Plan year</label>
                <select
                  id="plan-year"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  {(currentYear ? [currentYear, currentYear + 1] : []).map(
                    (y) => (
                      <option key={y}>{y}</option>
                    ),
                  )}
                </select>
                <button
                  className="bv-button bv-green"
                  disabled={busy || dirty}
                  onClick={() => {
                    if (
                      plan &&
                      !window.confirm(
                        'Replace the saved draft plan with new suggestions? Published content is unchanged.',
                      )
                    )
                      return
                    action(
                      { action: 'generate', year },
                      'Twelve monthly drafts are ready to review.',
                    )
                  }}
                >
                  {plan ? 'Regenerate draft plan' : 'Generate seasonal plan'}
                </button>
                {dirty && (
                  <p>
                    Save your edits before generating, uploading or sending for
                    review.
                  </p>
                )}
              </section>
              {plan && campaign && (
                <section className="bv-form">
                  {profileDirty && (
                    <p>
                      Save your place and regenerate the plan before editing
                      monthly content.
                    </p>
                  )}
                  <fieldset disabled={busy || profileDirty}>
                    <legend>Review your seasonal plan</legend>
                    <p>
                      Plan for {plan.year}. These are editable invitations and
                      activities. Check suitability, opening information and
                      every claim before publishing. Outdoor activities require
                      suitable conditions and authorised access.
                    </p>
                    <label htmlFor="campaign-month">Review month</label>
                    <select
                      id="campaign-month"
                      value={month}
                      onChange={(e) => setMonth(Number(e.target.value))}
                    >
                      {MONTHS.map((m, i) => (
                        <option key={m} value={i}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <p className="bv-small">{campaign.planningNote}</p>
                    <label htmlFor="campaign-title">Monthly heading</label>
                    <input
                      id="campaign-title"
                      value={campaign.title}
                      maxLength={180}
                      onChange={(e) => campaignField('title', e.target.value)}
                    />
                    <label htmlFor="campaign-intro">Visitor introduction</label>
                    <textarea
                      id="campaign-intro"
                      value={campaign.introduction}
                      maxLength={1000}
                      onChange={(e) =>
                        campaignField('introduction', e.target.value)
                      }
                    />
                    <label htmlFor="campaign-activity">
                      Discovery activity
                    </label>
                    <textarea
                      id="campaign-activity"
                      value={campaign.activity}
                      maxLength={600}
                      onChange={(e) =>
                        campaignField('activity', e.target.value)
                      }
                    />
                    <label htmlFor="campaign-caption">
                      Marketing caption draft
                    </label>
                    <textarea
                      id="campaign-caption"
                      value={campaign.caption}
                      maxLength={1000}
                      onChange={(e) => campaignField('caption', e.target.value)}
                    />
                    <div className="bv-actions">
                      <button
                        className="bv-button bv-green"
                        disabled={busy || profileDirty}
                        onClick={() =>
                          action(
                            { action: 'edit-plan', campaigns: plan.campaigns },
                            'All twelve months saved as a draft.',
                          )
                        }
                      >
                        Save plan edits
                      </button>
                      <button
                        className="bv-text-link"
                        onClick={() =>
                          run(async () => {
                            await navigator.clipboard.writeText(
                              campaign.caption,
                            )
                            setMessage('Caption copied. No post has been sent.')
                          })
                        }
                      >
                        Copy caption
                      </button>
                    </div>
                    <details>
                      <summary>Preview all twelve months</summary>
                      {plan.campaigns.map((c) => (
                        <article key={c.month}>
                          <h3>
                            {MONTHS[c.month - 1]} · {c.title}
                          </h3>
                          <p>{c.introduction}</p>
                          <p>{c.activity}</p>
                        </article>
                      ))}
                    </details>
                  </fieldset>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
