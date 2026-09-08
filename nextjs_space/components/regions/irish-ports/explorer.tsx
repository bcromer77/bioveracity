'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Anchor, Zap, Fuel, Wind, Factory, Droplets, AudioLines, Waves,
  FileCheck2, Scale, ArrowRight, ChevronRight, Layers,
} from 'lucide-react'
import { FollowButton } from '@/components/asset/follow-button'
import { EvidenceBadge } from '@/components/evidence-badge'
import { SafeDate } from '@/components/safe-format'
import { FadeIn, Stagger, StaggerItem } from '@/components/ui/animate'

export type PortCard = {
  id: string
  slug: string
  name: string
  statusLabel: string
  operatorName: string | null
  regulatorName: string | null
  latestTitle: string | null
  latestDate: string | null
  latestClass: string | null
  projectCount: number
  projectNames: string[]
  domains: string[]
  categoryIds: string[]
  divergenceCount: number
  eventCount: number
  isFollowing: boolean
  summary: string | null
}

export type CategoryCard = {
  id: string
  label: string
  description: string
  count: number
  sampleTitles: string[]
  cleanMaritime: boolean
}

const ICONS: Record<string, any> = {
  'clean-maritime-projects': Anchor,
  'shore-power': Zap,
  'alt-fuels': Fuel,
  'energy-infra': Wind,
  'air-emissions': Factory,
  'water-discharges': Droplets,
  'noise-vibration': AudioLines,
  'dredging-ecology': Waves,
  'projects-permits': FileCheck2,
  'regulatory': Scale,
}

export function IrishPortsExplorer({
  ports,
  categories,
  isAuthed,
}: {
  ports: PortCard[]
  categories: CategoryCard[]
  isAuthed: boolean
}) {
  const [activeCat, setActiveCat] = useState<string>('all')
  const [cleanOnly, setCleanOnly] = useState<boolean>(false)

  const activeCategory = categories.find((c) => c.id === activeCat) ?? null

  const visiblePorts = useMemo(() => {
    let list = ports
    if (cleanOnly) {
      const cleanIds = new Set(categories.filter((c) => c.cleanMaritime).map((c) => c.id))
      list = list.filter((p) => p.categoryIds.some((id) => cleanIds.has(id)))
    }
    if (activeCat !== 'all') {
      list = list.filter((p) => p.categoryIds.includes(activeCat))
    }
    return list
  }, [ports, categories, activeCat, cleanOnly])

  return (
    <div>
      {/* §3 — The first question */}
      <section id="understand" className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
        <FadeIn>
          <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            What do you want to understand?
          </h2>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
            These are entry points into one source-backed evidence picture &mdash; not separate products.
            Choose a lens and the portfolio below narrows to the ports where a record actually exists.
            Where the public record is silent, we say so plainly.
          </p>
        </FadeIn>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <button
            onClick={() => { setActiveCat('all'); setCleanOnly(false) }}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition ${
              activeCat === 'all' && !cleanOnly
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-white text-foreground hover:border-accent/60'
            }`}
          >
            <Layers className="h-4 w-4" /> All evidence
          </button>
          {categories.map((c) => {
            const Icon = ICONS[c.id] ?? Anchor
            const active = activeCat === c.id
            const empty = c.count === 0
            return (
              <button
                key={c.id}
                onClick={() => { setActiveCat(active ? 'all' : c.id) }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[14px] font-medium transition ${
                  active
                    ? 'border-accent bg-accent text-accent-foreground'
                    : empty
                      ? 'border-dashed border-border/70 bg-white text-muted-foreground hover:border-accent/50'
                      : 'border-border bg-white text-foreground hover:border-accent/60'
                }`}
                title={empty ? 'No verified records connected yet' : `${c.count} source-backed record(s)`}
              >
                <Icon className="h-4 w-4" /> {c.label}
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
                  active ? 'bg-white/25' : empty ? 'bg-secondary text-muted-foreground' : 'bg-accent/10 text-accent'
                }`}>
                  {c.count}
                </span>
              </button>
            )
          })}
        </div>

        {activeCategory && (
          <div className="mt-5 rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-[14px] font-semibold text-foreground">{activeCategory.label}</p>
            {activeCategory.count === 0 ? (
              <p className="mt-1 text-[14px] text-muted-foreground">
                No verified records connected yet. When source-backed evidence for this lens enters the public
                record, it will appear here &mdash; nothing is invented to fill the space.
              </p>
            ) : (
              <div className="mt-1 text-[14px] text-muted-foreground">
                <p>{activeCategory.description}</p>
                {activeCategory.sampleTitles.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {activeCategory.sampleTitles.slice(0, 4).map((t, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </section>

      {/* §4 — Clean Maritime mode */}
      <section id="clean-maritime" className="border-y border-border bg-[#0b1524] text-white">
        <div className="mx-auto max-w-[1200px] px-4 py-14 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1 text-[12px] font-medium tracking-wide text-white/80">
                <Anchor className="h-3.5 w-3.5" /> CLEAN MARITIME &mdash; A LENS, NOT A RATING
              </div>
              <h2 className="mt-4 font-display text-2xl md:text-3xl font-bold tracking-tight">
                Evidence around clean-maritime and port-energy interventions
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">
                Shore power, vessel electrification, alternative fuels, port energy systems and the environmental
                monitoring around them &mdash; assembled from the public record. This is the current demonstration
                dataset for Ireland&rsquo;s ports; the same architecture is built to carry clean-maritime programmes
                elsewhere. Empty categories mean the record is silent, not that nothing matters.
              </p>
            </div>
            <button
              onClick={() => { setCleanOnly((v) => !v); setActiveCat('all') }}
              className={`inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-[15px] font-semibold transition ${
                cleanOnly ? 'bg-white text-[#0b1524]' : 'bg-accent text-accent-foreground hover:brightness-95'
              }`}
            >
              {cleanOnly ? 'Showing clean-maritime ports' : 'Filter portfolio to clean maritime'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.filter((c) => c.cleanMaritime).map((c) => {
              const Icon = ICONS[c.id] ?? Anchor
              const empty = c.count === 0
              return (
                <div key={c.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-white/70" />
                    <p className="text-[14px] font-semibold">{c.label}</p>
                  </div>
                  {empty ? (
                    <p className="mt-2 text-[13px] leading-relaxed text-white/45">No verified records connected yet.</p>
                  ) : (
                    <>
                      <p className="mt-1 text-[13px] text-white/60">
                        {c.count} source-backed record{c.count === 1 ? '' : 's'} connected.
                      </p>
                      {c.sampleTitles[0] && (
                        <p className="mt-2 text-[13px] leading-relaxed text-white/70">{c.sampleTitles[0]}</p>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* §6 — Port portfolio */}
      <section id="portfolio" className="mx-auto max-w-[1200px] px-4 py-14 md:py-20">
        <FadeIn>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                A portfolio of connected ports
              </h2>
              <p className="mt-2 max-w-2xl text-[15px] text-muted-foreground">
                Each port is a canonical record &mdash; not an entry in a directory. Follow one to receive its
                material changes, or open its record to see everything connected there.
              </p>
            </div>
            <p className="text-[13px] text-muted-foreground">
              {visiblePorts.length} of {ports.length} ports
              {(cleanOnly || activeCat !== 'all') && ' · filtered'}
            </p>
          </div>
        </FadeIn>

        {visiblePorts.length === 0 ? (
          <div className="mt-8 rounded-lg border border-dashed border-border bg-secondary/30 p-8 text-center">
            <p className="text-[15px] font-medium text-foreground">No verified records connected yet for this lens.</p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              The record is silent here today. Clear the filter to see the full portfolio.
            </p>
          </div>
        ) : (
          <Stagger className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {visiblePorts.map((p) => (
              <StaggerItem key={p.id}>
                <div className="flex h-full flex-col rounded-xl border border-border bg-white p-5 shadow-sm transition hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/asset/${p.slug}`} className="font-display text-[19px] font-bold tracking-tight text-foreground hover:text-accent">
                        {p.name}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-muted-foreground">
                        {p.operatorName ?? 'Operator on record'} · {p.statusLabel}
                      </p>
                    </div>
                    {p.divergenceCount > 0 && (
                      <span className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                        Evidence differs
                      </span>
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Latest recorded activity</dt>
                      <dd className="mt-0.5 flex items-start gap-1.5 font-medium text-foreground">
                        {p.latestClass && <EvidenceBadge classCode={p.latestClass} />}
                        <span>
                          {p.latestTitle ?? 'No dated record yet'}
                          {p.latestDate && (
                            <span className="ml-1 font-normal text-muted-foreground">
                              (<SafeDate date={p.latestDate} options={{ dateStyle: 'medium' }} />)
                            </span>
                          )}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Connected projects</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{p.projectCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Evidence records</dt>
                      <dd className="mt-0.5 font-semibold text-foreground">{p.eventCount}</dd>
                    </div>
                    <div className="col-span-2">
                      <dt className="text-muted-foreground">Connected evidence domains</dt>
                      <dd className="mt-1 flex flex-wrap gap-1.5">
                        {p.domains.length > 0 ? p.domains.map((d) => (
                          <span key={d} className="rounded-full bg-secondary px-2 py-0.5 text-[12px] font-medium text-foreground">{d}</span>
                        )) : <span className="text-muted-foreground">Not yet connected</span>}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <Link href={`/asset/${p.slug}`} className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent hover:underline">
                      Open port record <ArrowRight className="h-4 w-4" />
                    </Link>
                    <FollowButton
                      assetId={p.id}
                      assetName={p.name}
                      isAuthed={isAuthed}
                      isFollowing={p.isFollowing}
                    />
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>
    </div>
  )
}
