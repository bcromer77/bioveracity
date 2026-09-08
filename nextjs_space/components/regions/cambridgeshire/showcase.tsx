'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
  Droplets, Factory, Fish, HardHat, Scale, LayoutGrid, MapPin, GitBranch,
  AlertCircle, ArrowRight, Lightbulb, Bell, Waves, FileSearch,
  CheckCircle2, HelpCircle, Target, Network,
  type LucideIcon,
} from 'lucide-react'
import { SafeDate } from '@/components/safe-format'
import { formatEventDate } from '@/lib/format-date'
import { EvidenceBadge } from '@/components/evidence-badge'
import { RegionalMap } from './regional-map'
import type { MapPoint, MapConnection } from './regional-map-inner'
import { capabilityForGap } from '@/lib/innovation'
import { itemInCategory } from '@/lib/categories'

// ---- Serialized data shapes (dates are ISO strings) ----
export interface ShowEvent {
  id: string
  title: string
  description: string | null
  date: string
  eventType: string | null
  evidenceClass: string
  changeType: string
  datePrecision: string | null
  assetSlug: string
  assetName: string
}
export interface ShowAsset {
  slug: string
  name: string
  type: string
  subtype: string | null
  status: string
  statusDetail: string | null
  summary: string | null
  operatorName: string | null
  regulatorName: string | null
  receivingWater: string | null
  projectCount: number
  regulatoryCount: number
  gapCount: number
  divergenceCount: number
  latestProject: string | null
}
export interface ShowDivergence {
  id: string
  title: string
  date: string
  summary: string | null
  before: string
  theChange: string
  theDifference: string
  whatHappenedNext: string | null
  assetSlug: string
  assetName: string
}
export interface ShowGap {
  id: string
  description: string
  consequence: string | null
  dataRequired: string | null
  priority: string
  assetSlug: string
  assetName: string
}
export interface ShowCounts {
  waterBodies: number
  wastewater: number
  monitoringRecords: number
  regulatoryChanges: number
  projects: number
  openGaps: number
}

const CHIPS = [
  { id: 'all', label: 'Everything', icon: LayoutGrid },
  { id: 'water', label: 'Rivers & water', icon: Droplets },
  { id: 'sewage', label: 'Wastewater & discharges', icon: Factory },
  { id: 'fish', label: 'Fish & ecology', icon: Fish },
  { id: 'projects', label: 'Projects & planning', icon: HardHat },
  { id: 'regulatory', label: 'Regulatory activity', icon: Scale },
]

function linkCls() {
  return 'text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2'
}

export function CambridgeshireShowcase({
  counts, wastewater, waters, recentEvents, divergences, gaps, mapPoints, flagship,
}: {
  counts: ShowCounts
  wastewater: ShowAsset[]
  waters: ShowAsset[]
  recentEvents: ShowEvent[]
  divergences: ShowDivergence[]
  gaps: ShowGap[]
  mapPoints: MapPoint[]
  flagship: ShowAsset | null
}) {
  const [cat, setCat] = useState('all')

  const filteredEvents = useMemo(
    () => recentEvents.filter((e) => itemInCategory(e, cat)),
    [recentEvents, cat],
  )
  const filteredDiv = useMemo(
    () => (cat === 'all' ? divergences : divergences.filter((d) => itemInCategory({ title: d.title, description: `${d.summary} ${d.theChange} ${d.theDifference}` }, cat))),
    [divergences, cat],
  )
  const filteredGaps = useMemo(
    () => (cat === 'all' ? gaps : gaps.filter((g) => itemInCategory({ description: g.description }, cat))),
    [gaps, cat],
  )

  // ---- Doctrine-layer derived data (source-backed only) ----
  const waterSlugByName = useMemo(() => {
    const m: Record<string, string> = {}
    for (const w of waters) m[w.name] = w.slug
    return m
  }, [waters])

  // Connections are drawn only where the public record supports a direct
  // discharge relationship — nothing is inferred.
  const connections = useMemo(
    () =>
      wastewater
        .filter((a) => a.receivingWater)
        .map((a) => ({
          fromName: a.name,
          fromSlug: a.slug,
          toName: a.receivingWater as string,
          toSlug: waterSlugByName[a.receivingWater as string] ?? null,
        })),
    [wastewater, waterSlugByName],
  )

  // Relationship edges for the map: only those whose receiving water is itself a
  // plotted place, so both endpoints resolve to real coordinates. Nothing is
  // inferred — these come from the same source-backed discharge record above.
  const mapConnections: MapConnection[] = useMemo(
    () =>
      connections
        .filter((c): c is typeof c & { toSlug: string } => c.toSlug != null)
        .map((c) => ({ fromSlug: c.fromSlug, toSlug: c.toSlug, label: 'discharges to' })),
    [connections],
  )

  // What the public record currently establishes for this region.
  const establishes = useMemo(() => {
    const items: string[] = []
    if (flagship?.statusDetail) {
      const detail = flagship.statusDetail.replace(/^Environment Agency WFD classification located — /, '')
      items.push(
        `The Environment Agency's Water Framework Directive classification for the River Cam has been located and attached to its record (${detail}).`,
      )
    }
    for (const a of wastewater) {
      if (a.receivingWater) items.push(`${a.name} discharges treated effluent to the ${a.receivingWater}.`)
    }
    return items
  }, [flagship, wastewater])

  // One representative unresolved question per place (regional summary view).
  const unresolvedList = useMemo(() => {
    const seen = new Set<string>()
    const out: ShowGap[] = []
    for (const g of gaps) {
      if (seen.has(g.assetSlug)) continue
      seen.add(g.assetSlug)
      out.push(g)
      if (out.length >= 6) break
    }
    return out
  }, [gaps])

  const whatWouldHelp = useMemo(() => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const g of gaps) {
      const d = g.dataRequired
        ?.replace(/\s*Last checked at seed time\.?\s*$/i, '')
        .replace(/^Sources to check:\s*/i, '')
        .trim()
      if (!d || seen.has(d)) continue
      seen.add(d)
      out.push(d)
      if (out.length >= 6) break
    }
    return out
  }, [gaps])

  return (
    <div className="mx-auto max-w-[1120px] px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-[14px] text-muted-foreground">
        <MapPin className="h-4 w-4 text-accent" />
        <span>Regional evidence picture</span>
      </div>
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
        Cambridgeshire &amp; Peterborough
      </h1>
      <p className="mt-3 max-w-3xl text-[17px] leading-relaxed text-foreground">
        What is happening here? This is the environmental memory of the region &mdash; what was
        measured, reported, authorised and done around its rivers, wastewater assets and projects,
        assembled from the public record and shown with its provenance.
      </p>
      <p className="mt-2 max-w-3xl text-[14px] text-muted-foreground">
        BioVeracity is part of RippleXn&rsquo;s Veracity platform &mdash; reconstructing what was
        measured, reported, authorised and done around physical places over time.
      </p>

      {/* Evidence snapshot — real counts only */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">What BioVeracity has connected</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SnapshotCard n={counts.waterBodies} label="Rivers & water bodies" />
          <SnapshotCard n={counts.wastewater} label="Wastewater assets" />
          <SnapshotCard n={counts.projects} label="Capital projects" />
          <SnapshotCard n={counts.regulatoryChanges} label="Regulatory records" />
          <SnapshotCard n={counts.openGaps} label="Unresolved questions" tone="gap" />
          <SnapshotCard
            n={counts.monitoringRecords}
            label="Validated monitoring series"
            tone={counts.monitoringRecords === 0 ? 'gap' : 'default'}
            note={counts.monitoringRecords === 0 ? 'None located yet in the public sources reviewed' : undefined}
          />
        </div>
      </section>

      {/* Category filter */}
      <section className="mt-8 rounded-lg border border-border bg-secondary/40 p-4">
        <p className="mb-2.5 text-[15px] font-semibold text-foreground">What do you want to check?</p>
        <div className="flex flex-wrap gap-2">
          {CHIPS.map((c) => {
            const Icon = c.icon
            const active = cat === c.id
            return (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                  active
                    ? 'border-accent bg-accent text-accent-foreground'
                    : 'border-border bg-white text-foreground hover:border-foreground/40'
                }`}
              >
                <Icon className="h-4 w-4" />
                {c.label}
              </button>
            )
          })}
        </div>
      </section>

      {/* What changed recently */}
      <section className="mt-10">
        <h2 className="mb-3 font-display text-xl font-bold text-foreground">What changed recently</h2>
        {filteredEvents.length === 0 ? (
          <CautiousEmpty cat={cat} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-white">
            {filteredEvents.slice(0, 12).map((e) => (
              <li key={e.id} className="p-4">
                <Link href={`/asset/${e.assetSlug}`} className="group block">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5"><EvidenceBadge classCode={e.evidenceClass} /></span>
                    <div className="min-w-0">
                      <p className="text-[16px] font-medium leading-snug text-foreground group-hover:underline group-hover:underline-offset-2">
                        {e.title}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {e.assetName} · <span suppressHydrationWarning>{formatEventDate(e.date, e.datePrecision)}</span>
                      </p>
                      <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-[hsl(var(--link))] group-hover:underline group-hover:underline-offset-2">
                        See evidence <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Wastewater network */}
      {(cat === 'all' || cat === 'sewage' || cat === 'water') && wastewater.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-foreground">The regional wastewater network</h2>
          <p className="mb-4 mt-1 max-w-3xl text-[15px] text-muted-foreground">
            Each works is shown with its operator, regulator, receiving water and the projects or
            regulatory records attached to it. Where the effect on the receiving water is not yet
            established, that is recorded as an evidence gap rather than assumed.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {wastewater.map((a) => (
              <Link
                key={a.slug}
                href={`/asset/${a.slug}`}
                className="group block rounded-lg border border-border bg-white p-5 transition-colors hover:border-foreground/30"
              >
                <div className="mb-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[12px] uppercase tracking-wide">
                    {a.subtype ?? a.type}
                  </span>
                  <span className="capitalize">{a.status}</span>
                </div>
                <h3 className="flex items-center gap-1.5 font-display text-lg font-bold text-foreground group-hover:underline group-hover:underline-offset-2">
                  <Factory className="h-4 w-4 shrink-0 text-muted-foreground" /> {a.name}
                </h3>
                {a.summary && <p className="mt-1.5 line-clamp-3 text-[14px] text-muted-foreground">{a.summary}</p>}
                <dl className="mt-3 space-y-1 text-[13px]">
                  {a.operatorName && <Row k="Operator" v={a.operatorName} />}
                  {a.regulatorName && <Row k="Regulator" v={a.regulatorName} />}
                  {a.receivingWater && (
                    <div className="flex gap-2">
                      <dt className="w-24 shrink-0 text-muted-foreground">Receiving water</dt>
                      <dd className="text-foreground">
                        <span className="inline-flex items-center gap-1"><Waves className="h-3.5 w-3.5 text-muted-foreground" />{a.receivingWater}</span>
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
                  {a.projectCount > 0 && <span className="inline-flex items-center gap-1"><HardHat className="h-3.5 w-3.5" />{a.projectCount} project{a.projectCount > 1 ? 's' : ''}</span>}
                  {a.regulatoryCount > 0 && <span className="inline-flex items-center gap-1"><Scale className="h-3.5 w-3.5" />{a.regulatoryCount} regulatory</span>}
                  {a.divergenceCount > 0 && <span className="inline-flex items-center gap-1 text-destructive"><GitBranch className="h-3.5 w-3.5" />{a.divergenceCount} evidence difference{a.divergenceCount > 1 ? 's' : ''}</span>}
                  {a.gapCount > 0 && <span className="inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{a.gapCount} open question{a.gapCount > 1 ? 's' : ''}</span>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* What is connected here */}
      {connections.length > 0 && (cat === 'all' || cat === 'water' || cat === 'sewage') && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <Network className="h-5 w-5 text-muted-foreground" /> What is connected here
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-[15px] text-muted-foreground">
            These connections are drawn only where the public record supports a direct relationship
            between one place and another. Follow the chain from a wastewater works to the water it
            discharges to, and on to the regulatory classification held for that water.
          </p>
          <div className="space-y-3">
            {connections.map((c) => (
              <div key={c.fromSlug} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-white p-4">
                <Link href={`/asset/${c.fromSlug}`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-[14px] font-medium text-foreground hover:border-foreground/40">
                  <Factory className="h-3.5 w-3.5 text-muted-foreground" /> {c.fromName}
                </Link>
                <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground"><ArrowRight className="h-4 w-4" /> discharges to</span>
                {c.toSlug ? (
                  <Link href={`/asset/${c.toSlug}`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-[14px] font-medium text-foreground hover:border-foreground/40">
                    <Waves className="h-3.5 w-3.5 text-muted-foreground" /> {c.toName}
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/50 px-3 py-1.5 text-[14px] font-medium text-foreground">
                    <Waves className="h-3.5 w-3.5 text-muted-foreground" /> {c.toName}
                  </span>
                )}
                {c.toSlug === 'river-cam' && flagship?.statusDetail && (
                  <>
                    <span className="inline-flex items-center gap-1 text-[13px] text-muted-foreground"><ArrowRight className="h-4 w-4" /> classified by</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/[0.06] px-3 py-1.5 text-[14px] font-medium text-foreground">
                      <Scale className="h-3.5 w-3.5 text-muted-foreground" /> Environment Agency WFD classification
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* River Cam flagship */}
      {flagship && (cat === 'all' || cat === 'water' || cat === 'fish') && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-foreground">Flagship: the River Cam</h2>
          <Link
            href={`/asset/${flagship.slug}`}
            className="group mt-3 block rounded-xl border-2 border-accent/40 bg-accent/[0.04] p-6 transition-colors hover:border-accent"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="flex items-center gap-2 font-display text-2xl font-bold text-foreground group-hover:underline group-hover:underline-offset-2">
                  <Droplets className="h-5 w-5 text-accent" /> {flagship.name}
                </h3>
                {flagship.summary && <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">{flagship.summary}</p>}
              </div>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground group-hover:text-accent" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-muted-foreground">
              {flagship.gapCount > 0 && <span className="inline-flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{flagship.gapCount} open question{flagship.gapCount > 1 ? 's' : ''}</span>}
              <span>Open the full record, chronology and evidence gaps &rarr;</span>
            </div>
          </Link>
        </section>
      )}

      {/* Where the evidence stands — the doctrine triad */}
      {(establishes.length > 0 || unresolvedList.length > 0 || whatWouldHelp.length > 0) && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-foreground">Where the evidence stands</h2>
          <p className="mb-4 mt-1 max-w-3xl text-[15px] text-muted-foreground">
            The same discipline everywhere: what the public record currently establishes, what
            remains unresolved, and what would reduce that uncertainty. Nothing here is scored or
            inferred.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <DoctrineCol
              title="What the evidence establishes"
              icon={CheckCircle2}
              tone="ok"
              items={establishes}
              emptyText="Nothing is asserted here beyond what a source supports."
            />
            <DoctrineCol
              title="What remains unresolved"
              icon={HelpCircle}
              tone="gap"
              items={unresolvedList.map((g) => g.description)}
              emptyText="No open questions recorded for the current filter."
            />
            <DoctrineCol
              title="What would help answer it"
              icon={Target}
              tone="default"
              items={whatWouldHelp}
              emptyText="—"
            />
          </div>
        </section>
      )}

      {/* Evidence differs */}
      {filteredDiv.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-bold text-destructive">The evidence starts to differ here</h2>
          <p className="mb-4 mt-1 max-w-3xl text-[15px] text-muted-foreground">
            These are places where two source-backed accounts of the same period disagree. No score
            is applied &mdash; the disagreement is shown in full so you can judge it.
          </p>
          <div className="space-y-4">
            {filteredDiv.map((d) => (
              <div key={d.id} className="rounded-xl border-2 border-destructive/30 bg-destructive/[0.03] p-5">
                <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-muted-foreground">
                  <Link href={`/asset/${d.assetSlug}`} className={linkCls()}>{d.assetName}</Link>
                  <span>· <SafeDate date={d.date} options={{ dateStyle: 'long' }} /></span>
                </div>
                {d.summary && <p className="mt-2 text-[16px] font-medium text-foreground">{d.summary}</p>}
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <DiffCol k="Before" v={d.before} />
                  <DiffCol k="The change" v={d.theChange} />
                  <DiffCol k="Where it disagrees" v={d.theDifference} tone="diff" />
                </div>
                {d.whatHappenedNext && (
                  <p className="mt-3 text-[14px] text-muted-foreground">
                    <span className="font-semibold text-foreground">What happened next: </span>{d.whatHappenedNext}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* What we haven't found */}
      {filteredGaps.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <FileSearch className="h-5 w-5 text-muted-foreground" /> What we haven&rsquo;t found
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-[15px] text-muted-foreground">
            These are the records BioVeracity has not located in the public sources reviewed. An
            absence of evidence is recorded honestly &mdash; it is not treated as proof of a problem
            or of its absence.
          </p>
          <div className="space-y-3">
            {filteredGaps.map((g) => (
              <div key={g.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex items-start gap-2">
                  <span className="mt-1 text-muted-foreground">□</span>
                  <div>
                    <p className="text-[15px] font-medium text-foreground">{g.description}</p>
                    <p className="mt-1 text-[13px]">
                      <Link href={`/asset/${g.assetSlug}`} className={linkCls()}>{g.assetName}</Link>
                    </p>
                    {g.consequence && <p className="mt-1.5 text-[14px] text-muted-foreground"><span className="font-semibold text-foreground">Why it matters: </span>{g.consequence}</p>}
                    {g.dataRequired && <p className="mt-1 text-[14px] text-muted-foreground"><span className="font-semibold text-foreground">What would resolve it: </span>{g.dataRequired}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Innovation potentially relevant here */}
      {filteredGaps.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 font-display text-xl font-bold text-foreground">
            <Lightbulb className="h-5 w-5 text-accent" /> Innovation potentially relevant here
          </h2>
          <p className="mb-4 mt-1 max-w-3xl text-[15px] text-muted-foreground">
            The problem comes first. For each open question, this shows the capability that would be
            needed to answer it and the kind of regional innovation base that could be relevant. This
            is not an endorsement, a recommendation of any supplier, or a claim that anything has
            been deployed.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {dedupeCapabilities(filteredGaps).map(({ cap, gap }) => (
              <div key={cap.id} className="rounded-lg border border-border bg-white p-5">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Relevant capability</p>
                <p className="mt-1 text-[16px] font-bold text-foreground">{cap.capability}</p>
                <p className="mt-2 text-[14px] text-muted-foreground"><span className="font-semibold text-foreground">Evidence gap: </span>{gap.description}</p>
                <p className="mt-1.5 text-[14px] text-muted-foreground"><span className="font-semibold text-foreground">Why relevant: </span>{cap.why}</p>
                <p className="mt-1.5 text-[14px] text-muted-foreground"><span className="font-semibold text-foreground">Regional innovation base: </span>{cap.regionalBase}</p>
                <p className="mt-1.5 text-[14px] text-muted-foreground"><span className="font-semibold text-foreground">Proof of effect would be: </span>{cap.proof}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Map */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold text-foreground">Environmental evidence map</h2>
        <p className="mt-1 max-w-3xl text-[15px] text-muted-foreground">
          See the places BioVeracity has connected and how the available evidence relates across the
          region. Select a place to see its evidence and source-backed connections.
        </p>
        <p className="mb-4 mt-1 max-w-3xl text-[13px] text-muted-foreground/80">
          Only places with a source-backed location are plotted, and lines are drawn only where the
          public record establishes a direct relationship. Rivers are linear water bodies, so they
          are marked indicatively rather than pinned to a single point.
        </p>
        <RegionalMap points={mapPoints} connections={mapConnections} activeCategory={cat} />
        <div className="mt-4">
          <Link
            href="/regions/cambridgeshire-peterborough/live"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
          >
            Open the regional operating picture
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-1.5 text-[12px] text-muted-foreground/80">
            An immersive, time-based view of the same evidence — replay the record and watch the map
            and chronology move together. A product concept built on the real public record.
          </p>
        </div>
      </section>

      {/* Follow CTA */}
      <FollowRegionCTA />
    </div>
  )
}

function SnapshotCard({ n, label, tone = 'default', note }: { n: number; label: string; tone?: 'default' | 'gap'; note?: string }) {
  return (
    <div className={`rounded-lg border p-4 ${tone === 'gap' ? 'border-border bg-secondary/40' : 'border-border bg-white'}`}>
      <div className="font-display text-3xl font-bold text-foreground">{n}</div>
      <div className="mt-1 text-[13px] font-medium text-muted-foreground">{label}</div>
      {note && <div className="mt-1 text-[12px] text-muted-foreground/80">{note}</div>}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="text-foreground">{v}</dd>
    </div>
  )
}

function DiffCol({ k, v, tone = 'default' }: { k: string; v: string; tone?: 'default' | 'diff' }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === 'diff' ? 'border-destructive/30 bg-destructive/[0.04]' : 'border-border bg-white'}`}>
      <p className={`mb-1 text-[12px] font-semibold uppercase tracking-wide ${tone === 'diff' ? 'text-destructive' : 'text-muted-foreground'}`}>{k}</p>
      <p className="text-[14px] leading-snug text-foreground">{v}</p>
    </div>
  )
}

function CautiousEmpty({ cat }: { cat: string }) {
  const label = CHIPS.find((c) => c.id === cat)?.label?.toLowerCase() ?? 'this'
  return (
    <div className="rounded-lg border border-border bg-white p-8 text-center">
      <p className="text-[16px] text-muted-foreground">
        BioVeracity has not located recent {label} evidence across the region in the public sources reviewed.
      </p>
    </div>
  )
}

// One capability card per distinct capability, carrying the first gap that implies it.
function dedupeCapabilities(gaps: ShowGap[]) {
  const seen = new Set<string>()
  const out: { cap: ReturnType<typeof capabilityForGap>; gap: ShowGap }[] = []
  for (const g of gaps) {
    const cap = capabilityForGap(g.description)
    if (seen.has(cap.id)) continue
    seen.add(cap.id)
    out.push({ cap, gap: g })
  }
  return out
}

// One column of the "Where the evidence stands" doctrine triad.
function DoctrineCol({
  title,
  icon: Icon,
  items,
  tone = 'default',
  emptyText,
}: {
  title: string
  icon: LucideIcon
  items: string[]
  tone?: 'ok' | 'gap' | 'default'
  emptyText?: string
}) {
  const iconColor = tone === 'ok' ? 'text-foreground' : tone === 'gap' ? 'text-muted-foreground' : 'text-accent'
  const marker = tone === 'ok' ? 'text-foreground' : tone === 'gap' ? 'text-muted-foreground' : 'text-accent'
  return (
    <div className={`rounded-lg border border-border p-5 ${tone === 'gap' ? 'bg-secondary/40' : 'bg-white'}`}>
      <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-foreground">
        <Icon className={`h-4 w-4 shrink-0 ${iconColor}`} /> {title}
      </h3>
      {items.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2.5">
          {items.map((t, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-snug text-foreground">
              <span className={`mt-0.5 shrink-0 ${marker}`}>&bull;</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// Follow-region call to action. Individual place following works today; region-wide
// following is captured as interest here without pretending delivery exists yet.
function FollowRegionCTA() {
  const { data: session, status } = useSession() || {}
  const [mounted, setMounted] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined' && window.location.search.includes('followed=cambridgeshire')) {
      setConfirmed(true)
    }
  }, [])

  const registerInterest = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: session?.user?.name || 'BioVeracity user',
          email: session?.user?.email,
          issue: 'Regional follow interest: Cambridgeshire & Peterborough',
        }),
      })
    } catch {
      /* interest capture is best-effort; never block the UI */
    }
    setConfirmed(true)
    setSubmitting(false)
  }

  return (
    <section className="mt-12 rounded-xl border-2 border-accent/40 bg-accent/[0.05] p-6 text-center">
      <Bell className="mx-auto h-6 w-6 text-accent" />
      <h2 className="mt-2 font-display text-2xl font-bold text-foreground">Follow Cambridgeshire &amp; Peterborough</h2>
      {confirmed ? (
        <>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-foreground">
            Thanks &mdash; your interest in this region is recorded.
          </p>
          <p className="mx-auto mt-1 max-w-xl text-[14px] text-muted-foreground">
            You can already follow any individual place on its own record to track new evidence
            there. Region-wide following is being rolled out.
          </p>
        </>
      ) : (
        <>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted-foreground">
            Register your interest in this region &mdash; new regulatory records, projects, changes
            and evidence that closes an open question. You can already follow any individual place on
            its own record today.
          </p>
          {mounted && status === 'authenticated' ? (
            <button
              onClick={registerInterest}
              disabled={submitting}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-[16px] font-semibold text-accent-foreground hover:brightness-95 disabled:opacity-60"
            >
              <Bell className="h-4 w-4" /> {submitting ? 'Recording\u2026' : 'Register my interest'}
            </button>
          ) : (
            <Link
              href={`/signup?callbackUrl=${encodeURIComponent('/regions/cambridgeshire-peterborough?followed=cambridgeshire')}`}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-[16px] font-semibold text-accent-foreground hover:brightness-95"
            >
              <Bell className="h-4 w-4" /> Register my interest
            </Link>
          )}
        </>
      )}
    </section>
  )
}
