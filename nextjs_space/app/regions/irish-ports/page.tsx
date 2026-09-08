import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { FadeIn } from '@/components/ui/animate'
import { SafeDate } from '@/components/safe-format'
import {
  IrishPortsExplorer,
  type PortCard,
  type CategoryCard,
} from '@/components/regions/irish-ports/explorer'
import { IRISH_PORT_LENSES } from '@/lib/irish-ports-lenses'
import {
  ArrowRight, Building2, Ship, Cpu, Zap, Scale, Radar, GraduationCap, ShieldCheck,
  Ruler, Wrench, Activity, FileSearch,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

const REGION_SLUG = 'irish_ports'

export const metadata = {
  title: 'Irish ports — Maritime environmental evidence picture | BioVeracity',
  description:
    'One evidence picture across ports, infrastructure, projects and the environment. Follow what changed before, during and after major maritime interventions — assembled from the public record. Irish ports are the current demonstration dataset for an architecture built to scale.',
}

const STATUS_LABELS: Record<string, string> = {
  planning: 'In planning',
  construction: 'In construction',
  active: 'Operational',
  operational: 'Operational',
}

export default async function IrishPortsPage() {
  const session = await auth()
  const isAuthed = !!session?.user

  const assets = await prisma.asset.findMany({
    where: { regionSlug: REGION_SLUG },
    orderBy: { priorityScore: 'desc' },
    include: {
      events: { orderBy: { date: 'desc' } },
      capitalProjects: { orderBy: { createdAt: 'desc' } },
      authorisations: true,
      unresolvedQuestions: { include: { resolutionPaths: true } },
      _count: { select: { events: true, capitalProjects: true, divergences: true } },
    },
  })

  // Item 4 - what a programme director needs: material changes from the
  // ChangeRecord ledger (published only), not "N new records arrived".
  const assetName = new Map(assets.map((a) => [a.id, a.name] as const))
  const changeRecords = await prisma.changeRecord.findMany({
    where: { published: true, assetId: { in: assets.map((a) => a.id) } },
    orderBy: [{ eventDate: 'desc' }, { detectedAt: 'desc' }],
  })

  // Which of this user's followed places are Irish ports.
  let followed = new Set<string>()
  if (isAuthed && session?.user?.id) {
    const rows = await prisma.watchlist.findMany({
      where: { userId: session.user.id, assetId: { in: assets.map((a) => a.id) } },
      select: { assetId: true },
    })
    followed = new Set(rows.map((r) => r.assetId))
  }

  // Build the record corpus for keyword-matched lenses (nothing fabricated).
  type Rec = { portSlug: string; title: string; text: string }
  const records: Rec[] = []
  for (const a of assets) {
    const base = `${a.summary ?? ''} ${a.statusDetail ?? ''} ${a.subtype ?? ''}`
    for (const e of a.events) {
      records.push({
        portSlug: a.slug,
        title: e.title,
        text: ` ${e.title} ${e.description ?? ''} ${e.eventType ?? ''} ${base} `.toLowerCase(),
      })
    }
    for (const cp of a.capitalProjects) {
      records.push({ portSlug: a.slug, title: cp.name, text: ` ${cp.name} ${base} `.toLowerCase() })
    }
    for (const au of a.authorisations) {
      records.push({
        portSlug: a.slug,
        title: au.description ?? au.permitRef ?? `${au.type} authorisation`,
        text: ` ${au.description ?? ''} ${au.type ?? ''} ${au.permitRef ?? ''} ${au.authority ?? ''} ${base} `.toLowerCase(),
      })
    }
  }

  const matchRec = (r: Rec, keywords: string[]) => keywords.some((k) => r.text.includes(k))

  const categories: CategoryCard[] = IRISH_PORT_LENSES.map((lens) => {
    const matched = records.filter((r) => matchRec(r, lens.keywords))
    const titles = Array.from(new Set(matched.map((m) => m.title)))
    return {
      id: lens.id,
      label: lens.label,
      description: lens.description,
      count: matched.length,
      sampleTitles: titles,
      cleanMaritime: lens.cleanMaritime,
    }
  })

  // Per-port lens membership + connected evidence domains (honest, from records).
  const portLensIds = (slug: string): string[] =>
    IRISH_PORT_LENSES.filter((lens) =>
      records.some((r) => r.portSlug === slug && matchRec(r, lens.keywords)),
    ).map((l) => l.id)

  const ports: PortCard[] = assets.map((a) => {
    const lensIds = portLensIds(a.slug)
    const domains = IRISH_PORT_LENSES.filter((l) => l.domainLabel && lensIds.includes(l.id)).map(
      (l) => l.domainLabel as string,
    )
    const latest = a.events[0]
    return {
      id: a.id,
      slug: a.slug,
      name: a.name,
      statusLabel: STATUS_LABELS[a.status] ?? 'On record',
      operatorName: a.operatorName,
      regulatorName: a.regulatorName,
      latestTitle: latest?.title ?? null,
      latestDate: latest ? latest.date.toISOString() : null,
      latestClass: latest?.evidenceClass ?? null,
      projectCount: a._count.capitalProjects,
      projectNames: a.capitalProjects.map((c) => c.name),
      domains,
      categoryIds: lensIds,
      divergenceCount: a._count.divergences,
      eventCount: a._count.events,
      isFollowing: followed.has(a.id),
      summary: a.summary,
    }
  })

  // §5 - worked intervention example, derived entirely from the connected
  // records (no page-logic guesses). The operation milestone is the connected
  // record that marks the terminal entering service; baseline = records before
  // it; deployment = the capital project(s); after = the honest gap captured as
  // an UnresolvedQuestion with resolution paths.
  const cork = assets.find((a) => a.slug === 'port-of-cork')
  const corkEvents = cork ? [...cork.events].sort((x, y) => x.date.getTime() - y.date.getTime()) : []
  const corkOperation =
    corkEvents.find((e) => e.title === 'Cork Container Terminal officially opened') ??
    corkEvents.find((e) => e.eventType === 'operational') ??
    null
  const corkProject =
    cork?.capitalProjects.find((c) => c.name.startsWith('Cork Container Terminal')) ?? null
  const opTime = corkOperation ? corkOperation.date.getTime() : Number.POSITIVE_INFINITY
  const corkBaseline = corkEvents.filter((e) => e.date.getTime() < opTime)
  const corkAfter = corkEvents.filter(
    (e) => e.date.getTime() > opTime && e.id !== corkOperation?.id,
  )
  const corkQuestion = cork?.unresolvedQuestions[0] ?? null

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        {/* §2 — Hero */}
        <section className="relative isolate overflow-hidden bg-[#0b1524] text-white">
          <div className="absolute inset-0">
            <Image
              src="/maritime/port-estuary-aerial.jpg"
              alt="High-altitude aerial view of a commercial seaport within its estuary and coastline"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b1524] via-[#0b1524]/80 to-[#0b1524]/40" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b1524]/90 to-transparent" />
          </div>
          <div className="relative mx-auto max-w-[1200px] px-4 py-24 md:py-32">
            <FadeIn>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] font-medium tracking-wide text-white/80">
                Current demonstration dataset · Ireland&rsquo;s ports
              </div>
              <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
                Irish ports
              </h1>
              <p className="mt-4 max-w-2xl text-[19px] font-medium leading-relaxed text-white/90 md:text-[22px]">
                One evidence picture across ports, infrastructure, projects and the environment.
              </p>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/70 md:text-[16px]">
                Follow what changed before, during and after major maritime interventions — assembled from the
                public record, traced to source, and honest about what remains unresolved.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="#portfolio"
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-[15px] font-semibold text-accent-foreground transition hover:brightness-95"
                >
                  Explore Irish ports <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/regions/irish-ports/live"
                  className="inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/5 px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-white/10"
                >
                  Open regional operating picture
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* §3 + §4 + §6 */}
        <IrishPortsExplorer ports={ports} categories={categories} isAuthed={isAuthed} />

        {/* §5 - Project -> Baseline -> Deployment -> Operation -> Unresolved */}
        {cork && (
          <section id="proof-of-effect" className="border-y border-border bg-secondary/30">
            <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
              <FadeIn>
                <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-[12px] font-semibold tracking-wide text-accent">
                  BioVeracity Proof of Effect
                </div>
                <h2 className="mt-4 font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  What changed after the intervention?
                </h2>
                <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                  For a qualifying maritime project BioVeracity preserves the same chronology: what was true
                  before, what was deployed, when it entered operation, and what the evidence does &mdash; and does
                  not yet &mdash; establish afterwards. The worked example is{' '}
                  <span className="font-semibold text-foreground">{corkProject?.name ?? cork.name}</span>, and every
                  statement below links to its source. We never assert that a project &ldquo;worked&rdquo;.
                </p>
              </FadeIn>

              {/* Project header */}
              {corkProject && (
                <div className="mt-8 rounded-xl border-2 border-accent bg-accent/5 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-accent">Project</p>
                      <p className="mt-1 text-[17px] font-bold text-foreground">{corkProject.name}</p>
                    </div>
                    {corkProject.value && (
                      <span className="rounded-md bg-white px-3 py-1 text-[13px] font-semibold text-foreground shadow-sm">
                        {corkProject.value}
                      </span>
                    )}
                  </div>
                  {corkProject.description && (
                    <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{corkProject.description}</p>
                  )}
                  {corkProject.sourceUrl && (
                    <a
                      href={corkProject.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:underline"
                    >
                      <FileSearch className="h-3.5 w-3.5" /> View source
                    </a>
                  )}
                </div>
              )}

              {/* Baseline / Deployment / Operation */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* BASELINE */}
                <div className="rounded-xl border border-border bg-white p-5">
                  <div className="flex items-center gap-2 text-accent">
                    <Ruler className="h-4 w-4" />
                    <p className="text-[13px] font-semibold uppercase tracking-wide">Baseline</p>
                  </div>
                  <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-foreground">
                    {corkBaseline.length > 0 ? (
                      corkBaseline.map((e) => (
                        <div key={e.id}>
                          <p>
                            {e.title}{' '}
                            (<SafeDate date={e.date.toISOString()} options={{ year: 'numeric' }} />)
                          </p>
                          {e.sourceUrl ? (
                            <a href={e.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                              <FileSearch className="h-3 w-3" /> Source
                            </a>
                          ) : e.sourceDomain ? (
                            <span className="mt-1 block text-[12px] text-muted-foreground">Source: {e.sourceDomain}</span>
                          ) : null}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No verified baseline records connected yet.</p>
                    )}
                  </div>
                  <p className="mt-3 text-[12px] text-muted-foreground">What was consented and true before.</p>
                </div>

                {/* DEPLOYMENT */}
                <div className="rounded-xl border border-border bg-white p-5">
                  <div className="flex items-center gap-2 text-accent">
                    <Wrench className="h-4 w-4" />
                    <p className="text-[13px] font-semibold uppercase tracking-wide">Deployment</p>
                  </div>
                  <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-foreground">
                    {cork.capitalProjects.length > 0 ? (
                      cork.capitalProjects.map((cp) => (
                        <div key={cp.id}>
                          <p>{cp.name}{cp.value ? ` (${cp.value})` : ''}</p>
                          {cp.sourceUrl && (
                            <a href={cp.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                              <FileSearch className="h-3 w-3" /> Source
                            </a>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No verified deployment records connected yet.</p>
                    )}
                  </div>
                  <p className="mt-3 text-[12px] text-muted-foreground">What was funded and built.</p>
                </div>

                {/* OPERATION */}
                <div className="rounded-xl border border-border bg-white p-5">
                  <div className="flex items-center gap-2 text-accent">
                    <Activity className="h-4 w-4" />
                    <p className="text-[13px] font-semibold uppercase tracking-wide">Operation</p>
                  </div>
                  <div className="mt-3 space-y-3 text-[14px] leading-relaxed text-foreground">
                    {corkOperation ? (
                      <div>
                        <p>
                          {corkOperation.title}{' '}
                          (<SafeDate date={corkOperation.date.toISOString()} options={{ day: 'numeric', month: 'long', year: 'numeric' }} />)
                        </p>
                        {corkOperation.sourceUrl && (
                          <a href={corkOperation.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-accent hover:underline">
                            <FileSearch className="h-3 w-3" /> Source
                          </a>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No verified operation record connected yet.</p>
                    )}
                  </div>
                  <p className="mt-3 text-[12px] text-muted-foreground">When it entered service.</p>
                </div>
              </div>

              {/* What remains unresolved + what would help answer it */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-white p-5">
                  <div className="flex items-center gap-2 text-foreground">
                    <FileSearch className="h-4 w-4 text-accent" />
                    <p className="text-[13px] font-semibold uppercase tracking-wide">What remains unresolved</p>
                  </div>
                  {corkQuestion ? (
                    <p className="mt-3 text-[14px] leading-relaxed text-foreground">{corkQuestion.question}</p>
                  ) : (
                    <p className="mt-3 text-[14px] text-muted-foreground">No open evidence question connected yet.</p>
                  )}
                  {corkAfter.length === 0 && (
                    <p className="mt-3 text-[13px] font-medium text-foreground">No verified environmental after-evidence connected yet.</p>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-white p-5">
                  <div className="flex items-center gap-2 text-foreground">
                    <Activity className="h-4 w-4 text-accent" />
                    <p className="text-[13px] font-semibold uppercase tracking-wide">What would help answer it</p>
                  </div>
                  {corkQuestion && corkQuestion.resolutionPaths.length > 0 ? (
                    <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-foreground">
                      {corkQuestion.resolutionPaths.map((rp) => (
                        <li key={rp.id} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 flex-none rounded-full bg-accent" />
                          <span>{rp.description}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-[14px] text-muted-foreground">No resolution path identified yet.</p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Item 4 - What changed across Irish ports? (from ChangeRecord ledger) */}
        <section id="what-changed" className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
          <FadeIn>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              What changed across Irish ports?
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              Not a feed of new files. These are the material changes across the portfolio &mdash; a project entering
              operation, an application lodged, a new evidence requirement identified &mdash; each anchored to a date
              and a port.
            </p>
          </FadeIn>
          {changeRecords.length > 0 ? (
            <ul className="mt-8 space-y-3">
              {changeRecords.map((c) => (
                <li key={c.id} className="flex flex-col gap-2 rounded-xl border border-border bg-white p-5 sm:flex-row sm:items-start sm:gap-4">
                  <span className="inline-flex w-fit flex-none items-center rounded-md bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.changeType.replace(/_/g, ' ')}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-foreground">{c.title}</p>
                    {c.description && (
                      <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{c.description}</p>
                    )}
                    <p className="mt-2 text-[12px] text-muted-foreground">
                      {assetName.get(c.assetId ?? '') ?? 'Irish ports'}
                      {c.eventDate ? (
                        <> &middot; <SafeDate date={c.eventDate.toISOString()} options={{ day: 'numeric', month: 'long', year: 'numeric' }} /></>
                      ) : null}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-8 rounded-xl border border-border bg-white p-6 text-[14px] text-muted-foreground">
              No material changes connected yet.
            </p>
          )}
        </section>

        {/* §11 — Consortium view */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
          <FadeIn>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              One project. Many evidence owners.
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              A major maritime intervention is never owned by one organisation. Each keeps its own
              responsibility. BioVeracity preserves the shared, source-backed chronology that connects them.
            </p>
          </FadeIn>
          <div className="mt-8 rounded-xl border border-border bg-white p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-md bg-[#0b1524] px-4 py-2 text-[15px] font-semibold text-white">
              <Building2 className="h-4 w-4" /> Port
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: Ship, label: 'Vessel operator' },
                { icon: Cpu, label: 'Technology provider' },
                { icon: Zap, label: 'Energy / infrastructure partner' },
                { icon: Scale, label: 'Regulator' },
                { icon: Radar, label: 'Environmental monitoring' },
                { icon: GraduationCap, label: 'Research partner' },
              ].map((n) => {
                const Icon = n.icon
                return (
                  <div key={n.label} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/40 px-4 py-3">
                    <Icon className="h-4 w-4 text-accent" />
                    <span className="text-[14px] font-medium text-foreground">{n.label}</span>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 flex items-center gap-3 rounded-lg border-2 border-accent bg-accent/10 px-4 py-3">
              <ShieldCheck className="h-4 w-4 text-accent" />
              <span className="text-[14px] font-semibold text-foreground">BioVeracity evidence layer — the shared source-backed chronology</span>
            </div>
          </div>
        </section>

        {/* §12 — From demonstration to evidence */}
        <section className="border-y border-border bg-[#0b1524] text-white">
          <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
            <FadeIn>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">From demonstration to evidence</h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-white/70">
                Every intervention follows the same path. BioVeracity keeps each step on one common clock, so the
                promise made at the start can be checked against what the evidence later shows.
              </p>
            </FadeIn>
            <div className="mt-8 flex flex-wrap items-stretch gap-2">
              {['Project promise', 'Baseline', 'Deployment', 'Operation', 'Evidence', 'Evaluation', 'Follow-up'].map((step, i, arr) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="rounded-lg border border-white/15 bg-white/[0.04] px-4 py-3 text-[14px] font-semibold">
                    <span className="mr-2 text-white/40">{String(i + 1).padStart(2, '0')}</span>{step}
                  </div>
                  {i < arr.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-white/30" />}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* §13 — Monitoring is not just sensors */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
          <FadeIn>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Monitoring is not just sensors
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              BioVeracity&rsquo;s value is not owning every source — it is connecting them, on one clock, with clear
              provenance. The picture can draw on many streams as they become available:
            </p>
          </FadeIn>
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              'Operational telemetry', 'Energy use', 'Vessel activity', 'Port infrastructure data',
              'Regulatory records', 'Permit evidence', 'Air quality', 'Water measurements',
              'Noise', 'Weather context', 'Project documents', 'Community reports',
              'Satellite evidence', 'Laboratory analysis',
            ].map((s) => (
              <span key={s} className="rounded-full border border-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-foreground">{s}</span>
            ))}
          </div>
        </section>

        {/* §18 — Built to scale */}
        <section className="relative isolate overflow-hidden border-y border-border">
          <div className="absolute inset-0">
            <Image src="/maritime/coastal-energy.jpg" alt="Coastal energy infrastructure with distant offshore wind turbines viewed from a working harbour" fill className="object-cover" />
            <div className="absolute inset-0 bg-[#0b1524]/85" />
          </div>
          <div className="relative mx-auto max-w-[1200px] px-4 py-14 text-white md:py-20">
            <FadeIn>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight">
                Built to scale from one port to a national programme
              </h2>
              <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-white/80">
                Irish ports are the current demonstration dataset. The same evidence architecture — canonical
                places, source-backed chronology, baseline-to-after Proof of Effect — is designed to support ports
                and clean-maritime demonstrations in other jurisdictions wherever the data and partnerships exist.
              </p>
              <p className="mt-4 max-w-3xl rounded-lg border border-white/15 bg-white/[0.05] p-4 text-[14px] leading-relaxed text-white/70">
                <span className="font-semibold text-white">A note on scope.</span> This picture reflects the public
                record for these Irish ports. It does not imply participation in any specific national funding
                programme. Where BioVeracity provides baseline, deployment and Proof-of-Effect evidence for a funded
                clean-maritime programme, that is a separate commercial engagement — kept distinct from the factual
                port chronology shown here.
              </p>
            </FadeIn>
          </div>
        </section>

        {/* §17 — Free vs paid */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
          <FadeIn>
            <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              What the port tells everyone — and what a programme unlocks
            </h2>
            <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
              The central insight is never hidden. Anyone can understand what happened at a port. Institutional
              access is for doing this across an entire programme.
            </p>
          </FadeIn>
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              {
                tier: 'Free', tag: 'This product understands what happened at the port.',
                items: ['Search ports and open any port record', 'Canonical identity and connected infrastructure', 'Recent material changes and headline projects', 'What the evidence establishes, what remains unresolved, and what would help', 'Limited provenance, limited replay, basic map'],
              },
              {
                tier: 'Registered', tag: 'Keep watching the places that matter to you.', accent: true,
                items: ['Follow a port or follow all Irish ports', 'Material-change digest', 'My Places and saved context'],
              },
              {
                tier: 'Institutional', tag: 'Now do this across our entire programme.',
                items: ['Full chronology and full project replay', 'Full provenance and the project evidence room', 'Proof-of-Effect reports', 'Cross-port comparison and portfolio / programme view', 'Multi-user collaboration and API'],
              },
            ].map((col) => (
              <div key={col.tier} className={`flex flex-col rounded-xl border p-6 ${col.accent ? 'border-accent bg-accent/[0.04]' : 'border-border bg-white'}`}>
                <p className="text-[13px] font-semibold uppercase tracking-wide text-accent">{col.tier}</p>
                <p className="mt-2 text-[15px] font-semibold text-foreground">{col.tag}</p>
                <ul className="mt-4 space-y-2 text-[14px] text-muted-foreground">
                  {col.items.map((it) => (
                    <li key={it} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />{it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/institutional" className="inline-flex items-center gap-2 rounded-md bg-[#0b1524] px-6 py-3 text-[15px] font-semibold text-white transition hover:brightness-125">
              Request institutional access <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/regions/irish-ports/live" className="inline-flex items-center gap-2 rounded-md border border-border bg-white px-6 py-3 text-[15px] font-semibold text-foreground transition hover:border-accent">
              Open regional operating picture
            </Link>
          </div>
        </section>

        {/* §21 — Final message */}
        <section className="border-t border-border bg-[#0b1524] text-white">
          <div className="mx-auto max-w-[900px] px-4 py-20 md:py-28">
            <div className="space-y-3 font-display text-[22px] font-bold leading-snug tracking-tight md:text-[30px]">
              <p>Every clean-maritime project makes a promise.</p>
              <p className="text-white/80">BioVeracity preserves what was true before.</p>
              <p className="text-white/80">It records what was deployed.</p>
              <p className="text-white/80">It connects what happened afterwards.</p>
              <p className="text-white/80">It shows what the evidence establishes.</p>
              <p className="text-white/80">It shows what remains unresolved.</p>
              <p className="text-accent">And it keeps watching.</p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
