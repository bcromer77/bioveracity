'use client'
import { CountyNature } from '@/components/wild/county-nature'

import { EvidenceLink } from '@/components/evidence-link'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { WILD_COUNTIES } from '@/lib/wild-counties/counties'
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
    [authorised, setAuthorised] = useState(false),
    [selectedPhotos, setSelectedPhotos] = useState<string[]>([])
  const [year, setYear] = useState(new Date().getFullYear()),
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
    refresh().catch((e) => setError(e.message))
  }, [])
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
    setSelectedPhotos((next.review?.photoIds || next.published?.photoIds || []).filter(id => next.photos.some(p => p.id === id)))
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
    if (dirty && !window.confirm('Discard unsaved changes and open this hub?'))
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
  return (
    <section className="bv-section bv-studio">
      <p className="bv-eyebrow">Your venue. Your seasons. Your approval.</p>
      <h1>Your ecology hubs</h1>
      <p>
        Build a guest guide and twelve months of content. Drafts are private.
        Publishing requires your approval and a BioVeracity editorial review; it does not purchase signage
        or start a paid membership.
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
            New ecology hub
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
                  'Venue details saved. Generate a fresh seasonal plan when ready.',
                )
                await refresh()
              })
            }}
          >
            {planDirty && (
              <p>Save your plan edits before changing venue details.</p>
            )}
            <fieldset disabled={busy || planDirty}>
              <legend>1. Tell your story</legend>
              <label htmlFor="hub-name">Venue name</label>
              <input
                id="hub-name"
                value={profile.name}
                required
                maxLength={100}
                onChange={(e) => update('name', e.target.value)}
              />
              <label htmlFor="hub-kind">Venue type</label>
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
              <label htmlFor="hub-county">County</label>
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
              <label htmlFor="hub-story">Your story</label>
              <textarea
                id="hub-story"
                rows={5}
                value={profile.story}
                maxLength={2000}
                required
                onChange={(e) => update('story', e.target.value)}
              />
              <label htmlFor="hub-website">
                Your website or booking link (HTTPS)
              </label>
              <input
                id="hub-website"
                type="url"
                value={profile.website}
                onChange={(e) => update('website', e.target.value)}
                maxLength={500}
              />
              <p>What should guests explore?</p>
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
              <button
                className="bv-button bv-green"
                type="submit"
                disabled={planDirty}
              >
                {hub ? 'Save venue details' : 'Create private draft'}
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
                    'Photo saved privately. Select it when you publish.',
                  )
                })
              }}
            >
              <fieldset disabled={busy}>
                <legend>2. Add your photographs</legend>
                <p>
                  JPEG or PNG, up to 3 MB each. Twelve photos per hub. Location
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
                Save your details to unlock photographs, a seasonal plan and
                your publication preview.
              </p>
            </div>
          ) : (
            <>
              <section className="bv-form">
                <h2>3. Shape the seasons</h2>
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
                  {[new Date().getFullYear(), new Date().getFullYear() + 1].map(
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
                    Save your edits before generating, uploading or publishing.
                  </p>
                )}
              </section>
              {plan && campaign && (
                <section className="bv-form">
                  {profileDirty && (
                    <p>
                      Save your venue details and regenerate the plan before
                      editing monthly content.
                    </p>
                  )}
                  <fieldset disabled={busy || profileDirty}>
                    <legend>4. Review your plan</legend>
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
                    <label htmlFor="campaign-intro">Guest introduction</label>
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
              <section className="bv-form">
                <h2>5. Submit your ecology hub for review</h2>
                {hub.review && <p role="status">Editorial status: {hub.review.status}{hub.review.reason ? ' · ' + hub.review.reason : ''}. Saving changes requires a new submission.</p>}
                <h3>{profile.name}</h3>
                <p className="bv-preserve">{profile.story}</p>
                <p>Website: {profile.website || 'Not added'}</p>
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
                          checked={selectedPhotos.includes(p.id)}
                          onChange={(e) => {
                            setSelectedPhotos(
                              e.target.checked
                                ? [...selectedPhotos, p.id]
                                : selectedPhotos.filter((x) => x !== p.id),
                            )
                            setApproved(false)
                          }}
                        />
                        Include on public hub
                      </label>
                      <button
                        className="bv-text-link"
                        disabled={busy || dirty}
                        onClick={() => {
                          if (
                            !window.confirm(
                              'Permanently delete this photo from your hub?',
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
                <CountyNature county={profile.county}/><p>API records are county context and update separately from your approved words and photographs.</p>
                <label className="bv-check">
                  <input
                    type="checkbox"
                    checked={authorised}
                    onChange={(e) => setAuthorised(e.target.checked)}
                  />
                  I am authorised to represent this venue and publish the
                  selected material.
                </label>
                <label className="bv-check">
                  <input
                    type="checkbox"
                    checked={approved}
                    onChange={(e) => setApproved(e.target.checked)}
                  />
                  I have reviewed the venue details, selected photos and all
                  twelve monthly entries. I approve this version for public use
                  and automatic monthly selection within its plan year.
                </label>
                <button
                  className="bv-button bv-green"
                  disabled={busy || dirty || !plan || !approved || !authorised}
                  onClick={() =>
                    action(
                      {
                        action: 'submit',
                        photoIds: selectedPhotos,
                        approved,
                        authorised,
                      },
                      'Version submitted for editorial review. Your public hub stays unchanged until approval.',
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
                      Open public ecology hub ↗
                    </Link>
                    <p>
                      Use this QR only after checking the destination and
                      printed proof.
                    </p>
                    <img
                      width={180}
                      height={180}
                      src={`/api/wild/qr/${hub.id}`}
                      alt="Your ecology hub QR code"
                    />
                    <EvidenceLink href={`/api/wild/qr/${hub.id}?download=1`} download>
                      Download QR
                    </EvidenceLink>
                    <p>
                      <button
                        className="bv-text-link"
                        disabled={busy || dirty}
                        onClick={() =>
                          action(
                            { action: 'unpublish' },
                            'Hub unpublished. Its public page and QR destination are no longer available.',
                          )
                        }
                      >
                        Unpublish hub
                      </button>
                    </p>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
