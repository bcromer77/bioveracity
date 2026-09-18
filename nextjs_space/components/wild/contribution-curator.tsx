'use client'
import { useCallback, useEffect, useState } from 'react'

// The curator: an extremely simple place for the venue to read what visitors
// have shared and decide, one by one, what becomes part of the public story.
// Approving something publishes it — it never turns an observation into verified
// ecological evidence, and it never reveals a sensitive location that the venue
// has chosen to hide.

type OwnerContribution = {
  id: string
  broadCategory: string
  categoryLabel: string
  whatYouThink: string
  note: string
  observedAt: string | null
  coarseLocation: string
  permissionToPublish: boolean
  evidenceClass: string
  publicationStatus: string
  sensitiveHidden: boolean
  moderatorNote: string
  createdAt: string
  moderatedAt: string | null
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Awaiting your review',
  PUBLISHED: 'Published',
  REJECTED: 'Kept private',
}

const fmt = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Dublin',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(iso))
    : ''

export function ContributionCurator({ hubs }: { hubs: { id: string; name: string }[] }) {
  const [hubId, setHubId] = useState(hubs[0]?.id ?? '')
  const [items, setItems] = useState<OwnerContribution[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')

  const load = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/wild/hubs/${id}/contributions`, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Could not load contributions.')
      }
      const j = await res.json()
      setItems(j.contributions ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(hubId)
  }, [hubId, load])

  async function decide(
    c: OwnerContribution,
    action: 'publish' | 'reject',
    hideLocation: boolean,
    moderatorNote: string,
  ) {
    setBusyId(c.id)
    setError('')
    try {
      const res = await fetch(`/api/wild/hubs/${hubId}/contributions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contributionId: c.id, action, hideLocation, moderatorNote }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'That decision could not be saved.')
      }
      await load(hubId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusyId('')
    }
  }

  const pending = items.filter((i) => i.publicationStatus === 'PENDING')
  const decided = items.filter((i) => i.publicationStatus !== 'PENDING')

  return (
    <div className="bv-curator">
      {hubs.length > 1 && (
        <label className="bv-curator-select">
          Place
          <select value={hubId} onChange={(e) => setHubId(e.target.value)}>
            {hubs.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="bv-error" role="alert">{error}</p>}
      {loading ? (
        <p>Loading…</p>
      ) : items.length === 0 ? (
        <div className="bv-curator-empty">
          <h3>Nothing shared yet.</h3>
          <p>When a visitor notices something and shares it, it will wait quietly here for you.</p>
        </div>
      ) : (
        <>
          <h3>To review ({pending.length})</h3>
          {pending.length === 0 && <p className="bv-small">You’re all caught up.</p>}
          <ul className="bv-curator-list">
            {pending.map((c) => (
              <CuratorCard key={c.id} c={c} hubId={hubId} busy={busyId === c.id} onDecide={decide} />
            ))}
          </ul>
          {decided.length > 0 && (
            <>
              <h3>Already decided</h3>
              <ul className="bv-curator-list">
                {decided.map((c) => (
                  <CuratorCard key={c.id} c={c} hubId={hubId} busy={busyId === c.id} onDecide={decide} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

function CuratorCard({
  c,
  hubId,
  busy,
  onDecide,
}: {
  c: OwnerContribution
  hubId: string
  busy: boolean
  onDecide: (
    c: OwnerContribution,
    action: 'publish' | 'reject',
    hideLocation: boolean,
    moderatorNote: string,
  ) => void
}) {
  const [hideLocation, setHideLocation] = useState(c.sensitiveHidden)
  const [note, setNote] = useState(c.moderatorNote)
  const decided = c.publicationStatus !== 'PENDING'
  return (
    <li className="bv-curator-card">
      <figure>
        <img src={`/api/wild/hubs/${hubId}/contributions/${c.id}/photo`} alt="Visitor contribution" loading="lazy" />
      </figure>
      <div className="bv-curator-body">
        <div className="bv-curator-head">
          <span className="bv-chip bv-chip-community">Community observation</span>
          <span className="bv-badge">{STATUS_LABEL[c.publicationStatus] ?? c.publicationStatus}</span>
        </div>
        <p className="bv-curator-what">{c.whatYouThink || 'They weren’t sure what it was.'}</p>
        <p className="bv-small">
          {c.categoryLabel}
          {c.observedAt ? ` · seen ${fmt(c.observedAt)}` : ` · shared ${fmt(c.createdAt)}`}
          {c.coarseLocation ? ` · ${c.coarseLocation}` : ''}
        </p>
        {c.note && (
          <p className="bv-curator-note">
            <strong>Private note:</strong> {c.note}
          </p>
        )}
        <p className="bv-small">
          Evidence class: {c.evidenceClass} · publishing does not change this.
        </p>
        {!c.permissionToPublish && (
          <p className="bv-small">
            This visitor did not give permission to publish, so it can only be kept private.
          </p>
        )}
        {!decided && (
          <>
            <label className="bv-check">
              <input type="checkbox" checked={hideLocation} onChange={(e) => setHideLocation(e.target.checked)} />
              <span>Hide the location if published (sensitive site — nest, den or roost).</span>
            </label>
            <label className="bv-curator-modnote">
              A note for your records (optional)
              <input type="text" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="bv-actions">
              <button
                type="button"
                className="bv-button bv-green"
                disabled={busy || !c.permissionToPublish}
                onClick={() => onDecide(c, 'publish', hideLocation, note)}
              >
                {busy ? 'Saving…' : 'Add to the story'}
              </button>
              <button
                type="button"
                className="bv-text-link"
                disabled={busy}
                onClick={() => onDecide(c, 'reject', hideLocation, note)}
              >
                Keep private
              </button>
            </div>
          </>
        )}
        {decided && c.sensitiveHidden && <p className="bv-small">Location hidden from the public.</p>}
      </div>
    </li>
  )
}
