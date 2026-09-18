'use client'
import { useCallback, useEffect, useState } from 'react'

// Laura's desk. A quiet editorial place to read what visitors have noticed and
// decide, one photograph at a time, what becomes part of the place's living
// journal. Adding something publishes it — it never turns an observation into a
// verified identification, and it never reveals a sensitive location the venue
// has chosen to keep quiet. The photograph leads; the machinery stays out of
// the way until it is needed.

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
      {error && (
        <p className="bv-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className="bv-small">Loading…</p>
      ) : items.length === 0 ? (
        <div className="bv-curator-empty">
          <h3>Nothing shared yet.</h3>
          <p>When a visitor notices something and shares it, it will wait quietly here for you.</p>
        </div>
      ) : (
        <>
          <div className="bv-desk-group">
            <h3 className="bv-desk-heading">
              Waiting for you{pending.length > 0 ? ` — ${pending.length}` : ''}
            </h3>
            {pending.length === 0 ? (
              <p className="bv-small">You&rsquo;re all caught up.</p>
            ) : (
              <div className="bv-desk-list">
                {pending.map((c) => (
                  <CuratorCard key={c.id} c={c} hubId={hubId} busy={busyId === c.id} onDecide={decide} />
                ))}
              </div>
            )}
          </div>
          {decided.length > 0 && (
            <div className="bv-desk-group">
              <h3 className="bv-desk-heading">Your decisions so far</h3>
              <div className="bv-desk-list">
                {decided.map((c) => (
                  <CuratorCard key={c.id} c={c} hubId={hubId} busy={busyId === c.id} onDecide={decide} />
                ))}
              </div>
            </div>
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
  const published = c.publicationStatus === 'PUBLISHED'
  const when = c.observedAt ? fmt(c.observedAt) : ''

  return (
    <article className={`bv-desk-card${decided ? ' is-decided' : ''}`}>
      <figure className="bv-desk-photo">
        <img
          src={`/api/wild/hubs/${hubId}/contributions/${c.id}/photo`}
          alt="A visitor&rsquo;s photograph"
          loading="lazy"
        />
      </figure>
      <div className="bv-desk-body">
        <p className="bv-desk-lead">
          Someone noticed this{when ? ` on ${when}` : ''}
          {c.coarseLocation ? `, ${c.coarseLocation}` : ''}.
        </p>
        <p className="bv-desk-what">
          {c.whatYouThink
            ? `They thought it might be ${c.whatYouThink}.`
            : 'They weren’t sure what it was.'}
        </p>
        {c.note && <p className="bv-desk-visitornote">&ldquo;{c.note}&rdquo;</p>}
        <p className="bv-desk-prov">
          A visitor&rsquo;s observation — shared as a community sighting, not a verified
          identification. Adding it to the journal keeps it that way.
        </p>

        {decided ? (
          <p className={`bv-desk-status${published ? ' is-published' : ''}`}>
            {published ? 'In the journal' : 'Kept private'}
            {published && c.sensitiveHidden ? ' · location hidden' : ''}
          </p>
        ) : !c.permissionToPublish ? (
          <>
            <p className="bv-small">
              This visitor didn&rsquo;t give permission to publish, so it can only be kept private.
            </p>
            <div className="bv-actions">
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
        ) : (
          <div className="bv-desk-decide">
            <div className="bv-actions">
              <button
                type="button"
                className="bv-button bv-green"
                disabled={busy}
                onClick={() => onDecide(c, 'publish', hideLocation, note)}
              >
                {busy ? 'Saving…' : 'Add to the journal'}
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
            <details className="bv-desk-more">
              <summary>Handling options</summary>
              <label className="bv-check">
                <input
                  type="checkbox"
                  checked={hideLocation}
                  onChange={(e) => setHideLocation(e.target.checked)}
                />
                <span>
                  Hide the location if added (sensitive site &mdash; a nest, den or roost).
                </span>
              </label>
              <label className="bv-desk-recordnote">
                A note for your own records (optional)
                <input
                  type="text"
                  value={note}
                  maxLength={2000}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
            </details>
          </div>
        )}
      </div>
    </article>
  )
}
