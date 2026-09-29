// Object journey (Place Experience PR F). Server component, presentation only:
// Overview -> Chronology -> Map -> Evidence -> Sources for one species or
// feature, rendered from a SpeciesJourney built from the Place's public view.
// Place-neutral. A designation feature is never read as current presence.

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { SpeciesJourney } from '@/lib/place/shell-view'
import { NO_EVIDENCE_NOTE, recordAnchor } from '@/lib/place/shell-view'
import { EvidenceLink } from '@/components/evidence-link'
import { HashLink } from '@/components/place-client/hash-link'
import { EvidenceCard, MapStep, PlaceStateBadge } from './place-arrive'
import { attribution, card, editorial, eyebrow, focusRing, target44, textLink } from './place-arrive-styles'

export const JOURNEY_STEPS = [
  { id: 'overview', label: 'Overview' },
  { id: 'chronology', label: 'Chronology' },
  { id: 'map', label: 'Map' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'sources', label: 'Sources' },
] as const

function Step({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) {
  const next = JOURNEY_STEPS[n + 1]
  return (
    <section id={`journey-${id}`} aria-labelledby={`journey-${id}-title`} tabIndex={-1} className={`${card} scroll-mt-24 p-5 focus:outline-none md:p-7`} data-journey-step={id}>
      <p className={eyebrow}>Step {n + 1} of {JOURNEY_STEPS.length}</p>
      <h2 id={`journey-${id}-title`} className={`${editorial} mt-1 text-[26px] leading-tight text-[color:var(--pl-green-deep)]`}>{title}</h2>
      {children}
      {next ? (
        <p className="mt-6 flex justify-end border-t border-[color:var(--pl-line)] pt-4">
          <HashLink href={`#journey-${next.id}`} className={`${target44} gap-2 rounded-full bg-[color:var(--pl-green-deep)] px-5 text-[15px] font-semibold text-white hover:bg-[color:var(--pl-green)]`}>{next.label}<span aria-hidden="true">→</span></HashLink>
        </p>
      ) : null}
    </section>
  )
}

export function PlaceJourney({ j, placeTitle, placePath }: { j: SpeciesJourney; placeTitle: string; placePath: string }) {
  return (
    <article aria-labelledby="journey-title" className="pb-10" data-object-journey={j.slug}>
      <div className="bg-[color:var(--pl-green-deep)] px-5 pb-16 pt-6 text-white md:px-8">
        <div className="mx-auto max-w-3xl">
          <Link href={`${placePath}#species`} prefetch={false} className={`${target44} gap-1.5 text-[15px] text-white/90 hover:text-white`}><span aria-hidden="true">←</span>{placeTitle}: species and features</Link>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#E9D39A]">{j.kindLabel} · {placeTitle}</p>
          <h1 id="journey-title" className={`${editorial} mt-1 text-[40px] leading-[1.05] md:text-[56px]`}>{j.title}</h1>
          {j.latin ? <p className="mt-1 text-[18px] italic text-white/85">{j.latin}</p> : null}
        </div>
      </div>
      <div className="mx-auto -mt-10 max-w-3xl px-5 md:px-8">
        <nav aria-label="Journey steps" className={`${card} p-2`}>
          <ol className="pa-chips flex gap-1 overflow-x-auto">
            {JOURNEY_STEPS.map((s, i) => (
              <li key={s.id} className="shrink-0"><HashLink href={`#journey-${s.id}`} className={`${target44} gap-2 rounded-full px-3 text-[15px] font-medium hover:bg-[color:var(--pl-green-soft)]`}><span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--pl-green-soft)] text-[12px] font-semibold text-[color:var(--pl-green-deep)]">{i + 1}</span>{s.label}</HashLink></li>
            ))}
          </ol>
        </nav>

        <div className="mt-5 grid gap-5">
          <Step n={0} id="overview" title="What the record says">
            <dl className="mt-4 grid gap-3">
              <div className="flex flex-wrap items-baseline gap-2"><dt className="text-[13px] text-[color:var(--pl-muted)]">Named as</dt><dd className="text-[15px]">{j.bases.join(' · ')}</dd></div>
              {j.otherNames.length ? <div className="flex flex-wrap items-baseline gap-2"><dt className="text-[13px] text-[color:var(--pl-muted)]">Also known as</dt><dd className="text-[15px]">{j.otherNames.join(', ')}</dd></div> : null}
              <div className="flex flex-wrap items-center gap-2"><dt className="text-[13px] text-[color:var(--pl-muted)]">Here now</dt><dd><PlaceStateBadge state={j.presenceNow} /></dd></div>
              <div className="flex flex-wrap items-baseline gap-2"><dt className="text-[13px] text-[color:var(--pl-muted)]">Public records</dt><dd className="text-[15px]">{j.cards.length}</dd></div>
            </dl>
            {j.note ? <p className="mt-4 rounded-xl border-l-4 border-[color:var(--pl-gold)] bg-[color:var(--pl-warm)] px-4 py-3 text-[14px] leading-relaxed" data-designation-note="">{j.note}</p> : null}
            <p className="mt-4 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">A record shows what its source reported, not what is at {placeTitle} today. {NO_EVIDENCE_NOTE}</p>
          </Step>

          <Step n={1} id="chronology" title="Through time">
            {j.chronology.length ? (
              <ol className="mt-4 grid gap-3" data-journey-dated="">
                {j.chronology.map((r) => (
                  <li key={r.handle} className="flex items-baseline gap-4 rounded-xl bg-[color:var(--pl-warm)] p-4">
                    <p className={`${editorial} text-[22px] tabular-nums text-[color:var(--pl-green)]`}>{r.date}</p>
                    <div><p className="text-[16px] font-medium">{r.statement}</p><HashLink href={`#${recordAnchor(r.handle)}`} className={`${target44} text-[14px] ${textLink}`}>See the record</HashLink></div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--pl-line)] p-4 text-[15px]" data-journey-undated=""><span className="font-semibold">No dated public records name {j.title} here.</span> <span className="text-[color:var(--pl-muted)]">Undated records, including designations, are not placed in time.</span></p>
            )}
            {j.chronology.length && j.undated ? <p className="mt-3 text-[14px] text-[color:var(--pl-muted)]">{j.undated} undated {j.undated === 1 ? 'record is' : 'records are'} not placed in time.</p> : null}
            <p className="mt-3 text-[14px] text-[color:var(--pl-muted)]">Gaps are shown, never filled. No change, trend or condition is inferred from when records happen to exist.</p>
          </Step>

          <Step n={2} id="map" title="Where the record places it">
            <MapStep map={j.map} subject={j.title} />
          </Step>

          <Step n={3} id="evidence" title="The public record">
            <div className="mt-4 grid gap-4">{j.cards.map((c) => <EvidenceCard key={c.handle} c={c} />)}</div>
          </Step>

          <Step n={4} id="sources" title="Original sources">
            <ul className="pa-src mt-4 grid gap-2">
              {j.sources.map((s) => (
                <li key={`${s.publisher}|${s.licence}|${s.url ?? ''}`} className="rounded-xl bg-[color:var(--pl-warm)] px-4 py-2 text-[14px]">
                  {s.url ? <EvidenceLink href={s.url} className={attribution}>{s.publisher}</EvidenceLink> : <span className="font-medium">{s.publisher}</span>}
                  <span className="block text-[13px] text-[color:var(--pl-muted)]">Licence: {s.licence} · Retrieved: {s.retrieved} · Published: {s.published}</span>
                  {s.attribution ? <span className="block text-[13px] text-[color:var(--pl-muted)]">Attribution: {s.attribution}</span> : null}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[14px]"><Link href={`${placePath}#species`} prefetch={false} className={`${target44} ${textLink} ${focusRing}`}>Back to all species and features at {placeTitle}</Link></p>
          </Step>
        </div>
      </div>
    </article>
  )
}
