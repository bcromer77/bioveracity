'use client'

import dynamic from 'next/dynamic'
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { cellAt, neighbours } from '@/lib/honeycomb/geometry'
import { Button } from '@/components/ui/button'

import type { HoneycombHit, HoneycombResponse } from '@/lib/honeycomb/types'
export type { HoneycombHit } from '@/lib/honeycomb/types'
const HoneycombMap = dynamic(() => import('./honeycomb-map-inner'), {
  ssr: false,
  loading: () => (
    <p className="p-4 text-sm" role="status">
      Loading honeycomb map…
    </p>
  )
})
const field =
  'mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function HoneycombPanel(props: { workspaceId: string; caseId: string; lat: number; lng: number }) {
  const [size, setSize] = useState(1000)
  const supported =
    Number.isFinite(props.lat) &&
    Number.isFinite(props.lng) &&
    props.lat >= 51 &&
    props.lat <= 56 &&
    props.lng >= -11 &&
    props.lng <= -5
  return (
    <section
      className="rounded-lg border border-primary/30 bg-card p-4 shadow-sm sm:p-5"
      aria-labelledby="honeycomb-heading"
    >
      <h2 id="honeycomb-heading" className="flex items-center gap-2 font-display text-lg font-semibold">
        <span aria-hidden className="h-5 w-1 rounded-full bg-accent" />
        Honeycomb search
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Select up to seven cells around your current place to search NPWS sites, planning applications and
        eligible bat records in the Republic of Ireland. Change the place using the town search above.
      </p>
      <label className="mt-3 block text-sm">
        Cell size
        <select className={field} value={size} onChange={(event) => setSize(Number(event.target.value))}>
          <option value={500}>Small — 500 m projected side</option>
          <option value={1000}>Medium — 1,000 m projected side</option>
          <option value={2000}>Large — 2,000 m projected side</option>
        </select>
      </label>
      <p className="mt-1 text-xs text-muted-foreground">
        Cells are search areas, not ecological or property boundaries. Projected sizes differ from ground
        distances.
      </p>
      {supported ? (
        <SearchArea
          key={`${props.workspaceId}:${props.caseId}:${props.lat}:${props.lng}:${size}`}
          {...props}
          size={size}
        />
      ) : (
        <p className="mt-3 text-sm">
          Honeycomb source search currently covers the Republic of Ireland. Select an Irish town to use it.
        </p>
      )}
    </section>
  )
}

function SearchArea({
  workspaceId,
  caseId,
  lat,
  lng,
  size
}: {
  workspaceId: string
  caseId: string
  lat: number
  lng: number
  size: number
}) {
  const centre = useMemo(() => cellAt({ lat, lng }, size), [lat, lng, size])
  const cells = useMemo(() => neighbours(centre, 2), [centre])
  const [selected, setSelected] = useState<string[]>([centre.id])
  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<HoneycombResponse | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [kind, setKind] = useState<'all' | HoneycombHit['kind']>('all')
  const [visibleCount, setVisibleCount] = useState(25)
  const filteredHits = data?.results.filter((hit) => kind === 'all' || hit.kind === kind) ?? []
  const controller = useRef<AbortController | null>(null)
  useEffect(
    () => () => {
      controller.current?.abort()
    },
    []
  )
  function invalidate() {
    controller.current?.abort()
    controller.current = null
    setData(null)
    setKind('all')
    setVisibleCount(25)
    setError('')
    setBusy(false)
  }
  function toggle(id: string) {
    if (!selected.includes(id) && selected.length >= 7) {
      setError('Select at most seven cells. Deselect a cell before adding another.')
      return
    }
    invalidate()
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    )
  }
  async function search(event: FormEvent) {
    event.preventDefault()
    invalidate()
    if (!selected.length) {
      setError('Select at least one cell.')
      return
    }
    if (from && to && from > to) {
      setError('The start date must be on or before the end date.')
      return
    }
    const active = new AbortController()
    controller.current = active
    setBusy(true)
    try {
      const response = await fetch(
        `/api/workspaces/${encodeURIComponent(workspaceId)}/cases/${encodeURIComponent(caseId)}/honeycomb`,
        {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          signal: active.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cells: selected,
            q: q.trim(),
            ...(from ? { from } : {}),
            ...(to ? { to } : {})
          })
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          typeof result.error === 'string' ? result.error : 'Honeycomb search could not be completed.'
        )
      if (!Array.isArray(result.results) || !Array.isArray(result.sources))
        throw new Error('Unexpected search response. Please retry.')
      if (controller.current === active && !active.signal.aborted) setData(result)
    } catch (caught) {
      if (controller.current === active && !active.signal.aborted)
        setError(caught instanceof Error ? caught.message : 'Honeycomb search could not be completed.')
    } finally {
      if (controller.current === active && !active.signal.aborted) setBusy(false)
    }
  }
  return (
    <div className="mt-3 space-y-3">
      <div className="h-[300px] overflow-hidden rounded-lg border border-border">
        <HoneycombMap cells={cells} selected={selected} onToggle={toggle} hits={filteredHits} />
      </div>
      <details>
        <summary className="cursor-pointer text-sm font-medium">
          Choose cells using checkboxes ({selected.length}/7 selected)
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cells.map((cell, index) => (
            <label key={cell.id} className="flex items-start gap-2 rounded border border-border p-2 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(cell.id)}
                disabled={!selected.includes(cell.id) && selected.length >= 7}
                onChange={() => toggle(cell.id)}
                className="mt-0.5"
              />
              <span>
                Cell {index + 1}
                {cell.id === centre.id ? ' (centre)' : ''}
                <span className="block text-muted-foreground">
                  {cell.center.lat.toFixed(4)}, {cell.center.lng.toFixed(4)}
                </span>
              </span>
            </label>
          ))}
        </div>
      </details>
      <form onSubmit={search} className="space-y-3">
        <label className="block text-sm">
          Words to match — optional
          <input
            value={q}
            maxLength={160}
            className={field}
            placeholder="For example: River Nore"
            onChange={(event) => {
              invalidate()
              setQ(event.target.value)
            }}
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Matches source text. A species name will not discover protected-site species associations unless
          that name occurs in the retrieved fields.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            From — optional
            <input
              type="date"
              className={field}
              value={from}
              onChange={(event) => {
                invalidate()
                setFrom(event.target.value)
              }}
            />
          </label>
          <label className="text-sm">
            To — optional
            <input
              type="date"
              className={field}
              value={to}
              onChange={(event) => {
                invalidate()
                setTo(event.target.value)
              }}
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          Date filters exclude undated records, including designations without event dates.
        </p>
        <Button type="submit" disabled={busy || !selected.length}>
          {busy
            ? 'Searching sources…'
            : `Search ${selected.length} selected cell${selected.length === 1 ? '' : 's'}`}
        </Button>
      </form>
      {error && (
        <p role="alert" className="rounded border border-destructive p-3 text-sm">
          {error}
        </p>
      )}
      {busy && (
        <p role="status" className="text-sm">
          Checking sources for the selected cells…
        </p>
      )}
      {data && (
        <div className="space-y-3">
          <div className="rounded border border-border bg-secondary/40 p-3 text-sm">
            <h3 className="font-semibold">Source coverage</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Source counts are before your word and date filters. Partial or failed retrieval means coverage
              is incomplete.
            </p>
            <ul className="mt-2 space-y-2">
              {data.sources.map((source) => (
                <li key={source.id}>
                  <strong>{source.label}</strong> ·{' '}
                  {source.status === 'ok'
                    ? 'Checked'
                    : source.status === 'partial'
                      ? 'Partial coverage'
                      : 'Unavailable'}{' '}
                  · {source.returned} returned<p className="text-xs text-muted-foreground">{source.note}</p>
                </li>
              ))}
            </ul>
          </div>
          <p role="status" className="text-sm font-medium">
            {data.results.length} matching record{data.results.length === 1 ? '' : 's'}
          </p>
          {!data.results.length && (
            <p className="text-sm">
              No matching records were returned from the sources checked. This does not establish that no
              relevant records exist. Review source coverage above.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A site intersecting a cell does not establish species presence there. Reported points are not
            evidence of presence throughout a cell. Results are for review and are not added to your case
            evidence.
          </p>
          <div className="space-y-2">
            <fieldset>
              <legend className="text-sm font-medium">Show record type</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {(
                  [
                    { value: 'all', label: 'All' },
                    { value: 'designation', label: 'NPWS sites' },
                    { value: 'planning', label: 'Planning' },
                    { value: 'species', label: 'Bats' }
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={kind === option.value}
                    onClick={() => {
                      setKind(option.value)
                      setVisibleCount(25)
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${kind === option.value ? 'border-primary bg-secondary font-semibold' : 'border-border'}`}
                  >
                    {option.label} (
                    {option.value === 'all'
                      ? data.results.length
                      : data.results.filter((hit) => hit.kind === option.value).length}
                    )
                  </button>
                ))}
              </div>
            </fieldset>
            <p role="status" className="text-xs text-muted-foreground">
              Showing {Math.min(visibleCount, filteredHits.length)} of {filteredHits.length} matching records
              for this type. Cards load 25 at a time; the map shows all returned points of this type. This
              filters the current results without another source request.
            </p>
            {filteredHits.length === 0 && data.results.length > 0 && (
              <p className="text-sm">
                No records of this type were returned for your search. Review source coverage above.
              </p>
            )}
          </div>
          <ul className="space-y-3">
            {filteredHits.slice(0, visibleCount).map((hit) => (
              <li
                key={hit.id}
                className="rounded-md border border-border border-l-4 border-l-primary p-3 text-sm"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {hit.kind === 'designation'
                    ? 'NPWS site record'
                    : hit.kind === 'species'
                      ? 'Species record'
                      : 'Planning application'}
                </p>
                <h3 className="mt-1 font-semibold break-words">{hit.title}</h3>
                <p className="mt-1 whitespace-pre-wrap break-words">{hit.details}</p>
                <p className="mt-2">
                  <strong>Why shown:</strong> {hit.matchReason}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {hit.spatialRelation === 'site-intersects-cell'
                    ? 'Site boundary intersects selected cell(s)'
                    : 'Reported point falls inside selected cell(s)'}{' '}
                  · {hit.cellIds.length} cell{hit.cellIds.length === 1 ? '' : 's'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Date: {hit.eventDate || 'Not stated'} · Precision: {hit.datePrecision}
                </p>
                {hit.kind === 'species' && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Source-reported coordinate uncertainty:{' '}
                    {hit.precisionMeters != null ? `${hit.precisionMeters} m` : 'Not stated'}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {hit.publisher} · Licence: {hit.licence || 'Not stated'}
                </p>
                <a
                  className="mt-2 inline-block font-medium text-primary underline"
                  href={hit.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Read source record
                </a>
              </li>
            ))}
          </ul>
          {visibleCount < filteredHits.length && (
            <Button type="button" onClick={() => setVisibleCount((current) => current + 25)}>
              Show {Math.min(25, filteredHits.length - visibleCount)} more records
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Retrieved: {data.retrievedAt}. This is the retrieval time, not an event date.
          </p>
        </div>
      )}
    </div>
  )
}
