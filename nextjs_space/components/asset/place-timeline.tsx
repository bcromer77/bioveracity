'use client'

import { useMemo, useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { EvidenceBadge } from '@/components/evidence-badge'
import { SafeDate } from '@/components/safe-format'
import { formatEventDate } from '@/lib/format-date'
import { itemInCategory } from '@/lib/categories'
import {
  ExternalLink, RotateCcw, ChevronDown, ChevronUp, GitBranch, TriangleAlert,
  CircleDot, Check, Square, ArrowUpRight,
} from 'lucide-react'

interface TItem {
  id: string
  kind: 'event' | 'material_change' | 'divergence' | 'corroboration' | 'gap'
  date: Date
  title: string
  description?: string | null
  evidenceClass?: string
  eventType?: string | null
  severity?: string | null
  datePrecision?: string | null
  sourceUrl?: string | null
  sourceDomain?: string | null
  divergence?: any
}

function stateVisual(kind: string) {
  switch (kind) {
    case 'divergence':
      return { Icon: TriangleAlert, cls: 'text-destructive bg-destructive/10 border-destructive/30', label: 'Divergence' }
    case 'material_change':
      return { Icon: ArrowUpRight, cls: 'text-[hsl(var(--link))] bg-[hsl(var(--link))]/10 border-[hsl(var(--link))]/30', label: 'Material change' }
    case 'corroboration':
      return { Icon: Check, cls: 'text-green-700 bg-green-600/10 border-green-600/30', label: 'Corroboration' }
    case 'gap':
      return { Icon: Square, cls: 'evidence-gap bg-orange-500/5 border-orange-500/20', label: 'Not yet found' }
    default:
      return { Icon: CircleDot, cls: 'text-muted-foreground bg-secondary border-border', label: 'Event' }
  }
}

const FREE_WINDOW_MONTHS = 24

export function PlaceTimeline({
  asset,
  categoryFilter = 'all',
  isInstitutional = false,
}: {
  asset: any
  categoryFilter?: string
  isInstitutional?: boolean
}) {
  const items: TItem[] = useMemo(() => {
    const evs: TItem[] = (asset?.events ?? [])
      .filter((e: any) => itemInCategory(e, categoryFilter))
      .map((e: any) => ({
      id: e.id,
      kind: (['material_change', 'divergence', 'corroboration', 'gap'].includes(e.changeType) ? e.changeType : 'event') as TItem['kind'],
      date: new Date(e.date),
      title: e.title,
      description: e.description,
      evidenceClass: e.evidenceClass,
      eventType: e.eventType,
      severity: e.severity,
      datePrecision: e.datePrecision,
      sourceUrl: e.sourceUrl,
      sourceDomain: e.sourceDomain,
    }))
    const divs: TItem[] = (categoryFilter === 'all' ? (asset?.divergences ?? []) : []).map((d: any) => ({
      id: `div-${d.id}`,
      kind: 'divergence' as const,
      date: new Date(d.date),
      title: d.title,
      description: d.summary,
      evidenceClass: 'A',
      sourceUrl: d.sourceUrl,
      sourceDomain: d.sourceDomain,
      divergence: d,
    }))
    return [...evs, ...divs].sort((a, b) => b.date.getTime() - a.date.getTime())
  }, [asset, categoryFilter])

  // Gating: free access is limited to a recent, curated window of the record.
  // Institutional access rewinds the complete history and any earlier period.
  const gatedItems = useMemo(() => {
    if (isInstitutional || !items.length) return items
    const maxTime = Math.max(...items.map((i) => i.date.getTime()))
    const cut = new Date(maxTime)
    cut.setMonth(cut.getMonth() - FREE_WINDOW_MONTHS)
    const lim = items.filter((i) => i.date.getTime() >= cut.getTime())
    return lim.length ? lim : items
  }, [items, isInstitutional])

  const gatedActive = !isInstitutional && gatedItems.length < items.length

  const { minT, maxT } = useMemo(() => {
    if (!gatedItems.length) return { minT: 0, maxT: 0 }
    const times = gatedItems.map((i) => i.date.getTime())
    return { minT: Math.min(...times), maxT: Math.max(...times) }
  }, [gatedItems])

  const [cutoff, setCutoff] = useState<number>(maxT)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const visible = gatedItems.filter((i) => i.date.getTime() <= cutoff)
  const hidden = gatedItems.length - visible.length
  const rewound = cutoff < maxT

  if (!items.length) {
    return (
      <div className="rounded-lg border border-border bg-secondary/40 p-6 text-center">
        <p className="text-[15px] text-muted-foreground">No chronology recorded for this place yet.</p>
      </div>
    )
  }

  return (
    <div>
      {gatedActive && (
        <div className="mb-4 rounded-lg border border-accent/40 bg-accent/[0.06] p-4">
          <p className="text-[15px] font-semibold text-foreground">
            You are viewing the most recent {FREE_WINDOW_MONTHS} months of this record.
          </p>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Replaying the complete history — and rewinding to any earlier period or project window — is an institutional capability.{' '}
            <a href="/institutional" className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">
              Request institutional access →
            </a>
          </p>
        </div>
      )}

      {/* Time slider */}
      <div className="mb-6 rounded-lg border border-border bg-secondary/40 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            <span className="text-[15px] font-semibold text-foreground">Rewind the record</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[14px] text-muted-foreground">
              {rewound ? (
                <>as of <span className="font-medium text-foreground"><SafeDate date={new Date(cutoff)} options={{ dateStyle: 'medium' }} /></span></>
              ) : (
                <>showing full record</>
              )}
            </span>
            {rewound && (
              <button
                onClick={() => setCutoff(maxT)}
                className="rounded border border-border px-2.5 py-1 text-[13px] text-muted-foreground hover:text-foreground"
              >
                Reset to now
              </button>
            )}
          </div>
        </div>
        <Slider
          value={[cutoff]}
          min={minT}
          max={maxT}
          step={Math.max(1, Math.round((maxT - minT) / 400))}
          onValueChange={(v) => setCutoff(v[0])}
        />
        <div className="mt-2 flex items-center justify-between text-[13px] text-muted-foreground">
          <span><SafeDate date={new Date(minT)} options={{ year: 'numeric', month: 'short' }} /></span>
          {hidden > 0 && <span className="font-medium text-foreground">{hidden} later item{hidden > 1 ? 's' : ''} hidden</span>}
          <span><SafeDate date={new Date(maxT)} options={{ year: 'numeric', month: 'short' }} /></span>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative space-y-3">
        {visible.map((item) => {
          const v = stateVisual(item.kind)
          const isDiv = item.kind === 'divergence' && item.divergence
          const open = expanded[item.id]
          return (
            <div key={item.id} className="relative">
              <div
                className={`rounded-lg border p-4 ${
                  isDiv ? 'border-2 border-destructive/40 bg-destructive/[0.04]' : 'border border-border bg-white'
                }`}
              >
                <div className="flex gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${v.cls}`}>
                    <v.Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className={`text-[13px] font-semibold uppercase tracking-wide ${isDiv ? 'text-destructive' : 'text-muted-foreground'}`}>{v.label}</span>
                      <span className="text-[13px] text-muted-foreground" suppressHydrationWarning>
                        {formatEventDate(item.date, item.kind === 'divergence' ? 'day' : item.datePrecision)}
                      </span>
                    </div>
                    <p className={`text-[16px] ${isDiv ? 'font-bold text-foreground' : 'font-medium text-foreground'}`}>
                      {item.title}
                    </p>
                    {item.description && <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{item.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      {item.evidenceClass && <EvidenceBadge classCode={item.evidenceClass} />}
                      {item.eventType && <span className="text-[13px] text-muted-foreground">{item.eventType}</span>}
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[13px] text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2"
                        >
                          {item.sourceDomain ?? 'Source'} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {isDiv && (
                        <button
                          onClick={() => setExpanded((s) => ({ ...s, [item.id]: !s[item.id] }))}
                          className="ml-auto inline-flex items-center gap-1 rounded-md bg-destructive/10 px-3 py-1.5 text-[13px] font-semibold text-destructive hover:bg-destructive/15"
                        >
                          <GitBranch className="h-3.5 w-3.5" />
                          {open ? 'Hide' : 'See where it disagrees'}
                          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>

                    {isDiv && open && (
                      <div className="mt-3 space-y-3 border-t border-destructive/20 pt-3">
                        <ContradictionRow label="Before" value={item.divergence.before} />
                        <ContradictionRow label="The change" value={item.divergence.theChange} />
                        <ContradictionRow label="The difference" value={item.divergence.theDifference} highlight />
                        {item.divergence.whatHappenedNext && (
                          <ContradictionRow label="What happened next" value={item.divergence.whatHappenedNext} />
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
                          <span className="rounded border border-border px-2 py-0.5 text-[13px] capitalize text-foreground">
                            {(item.divergence.status ?? 'unresolved').replace('_', ' ')}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-[14px] italic text-muted-foreground">
        Chronology is assembled from the sources shown. Where the record is silent, that silence is marked — it is not filled in.
      </p>
    </div>
  )
}

function ContradictionRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-3">
      <span className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <p className={`text-[15px] leading-relaxed ${highlight ? 'font-semibold text-destructive' : 'text-foreground/90'}`}>
        {value}
      </p>
    </div>
  )
}
