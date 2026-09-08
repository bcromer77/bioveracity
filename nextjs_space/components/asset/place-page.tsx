'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Shield, Landmark, Building2, BarChart3, Users, Newspaper, ExternalLink,
  AlertTriangle, ChevronDown, ChevronUp,
  Link2, Activity, HelpCircle, Compass, History, CheckCircle2,
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EvidenceBadge, EvidenceLegend } from '@/components/evidence-badge'
import { getEvidenceDisplay } from '@/lib/evidence-taxonomy'
import { SafeDate } from '@/components/safe-format'
import { PlaceTimeline } from '@/components/asset/place-timeline'
import { PlaceMap } from '@/components/asset/place-map'
import { PlaceAsk } from '@/components/asset/place-ask'
import { FollowButton } from '@/components/asset/follow-button'
import { ProducePdfButton } from '@/components/asset/produce-pdf-button'
import { CategoryChips, categoryLabel } from '@/components/category-chips'
import { itemInCategory, presentCategories } from '@/lib/categories'
import { ASK_ENABLED } from '@/lib/features'

const STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  monitoring: 'Monitoring',
  construction: 'Under construction',
  planning: 'In planning',
}

function changeLabel(kind?: string) {
  switch (kind) {
    case 'divergence': return 'Divergence'
    case 'material_change': return 'Material change'
    case 'corroboration': return 'Corroboration'
    case 'gap': return 'Not yet found'
    default: return 'Event'
  }
}

export function PlacePage({
  asset,
  isAuthed,
  isFollowing,
  isInstitutional = false,
}: {
  asset: any
  isAuthed: boolean
  isFollowing: boolean
  isInstitutional?: boolean
}) {
  const [tab, setTab] = useState('overview')
  const [category, setCategory] = useState('all')

  // Access gating is scoped to the Irish Ports module. Elsewhere the record
  // behaves exactly as before (treated as unrestricted).
  const isIrishPorts = asset?.regionSlug === 'irish_ports'
  const timelineUnrestricted = isInstitutional || !isIrishPorts

  const divergences = asset?.divergences ?? []
  const gaps = asset?.evidenceGaps ?? []
  const events = asset?.events ?? []
  const sourceCount =
    (asset?.regulatoryItems ?? []).length +
    (asset?.authorisations ?? []).length +
    (asset?.capitalProjects ?? []).length +
    (asset?.measurements ?? []).length +
    (asset?.communityItems ?? []).length +
    (asset?.newsItems ?? []).length

  const present = useMemo(() => presentCategories(events), [events])

  const filteredEvents = useMemo(
    () => events.filter((e: any) => itemInCategory(e, category)),
    [events, category],
  )

  const latestEvidence = useMemo(() => {
    return [...filteredEvents]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  }, [filteredEvents])

  const catActive = category !== 'all'

  return (
    <div className="mx-auto max-w-[900px] px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 text-[14px] text-muted-foreground">
          <span className="capitalize">{asset?.subtype ?? asset?.type ?? ''}</span>
          {' · '}
          <Link
            href={`/regions/${(asset?.regionSlug ?? '').replace(/_/g, '-')}`}
            className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2"
          >
            {asset?.jurisdiction ?? asset?.region ?? ''}
          </Link>
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {asset?.name ?? 'Unknown place'}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px] text-muted-foreground">
          <span>{STATUS_LABELS[asset?.status ?? 'active'] ?? asset?.status}</span>
          {asset?.operatorName && <span>Operator: {asset.operatorName}</span>}
          {asset?.regulatorName && <span>Regulator: {asset.regulatorName}</span>}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <FollowButton assetId={asset?.id} assetName={asset?.name} isAuthed={isAuthed} isFollowing={isFollowing} categories={present} />
          <ProducePdfButton asset={asset} isAuthed={isAuthed} />
        </div>
        <p className="mt-2 text-[14px] text-muted-foreground">
          Follow this place to get notified when material new evidence appears here.
        </p>
      </div>

      {/* WHAT DO YOU WANT TO CHECK? */}
      {present.length > 0 && (
        <div className="mb-6 rounded-lg border border-border bg-secondary/40 p-4">
          <CategoryChips present={present} selected={category} onSelect={setCategory} />
        </div>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1 border-b border-border bg-transparent p-0">
          {['overview', 'timeline', 'evidence', 'map', ...(ASK_ENABLED ? ['ask'] : [])].map((t) => (
            <TabsTrigger
              key={t}
              value={t}
              className="rounded-none border-b-2 border-transparent bg-transparent px-4 py-2.5 text-[15px] font-medium text-muted-foreground data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {t === 'ask' ? 'Ask' : t.charAt(0).toUpperCase() + t.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-8">
          <section>
            <h2 className="mb-3 font-display text-xl font-bold text-foreground">What happened</h2>
            <p className="text-[17px] leading-relaxed text-foreground/90">
              {asset?.description ?? asset?.summary ?? 'No detailed description recorded yet.'}
            </p>
            <p className="mt-3 text-[15px] text-muted-foreground">
              {events.length} event{events.length === 1 ? '' : 's'} on record from {sourceCount} source record{sourceCount === 1 ? '' : 's'}.
            </p>
          </section>

          {/* EVIDENCE DOCTRINE — the structured reading of this place (Irish Ports) */}
          {!catActive && isIrishPorts && <PlaceDoctrine asset={asset} onReplay={() => setTab('timeline')} />}

          {/* THE EVIDENCE CHANGES HERE — loud divergence marker (only under Everything) */}
          {!catActive && divergences.length > 0 && (
            <section className="rounded-lg border-2 border-destructive/40 bg-destructive/[0.04] p-5">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <h2 className="font-display text-lg font-bold uppercase tracking-wide">The evidence starts to differ here</h2>
              </div>
              <p className="mt-2 text-[16px] font-semibold text-foreground">{divergences[0].title}</p>
              <p className="mt-1 text-[15px] text-muted-foreground">
                First difference <SafeDate date={divergences[0].date} options={{ dateStyle: 'long' }} />
              </p>
              {divergences[0].summary && (
                <p className="mt-2 text-[15px] leading-relaxed text-foreground/85">{divergences[0].summary}</p>
              )}
              <button
                onClick={() => setTab('timeline')}
                className="mt-4 inline-flex items-center rounded-md bg-destructive px-5 py-2.5 text-[15px] font-semibold text-destructive-foreground transition-colors hover:brightness-95"
              >
                See what changed
              </button>
              {divergences.length > 1 && (
                <p className="mt-3 text-[14px] text-muted-foreground">
                  {divergences.length - 1} further difference{divergences.length - 1 === 1 ? '' : 's'} on the timeline.
                </p>
              )}
            </section>
          )}

          {/* Latest evidence */}
          <section>
            <h2 className="mb-4 font-display text-xl font-bold text-foreground">
              {catActive ? `Latest evidence · ${categoryLabel(category)}` : 'Latest evidence'}
            </h2>
            {latestEvidence.length > 0 ? (
              <>
                <ul className="divide-y divide-border border-y border-border">
                  {latestEvidence.map((e: any) => (
                    <li key={e.id} className="flex items-start gap-3 py-3">
                      <span className="mt-0.5"><EvidenceBadge classCode={e.evidenceClass ?? 'A'} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-medium text-foreground">{e.title}</p>
                        <p className="mt-0.5 text-[14px] text-muted-foreground">
                          <SafeDate date={e.date} options={{ dateStyle: 'long' }} />
                          {e.changeType && e.changeType !== 'event' ? ` · ${changeLabel(e.changeType)}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => setTab('timeline')}
                  className="mt-4 text-[15px] text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2"
                >
                  See the full timeline →
                </button>
              </>
            ) : (
              <p className="rounded-lg border border-border bg-secondary/40 p-4 text-[15px] text-muted-foreground">
                BioVeracity has not located {categoryLabel(category).toLowerCase()} evidence in the public sources reviewed for this place.
              </p>
            )}
          </section>

          {/* What we haven't found — cautious framing */}
          {gaps.length > 0 && (
            <section>
              <h2 className="mb-1 font-display text-xl font-bold text-foreground">What we haven&rsquo;t found</h2>
              <p className="mb-3 text-[15px] text-muted-foreground">
                BioVeracity has not located the following in the public sources reviewed for this place. Absence here is not proof that nothing happened — only that the record is, so far, silent.
              </p>
              <ul className="space-y-3">
                {gaps.slice(0, 4).map((g: any) => (
                  <li key={g.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                    <p className="text-[16px] font-medium text-foreground">{g.description}</p>
                    {g.consequence && (
                      <p className="mt-1 text-[14px] text-muted-foreground"><span className="font-medium">Why it matters:</span> {g.consequence}</p>
                    )}
                    {g.dataRequired && (
                      <p className="mt-1 text-[14px] text-muted-foreground"><span className="font-medium">What would resolve it:</span> {g.dataRequired}</p>
                    )}
                    <p className="mt-1.5 text-[12px] uppercase tracking-wide text-muted-foreground/80">Classification: Evidence gap</p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </TabsContent>

        {/* TIMELINE */}
        <TabsContent value="timeline">
          <PlaceTimeline asset={asset} categoryFilter={category} isInstitutional={timelineUnrestricted} />
        </TabsContent>

        {/* EVIDENCE */}
        <TabsContent value="evidence" className="space-y-6">
          <p className="text-[14px] text-muted-foreground">
            Each record can be opened to show its full provenance — source, publishing body, dates and reference. You do not need to open anything to read the summary; the detail is there for those who need to check it.
          </p>

          <EvidenceSection title="Regulatory activity" icon={Shield} rows={asset?.regulatoryItems ?? []} render={(r: any) => (
            <SourceRow key={r.id} classCode={r.evidenceClass ?? 'R'} title={r.title} desc={r.description} meta={[r.regulator, r.date && fmtNode(r.date)]} url={r.sourceUrl}
              details={[
                ['Record type', 'Regulatory activity'],
                ['Activity type', r.type],
                ['Publishing body', r.regulator],
                ['Event date', r.date ? fmtLong(r.date) : null],
                ['Outcome', r.outcome],
                ['Retrieved', r.createdAt ? fmtLong(r.createdAt) : null],
              ]}
            />
          )} empty="No regulatory activity recorded." />

          <EvidenceSection title="Authorisations" icon={Landmark} rows={asset?.authorisations ?? []} render={(a: any) => (
            <SourceRow key={a.id} classCode={a.evidenceClass ?? 'R'} title={a.description ?? a.type} desc={a.permitRef ? `Ref: ${a.permitRef}` : null} meta={[a.authority, `status: ${a.status ?? 'active'}`]} url={a.sourceUrl}
              details={[
                ['Record type', 'Authorisation'],
                ['Authorisation type', a.type],
                ['Permit / licence ref', a.permitRef],
                ['Issuing authority', a.authority],
                ['Granted', a.grantedDate ? fmtLong(a.grantedDate) : null],
                ['Expiry', a.expiryDate ? fmtLong(a.expiryDate) : null],
                ['Status', a.status],
                ['Conditions', a.conditions],
              ]}
            />
          )} empty="No authorisations recorded." />

          <EvidenceSection title="Capital projects" icon={Building2} rows={asset?.capitalProjects ?? []} render={(p: any) => (
            <SourceRow key={p.id} classCode={p.evidenceClass ?? 'O'} title={`${p.name}${p.value ? ' · ' + p.value : ''}`} desc={p.description} meta={[`status: ${p.status ?? 'planned'}`, p.contractor]} url={p.sourceUrl}
              details={[
                ['Record type', 'Capital project'],
                ['Reported value', p.value],
                ['Status', p.status],
                ['Contractor', p.contractor],
                ['Start', p.startDate ? fmtLong(p.startDate) : null],
                ['Expected completion', p.endDate ? fmtLong(p.endDate) : null],
                ['Proof required', p.proofRequired],
              ]}
            />
          )} empty="No capital projects recorded." />

          <EvidenceSection title="Environmental monitoring" icon={BarChart3} rows={asset?.measurements ?? []} render={(m: any) => (
            <SourceRow key={m.id} classCode={m.evidenceClass ?? 'R'} title={`${m.parameter}: ${m.value ?? ''} ${m.unit ?? ''}`} desc={m.station} meta={[fmtNode(m.date), m.validated ? null : 'non-validated']} url={m.sourceUrl}
              details={[
                ['Record type', 'Measurement'],
                ['Parameter', m.parameter],
                ['Value', m.value != null ? `${m.value} ${m.unit ?? ''}`.trim() : null],
                ['Monitoring station', m.station],
                ['Sample date', m.date ? fmtLong(m.date) : null],
                ['Validated', m.validated ? 'Yes' : 'Not validated'],
              ]}
            />
          )} empty="No measurement data available. BioVeracity has not located monitoring for this place in the public sources reviewed." />

          <EvidenceSection title="Community context" icon={Users} rows={asset?.communityItems ?? []} render={(c: any) => (
            <SourceRow key={c.id} classCode={c.evidenceClass ?? 'C'} title={c.title} desc={c.description} meta={[c.reportedBy, c.date && fmtNode(c.date)]} url={c.sourceUrl} note="Community reports are evidence of concern, not proof of violation."
              details={[
                ['Record type', 'Community report'],
                ['Report type', c.type],
                ['Reported by', c.reportedBy],
                ['Date', c.date ? fmtLong(c.date) : null],
                ['Corroborated', c.corroborated ? 'Yes' : 'Not corroborated'],
              ]}
            />
          )} empty="No community reports recorded." />

          <EvidenceSection title="Recent sources" icon={Newspaper} rows={asset?.newsItems ?? []} render={(n: any) => (
            <SourceRow key={n.id} classCode={n.evidenceClass ?? 'M'} title={n.title} desc={null} meta={[n.sourceDomain, fmtNode(n.date)]} url={n.sourceUrl}
              details={[
                ['Record type', 'Media report'],
                ['Publisher', n.sourceDomain],
                ['Publication date', n.date ? fmtLong(n.date) : null],
              ]}
            />
          )} empty="No recent news items." />

          <div className="pt-1"><EvidenceLegend /></div>
        </TabsContent>

        {/* MAP */}
        <TabsContent value="map">
          <PlaceMap lat={asset?.latitude} lng={asset?.longitude} name={asset?.name} type={asset?.type} />
          <p className="mt-3 text-[14px] italic text-muted-foreground">
            {asset?.type === 'river'
              ? 'Indicative location only. A river is a linear water body, so the map marks a representative point on its course for orientation — not a discharge or monitoring location.'
              : 'Location context only. The map orients you to the place — it does not itself assert what is happening there.'}
          </p>
        </TabsContent>

        {/* ASK */}
        {ASK_ENABLED && (
          <TabsContent value="ask">
            <section>
              <h2 className="mb-1 font-display text-xl font-bold text-foreground">Ask about {asset?.name}</h2>
              <p className="mb-4 text-[15px] text-muted-foreground">Answers are drawn only from the evidence on record, and say what is not known.</p>
              <PlaceAsk assetName={asset?.name} />
            </section>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

function EvidenceSection({ title, icon: Icon, rows, render, empty }: { title: string; icon: any; rows: any[]; render: (r: any) => any; empty: string }) {
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-foreground">
        <Icon className="h-5 w-5 text-muted-foreground" /> {title}
        <span className="ml-1 text-[14px] font-normal text-muted-foreground">({rows?.length ?? 0})</span>
      </h2>
      {rows?.length ? <div className="space-y-2">{rows.map(render)}</div> : <p className="text-[15px] italic text-muted-foreground">{empty}</p>}
    </div>
  )
}

function SourceRow({ classCode, title, desc, meta, url, note, details }: {
  classCode: string; title: string; desc?: string | null; meta?: (any)[]; url?: string | null; note?: string;
  details?: [string, any][]
}) {
  const [open, setOpen] = useState(false)
  const metaItems = (meta ?? []).filter(Boolean)
  const detailItems = (details ?? []).filter(([, v]) => v != null && v !== '')
  const taxonomy = getEvidenceDisplay(classCode)
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5"><EvidenceBadge classCode={classCode} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-medium text-foreground">{title}</p>
          {desc && <p className="mt-1 text-[14px] text-muted-foreground">{desc}</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {metaItems.map((m, i) => <span key={i} className="text-[13px] text-muted-foreground">{m}</span>)}
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[13px] text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">
                Source <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {detailItems.length > 0 && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                {open ? 'Hide provenance' : 'Show provenance'}
                {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          {note && <p className="mt-1.5 text-[13px] italic text-muted-foreground">{note}</p>}

          {open && detailItems.length > 0 && (
            <dl className="mt-3 grid grid-cols-[150px_1fr] gap-x-4 gap-y-1.5 border-t border-border pt-3 text-[13px]">
              {detailItems.map(([label, value], i) => (
                <div key={i} className="contents">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-foreground">{value}</dd>
                </div>
              ))}
              <div className="contents">
                <dt className="text-muted-foreground">Classification</dt>
                <dd className="text-foreground">{taxonomy.label}</dd>
              </div>
              {url && (
                <div className="contents">
                  <dt className="text-muted-foreground">Source URL</dt>
                  <dd className="min-w-0 break-all">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-[hsl(var(--link))] underline underline-offset-2 hover:decoration-2">{url}</a>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </div>
  )
}

function fmtNode(date: any) {
  return <SafeDate date={date} options={{ dateStyle: 'medium' }} />
}

function fmtLong(date: any) {
  return <SafeDate date={date} options={{ dateStyle: 'long' }} />
}

// ---------------------------------------------------------------------------
// Evidence doctrine — the structured reading of a place (Irish Ports module).
// Every block is drawn from real, source-backed rows; empty blocks say so.
// ---------------------------------------------------------------------------
function DoctrineCard({
  icon: Icon,
  title,
  children,
}: {
  icon: any
  title: string
  children: any
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 font-display text-[17px] font-bold text-foreground">
        <Icon className="h-5 w-5 text-muted-foreground" />
        {title}
      </h3>
      {children}
    </div>
  )
}

function Empty({ children }: { children: any }) {
  return <p className="text-[14px] italic text-muted-foreground">{children}</p>
}

function PlaceDoctrine({ asset, onReplay }: { asset: any; onReplay: () => void }) {
  const projects: any[] = asset?.capitalProjects ?? []
  const permits: any[] = asset?.authorisations ?? []
  const changes: any[] = asset?.changeRecords ?? []
  const questions: any[] = asset?.unresolvedQuestions ?? []
  const relFrom: any[] = asset?.relationsFrom ?? []
  const relTo: any[] = asset?.relationsTo ?? []
  const relations = [
    ...relFrom.map((r) => ({ id: r.id, other: r.toAsset, type: r.relationshipType, url: r.sourceUrl })),
    ...relTo.map((r) => ({ id: r.id, other: r.fromAsset, type: r.relationshipType, url: r.sourceUrl })),
  ]

  const changeTitle = (ct: string) => {
    switch (ct) {
      case 'INTERVENTION_RECORDED': return 'Intervention recorded'
      case 'NEW_UNRESOLVED_QUESTION': return 'New evidence requirement identified'
      case 'MATERIAL_CHANGE': return 'Material change'
      case 'RECORD_ADDED': return 'Record added'
      case 'GAP_RESOLVED': return 'Gap resolved'
      case 'UNCERTAINTY_REDUCED': return 'Uncertainty reduced'
      case 'EVIDENCE_DIVERGENCE': return 'Evidence divergence'
      case 'RESOLUTION_PATH_IDENTIFIED': return 'Resolution path identified'
      case 'DECISION_OR_DEADLINE_CHANGED': return 'Decision or deadline changed'
      default: return 'Change'
    }
  }

  const evidenceType = (t: string) =>
    (t || '').toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <section className="space-y-4">
      {/* What is connected here */}
      <DoctrineCard icon={Link2} title="What is connected here">
        {projects.length || permits.length || relations.length ? (
          <div className="space-y-4">
            {projects.length > 0 && (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Projects &amp; interventions</p>
                <ul className="space-y-1.5">
                  {projects.map((p) => (
                    <li key={p.id} className="text-[15px] text-foreground">
                      <span className="font-medium">{p.name}</span>
                      {p.value ? <span className="text-muted-foreground"> · {p.value}</span> : null}
                      {p.sourceUrl && (
                        <a href={p.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-[13px] text-[hsl(var(--link))] underline underline-offset-2">
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {permits.length > 0 && (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Authorisations</p>
                <ul className="space-y-1.5">
                  {permits.map((a) => (
                    <li key={a.id} className="text-[15px] text-foreground">
                      <span className="font-medium capitalize">{(a.type || '').replace(/_/g, ' ')}</span>
                      {a.permitRef ? <span className="text-muted-foreground"> · {a.permitRef}</span> : null}
                      {a.authority ? <span className="text-muted-foreground"> · {a.authority}</span> : null}
                      {a.sourceUrl && (
                        <a href={a.sourceUrl} target="_blank" rel="noopener noreferrer" className="ml-1.5 inline-flex items-center gap-0.5 text-[13px] text-[hsl(var(--link))] underline underline-offset-2">
                          Source <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {relations.length > 0 && (
              <div>
                <p className="mb-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">Related places</p>
                <ul className="space-y-1.5">
                  {relations.map((r) => (
                    <li key={r.id} className="text-[15px] text-foreground">
                      <span className="capitalize text-muted-foreground">{(r.type || '').replace(/_/g, ' ').toLowerCase()}: </span>
                      {r.other?.slug ? (
                        <Link href={`/asset/${r.other.slug}`} className="font-medium text-[hsl(var(--link))] underline underline-offset-2">{r.other.name}</Link>
                      ) : (
                        <span className="font-medium">{r.other?.name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <Empty>No projects, authorisations or related places connected yet.</Empty>
        )}
      </DoctrineCard>

      {/* What changed */}
      <DoctrineCard icon={Activity} title="What changed">
        {changes.length ? (
          <ul className="space-y-3">
            {changes.map((c) => (
              <li key={c.id} className="border-l-2 border-accent/50 pl-3">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">{changeTitle(c.changeType)}</p>
                <p className="text-[15px] font-medium text-foreground">{c.title}</p>
                {c.description && <p className="mt-0.5 text-[14px] text-muted-foreground">{c.description}</p>}
                {c.eventDate && (
                  <p className="mt-0.5 text-[13px] text-muted-foreground"><SafeDate date={c.eventDate} options={{ dateStyle: 'long' }} /></p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No material changes published for this place yet.</Empty>
        )}
      </DoctrineCard>

      {/* What remains unresolved / what would help answer it */}
      <DoctrineCard icon={HelpCircle} title="What remains unresolved">
        {questions.length ? (
          <div className="space-y-5">
            {questions.map((q) => (
              <div key={q.id}>
                <p className="text-[15px] font-medium text-foreground">{q.question}</p>
                {q.resolutionPaths?.length ? (
                  <div className="mt-2">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Compass className="h-3.5 w-3.5" /> What would help answer it
                    </p>
                    <ul className="space-y-1.5">
                      {q.resolutionPaths.map((rp: any) => (
                        <li key={rp.id} className="text-[14px] text-foreground">
                          <span className="font-medium">{evidenceType(rp.evidenceType)}</span>
                          {rp.description ? <span className="text-muted-foreground"> — {rp.description}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-1 text-[14px] italic text-muted-foreground">No resolution path recorded yet.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty>No open evidence questions recorded for this place yet.</Empty>
        )}
      </DoctrineCard>

      {/* Replay */}
      <button
        onClick={onReplay}
        className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-4 py-2.5 text-[15px] font-medium text-foreground transition-colors hover:bg-secondary"
      >
        <History className="h-4 w-4 text-muted-foreground" />
        Replay this place through time
      </button>
    </section>
  )
}
