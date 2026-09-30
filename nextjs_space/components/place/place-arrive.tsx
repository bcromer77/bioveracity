// Place ARRIVE screen (Gate F X1). Server component, presentation only: it
// renders a PlaceShellView built from the PR C public DTOs and nothing else.
// Place-neutral: every Place-specific word arrives as data.
// Order follows PLACE -> DISCOVERY -> EVIDENCE -> SOURCE. Sheets are CSS
// :target panels opened through HashLink (works without JavaScript too).

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ArriveCategory, ArriveMap, PlaceSearchResult, PlaceShellView, PlaceState, ShellEvidenceCard, ShellFact, ShellSpecies } from '@/lib/place/shell-view'
import { NO_EVIDENCE_NOTE, recordAnchor } from '@/lib/place/shell-view'
import { EvidenceLink } from '@/components/evidence-link'
import { OriginalSourceLink } from '@/components/original-source-link'
import { HashLink } from '@/components/place-client/hash-link'
import { PlaceSearch } from '@/components/place-client/place-search'
import { BioVeracityPlaceMark } from './place-mark'
import { PlaceHeroIllustration } from './place-hero-illustration'
import { PlaceNoticeInvitation, type PlaceNotice } from './place-notice-invitation'
import { attribution, card, editorial, eyebrow, focusRing, section, sectionTitle, sheetTitle, target44, textLink } from './place-arrive-styles'

export function PlaceStateBadge({ state }: { state: PlaceState }) {
  return (
    <span
      data-place-state={state}
      className="inline-flex items-center rounded-full border border-[color:var(--pl-line)] bg-[color:var(--pl-warm)] px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] text-[color:var(--pl-gold-text)]"
    >
      {state}
    </span>
  )
}

function Fact({ fact }: { fact: ShellFact }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <dt className="text-[13px] text-[color:var(--pl-muted)]">{fact.label}</dt>
      <dd className="text-[14px]">{fact.state ? <PlaceStateBadge state={fact.state} /> : null}{fact.state && fact.value !== fact.state ? <span className="ml-2">{fact.value.replace(`${fact.state}: `, '')}</span> : fact.state ? null : fact.value}</dd>
    </div>
  )
}

export function EvidenceCard({ c }: { c: ShellEvidenceCard }) {
  return (
    <article id={recordAnchor(c.handle)} tabIndex={-1} className={`${card} scroll-mt-4 p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--pl-fuchsia)] md:p-6`} data-public-handle={c.handle}>
      <p className={eyebrow}>{c.classLabel}</p>
      <h3 className={`${editorial} mt-2 text-[21px] leading-snug`}>{c.statement}</h3>
      {c.note ? <p className="mt-3 border-l-2 border-[color:var(--pl-gold)] pl-3 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">{c.note}</p> : null}
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">{c.facts.map((f) => <Fact key={f.label} fact={f} />)}</dl>
      {c.cautions.length ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Limits of this record">
          {c.cautions.map((x) => <li key={x} className="rounded-full bg-[color:var(--pl-green-soft)] px-3 py-1 text-[12px] text-[color:var(--pl-green-deep)]">{x}</li>)}
        </ul>
      ) : null}
      <p className="pa-src mt-5 border-t border-[color:var(--pl-line)] pt-3 text-[13px] leading-relaxed text-[color:var(--pl-muted)]">
        Source: {c.source.url ? <EvidenceLink href={c.source.url} className={attribution}>{c.source.publisher}</EvidenceLink> : c.source.publisher}
        {' '}· Licence: {c.source.licence}
        {c.source.attribution ? <><br />Attribution: {c.source.attribution}</> : null}
      </p>
    </article>
  )
}

function SpeciesRow({ s, path }: { s: ShellSpecies; path: string | null }) {
  const body = (
    <>
      <span className="block text-[15px] font-semibold">{s.commonName ?? s.label}</span>
      {s.commonName ? <span className="block text-[13px] italic text-[color:var(--pl-muted)]">{s.label}</span> : null}
      <span className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--pl-muted)]">
        <span>{s.kindLabel} · {s.basis}</span>
        <span className="inline-flex items-center gap-1">Here now: <PlaceStateBadge state={s.presenceNow} /></span>
      </span>
      {path ? <span className="mt-2 block text-[13px] font-medium text-[color:var(--pl-green)]">Follow its record <span aria-hidden="true">→</span></span> : null}
    </>
  )
  const box = 'block rounded-xl bg-[color:var(--pl-paper)] px-4 py-3 shadow-[0_1px_2px_rgba(28,42,34,0.06)]'
  return (
    <li data-framing={s.framing}>
      {path ? <Link href={`${path}/species/${s.slug}`} prefetch={false} className={`${box} hover:bg-[color:var(--pl-green-soft)] ${focusRing}`} data-species-journey={s.slug}>{body}</Link> : <div className={box}>{body}</div>}
    </li>
  )
}

/** Journey footer: every sheet leads on to the next step, never a dead end. */
function NextStep({ href, label }: { href: `#${string}`; label: string }) {
  return (
    <p className="mt-6 flex justify-end border-t border-[color:var(--pl-line)] pt-4" data-next-step={href}>
      <HashLink href={href} className={`${target44} gap-2 rounded-full bg-[color:var(--pl-green-deep)] px-5 text-[15px] font-semibold text-white hover:bg-[color:var(--pl-green)]`}>{label}<span aria-hidden="true">→</span></HashLink>
    </p>
  )
}

const MAP_ROWS: Array<{ key: 'namedOnly' | 'generalised' | 'withheld'; label: string; state: PlaceState | null; detail: string }> = [
  { key: 'namedOnly', label: 'Named place only', state: 'NOT LOCATED', detail: 'The source names the place but gives no area or point.' },
  { key: 'generalised', label: 'Generalised area only', state: null, detail: 'The source gives an area, never an exact point. No shape is published.' },
  { key: 'withheld', label: 'Location withheld', state: 'RESTRICTED', detail: 'Sensitive or restricted locations are never shown, not even roughly.' },
]

/**
 * Evidence-safe Map step (PR F), shared by the Place and every object journey.
 * The public record carries disclosure and precision only, never geometry, so
 * this never draws a point, centre or outline. It says why, record by record.
 */
export function MapStep({ map, subject }: { map: ArriveMap; subject: string }) {
  return (
    <div className="mt-4" data-map-state={map.drawable ? 'drawn' : 'not-supported'}>
      <div className="rounded-2xl border border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] p-5 text-center">
        <svg viewBox="0 0 160 96" width="160" height="96" aria-hidden="true" focusable="false" className="mx-auto">
          <path d="M20 22 60 12l40 10 40-10v62l-40 10-40-10-40 10Z" fill="#F3EFE4" stroke="#B9B09A" strokeWidth="2" strokeLinejoin="round" />
          <path d="M60 12v62m40-52v62" stroke="#D8D1C0" strokeWidth="2" />
          <path d="M30 60c14-10 22 4 36-6s24-18 40-8 22 2 24-4" fill="none" stroke="#9AA9A3" strokeWidth="2" strokeDasharray="3 5" strokeLinecap="round" />
        </svg>
        <h3 className={`${editorial} mt-3 text-[24px] leading-tight text-[color:var(--pl-ink)]`}>The public evidence does not support a map</h3>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-[color:var(--pl-muted)]">{map.reason}</p>
        <p className="mt-3"><PlaceStateBadge state={map.state} /></p>
      </div>
      {map.records ? (
        <ul className="mt-4 grid gap-2" aria-label={`How the public record locates ${subject}`}>
          {MAP_ROWS.filter((r) => map[r.key] > 0).map((r) => (
            <li key={r.key} className="flex items-start justify-between gap-3 rounded-xl bg-[color:var(--pl-paper)] px-4 py-3" data-map-row={r.key}>
              <span><span className="block text-[15px] font-medium">{r.label}</span><span className="block text-[13px] text-[color:var(--pl-muted)]">{r.detail}</span></span>
              <span className="flex shrink-0 items-center gap-2">{r.state ? <PlaceStateBadge state={r.state} /> : null}<span className={`${editorial} text-[22px] text-[color:var(--pl-green-deep)]`}>{map[r.key]}</span></span>
            </li>
          ))}
        </ul>
      ) : null}
      {map.precisions.length ? <p className="mt-3 text-[14px] text-[color:var(--pl-muted)]">Precision as stated by the source: <span className="font-medium text-[color:var(--pl-ink)]">{map.precisions.join(', ')}</span></p> : null}
      <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">No point, centre or outline is drawn in place of evidence. A place without a map is not a place without a record.</p>
    </div>
  )
}

function Sheet({ id, title, children, heading }: { id: string; title: string; children: ReactNode; heading?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} role="dialog" aria-modal="true" tabIndex={-1} className="pa-sheet" data-pa-sheet="">
      <div className="pa-sheet-panel">
        <span aria-hidden="true" className="mx-auto -mt-1 mb-3 block h-1.5 w-12 rounded-full bg-[#D8D1C0]" />
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-title`} className={`${sheetTitle} inline-flex items-center gap-2`}>{heading}{title}</h2>
          <HashLink href="#place-main" close aria-label={`Close ${title}`} className={`${target44} h-11 w-11 shrink-0 justify-center rounded-full bg-[#EFEBE0] text-[color:var(--pl-ink)] hover:bg-[#E4DED0]`}>
            <Icon d="M6 6l12 12M18 6 6 18" size={20} />
          </HashLink>
        </div>
        {children}
      </div>
    </section>
  )
}

function Category({ c }: { c: ArriveCategory }) {
  const body = (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[16px] font-semibold">{c.label}</h3>
        {c.status === 'available' ? <span className={`${editorial} text-[30px] leading-none text-[color:var(--pl-green-deep)]`}>{c.count}</span> : c.state ? <PlaceStateBadge state={c.state} /> : null}
      </div>
      <span className="mt-2 block text-[14px] leading-relaxed text-[color:var(--pl-muted)]">{c.summary}</span>
      {c.status === 'available' ? <span className="mt-3 block text-[14px] font-medium text-[color:var(--pl-green)]">Open the records <span aria-hidden="true">→</span></span> : null}
      {c.status === 'unverified' ? <span className="mt-3 block text-[13px] font-medium text-[color:var(--pl-muted)]">Unavailable until verified</span> : null}
    </>
  )
  return (
    <li data-category={c.id} data-category-status={c.status}>
      {c.href ? (
        <HashLink href={c.href as `#${string}`} className={`${card} flex min-h-[44px] flex-col p-5 hover:bg-[color:var(--pl-green-soft)] motion-safe:transition-colors ${focusRing}`}>{body}</HashLink>
      ) : (
        <div aria-disabled="true" className="flex flex-col rounded-2xl border border-dashed border-[color:var(--pl-line)] bg-[color:var(--pl-warm)] p-5">{body}</div>
      )}
    </li>
  )
}

function TraceStep({ label, title, detail, icon }: { label: string; title: string; detail: string; icon: string }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--pl-green-soft)] text-[color:var(--pl-green-deep)]"><Icon d={icon} size={18} /></span>
      <div>
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-muted)]">{label}</p>
        <p className="text-[16px] font-medium text-[color:var(--pl-ink)]">{title}</p>
        <p className="text-[13px] text-[color:var(--pl-muted)]">{detail}</p>
      </div>
    </li>
  )
}

const TRY_PROMPTS = new Set(['what-lives-here', 'what-has-changed', 'how-do-we-know'])

const THEMES: Array<{ title: string; body: string }> = [
  { title: 'Evidence is not interpretation', body: 'A record says what its source says. Our wording never adds to it, and analysis is always labelled as analysis.' },
  { title: 'A designation is not presence', body: 'A site is protected for the features named in its designation. That records why it is protected, not what can be found there today.' },
  { title: 'No evidence is not absence', body: `${NO_EVIDENCE_NOTE} States such as NOT RECORDED or NOT YET INGESTED mean the record is silent.` },
  { title: 'An illustration is not evidence', body: 'Illustrations set the scene only. They are always marked Illustration and never depict what was recorded.' },
  { title: 'Public records only', body: 'Only records cleared for public use are shown. Private, restricted and sensitive locations stay out.' },
]

const CHIP_ICONS: Record<ArriveCategory['id'], string> = {
  species: 'M4 18c5 0 9-3 10-8l3-3 3 1-3 1c0 6-5 10-11 10Zm5-1-2 3m5-4-1 3',
  habitats: 'M5 19c0-8 6-13 14-14-1 8-6 14-14 14Zm0 0 7-7',
  water: 'M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10Z',
  designations: 'M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z',
  people: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5 8c0-3 2.2-5 5-5s5 2 5 5m2-8a2.5 2.5 0 1 0 0-5m1.5 8c2 .4 3.5 2.2 3.5 5',
  climate: 'M7 17h9a3.5 3.5 0 0 0 .5-7A5 5 0 0 0 7 11a3 3 0 0 0 0 6Zm9-11 1-2m3 5 2-1',
  planning: 'M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5',
}

function Icon({ d, size = 20, className }: { d: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className={className}><path d={d} /></svg>
  )
}

function Chip({ c }: { c: ArriveCategory }) {
  const href = c.id === 'water' ? '#water' : c.href
  const pending = c.status === 'unwired' || c.status === 'unverified'
  const inner = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--pl-green-soft)] text-[color:var(--pl-green-deep)]"><Icon d={CHIP_ICONS[c.id]} /></span>
      <span className="text-[15px] font-medium">{c.label}</span>
      {c.status === 'available' ? <span className="rounded-full bg-[color:var(--pl-green-soft)] px-2 py-0.5 text-[13px] font-semibold text-[color:var(--pl-green-deep)]">{c.count}</span> : null}
      {pending ? <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-dashed border-current opacity-60" /> : null}
      {c.state ? <span className="sr-only">: {c.state}</span> : null}
    </>
  )
  const base = 'pa-chip inline-flex min-h-[52px] shrink-0 items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-4'
  return (
    <li data-chip={c.id} data-chip-status={c.status}>
      {href ? (
        <HashLink href={href as `#${string}`} className={`${base} ${focusRing}`}>{inner}</HashLink>
      ) : (
        <span aria-disabled="true" className={`${base} pa-chip-off`}>{inner}</span>
      )}
    </li>
  )
}

function TimeCells({ years, size = 'strip' }: { years: PlaceShellView['timeWindow']['years']; size?: 'strip' | 'sheet' }) {
  return (
    <>
      {years.map((y) => (
        <span key={y.year} data-year={y.year} data-records={y.records} className={`${size === 'strip' ? 'h-9' : 'h-12'} flex-1 rounded-[5px] ${y.records ? 'bg-[color:var(--pl-green)]' : 'pa-gap'}`} />
      ))}
    </>
  )
}

export function PlaceArrive({ view, consent, search, invitation, notice }: { view: PlaceShellView; consent?: ReactNode; search?: PlaceSearchResult | null; invitation?: ReactNode; notice?: PlaceNotice | null }) {
  const designation = view.species.filter((s) => s.framing === 'designation_feature')
  const recorded = view.species.filter((s) => s.framing === 'subject')
  const notShown = view.categories.filter((c) => c.status === 'unwired' || c.status === 'unverified')
  const available = view.categories.filter((c) => c.status === 'available')
  const water = view.categories.find((c) => c.id === 'water')
  const tw = view.timeWindow
  const datedInWindow = tw.years.reduce((n, y) => n + y.records, 0)
  const k = view.known
  const decades = [0, 10, 20].map((o) => tw.years.slice(o, o + 10))
  return (
    <>
      {/* PLACE: presentation-only illustration with the Place name over it. */}
      <section aria-labelledby="place-title" className="pa-hero relative isolate flex min-h-[440px] flex-col justify-end overflow-hidden px-5 pb-14 pt-24 text-white md:min-h-[460px] md:px-8 md:pt-16 lg:min-h-[760px] lg:justify-start lg:pb-0 lg:pt-28">
        <figure className="absolute inset-0 -z-10 m-0" data-hero="illustration" data-hero-rights="PENDING" data-presentation-only="">
          <PlaceHeroIllustration label={`Illustration of ${view.title}: an artist's scene for presentation only. It is not a photograph and not evidence of what lives here.`} />
          <span data-illustrative-badge="" className="pa-badge absolute right-4 top-[22px] inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-[#12251C]/80 px-3 py-1.5 text-[13px] font-medium text-white md:top-4 lg:right-8 lg:top-24">
            <Icon d="M4 20l4-1 10-10-3-3L5 16l-1 4Zm11-14 3 3" size={15} />Illustration<span className="sr-only lg:not-sr-only"> · not a photograph or evidence</span>
          </span>
        </figure>
        <div className="pa-fade mx-auto w-full max-w-6xl">
          <p className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-white"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[#E9D39A] shadow-[0_0_0_5px_rgba(233,211,154,0.25)]" />You are here</p>
          <h1 id="place-title" className={`${editorial} mt-2 text-[46px] leading-[1.02] md:text-[64px] lg:text-[88px]`}>{view.title}</h1>
          <p className="mt-2 text-[18px] lg:text-[22px]">{view.context ? <>Held in the public record as {view.context}</> : 'A living memory of this place'}</p>
          {view.relation ? (
            <p className="mt-4">
              <HashLink href="#evidence" className={`${target44} max-w-full gap-2 rounded-full border border-white/35 bg-[#12251C]/60 px-4 text-[15px] ${focusRing}`}>
                <Icon d="M12 4 3 9l9 5 9-5-9-5Zm-9 9 9 5 9-5" size={16} /><span data-place-relation="">{view.relation}</span><span aria-hidden="true">›</span>
              </HashLink>
            </p>
          ) : null}
        </div>
      </section>

      {/* DISCOVERY: cream sheet over the hero (mobile); floats over the hero foot (desktop). */}
      <div className="pa-sheet-top relative z-10 -mt-7 rounded-t-[28px] bg-[color:var(--pl-warm)] px-5 pb-4 pt-6 md:px-8 lg:-mt-[400px] lg:rounded-none lg:bg-transparent lg:pt-0">
        <div className="mx-auto max-w-6xl">
          <HashLink href="#place-menu" aria-label="Search this place" className={`flex min-h-[60px] items-center gap-3 rounded-full border border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] py-2 pl-5 pr-2 shadow-[0_6px_20px_rgba(28,42,34,0.10)] lg:max-w-[720px] ${focusRing}`}>
            <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4" size={22} className="text-[color:var(--pl-ink)]" />
            <span className="flex-1 truncate text-[17px] text-[color:var(--pl-muted)]">Search species, habitats, records…</span>
            <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--pl-green-deep)] text-white"><Icon d="M5 12h14m-6-6 6 6-6 6" size={20} /></span>
          </HashLink>
          <ul aria-label="What the public record holds" className="pa-chips relative -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0 lg:flex-wrap lg:overflow-visible">{view.categories.map((c) => <Chip key={c.id} c={c} />)}</ul>
          <p className="mt-4 hidden flex-wrap items-center gap-2 text-[15px] text-white lg:flex">
            <span className="mr-1">Try</span>
            {view.prompts.filter((p) => TRY_PROMPTS.has(p.id)).map((p) => (
              <HashLink key={p.id} href={`#${p.id}`} className={`${target44} rounded-full border border-white/40 bg-[#12251C]/60 px-4`}>{p.question}</HashLink>
            ))}
          </p>

          <div className="mt-5 grid gap-5 lg:mt-8 lg:grid-cols-[1fr_1.1fr_0.8fr]">
            <article className={`${card} flex gap-4 p-5`} data-known-so-far="">
              <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3E9D2] text-[color:var(--pl-gold-text)]"><Icon d="M7 3h7l4 4v14H7V3Zm7 0v4h4M9.5 14l2 2 3.5-4" size={22} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-gold-text)]">What we know so far</h2>
                <p className={`${editorial} mt-1 text-[22px] leading-snug text-[color:var(--pl-ink)]`}>{k.statement}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[14px] text-[color:var(--pl-muted)]">{k.source ? <>{k.source.publisher} · {k.record?.classLabel}</> : NO_EVIDENCE_NOTE}</p>
                  <HashLink href="#how-we-know" className={`${target44} gap-1.5 rounded-full bg-[color:var(--pl-green-soft)] px-4 text-[15px] font-semibold text-[color:var(--pl-green-deep)] hover:bg-[#d6e6da]`}>
                    <Icon d="M10 14a4 4 0 0 0 5.6 0l3-3a4 4 0 0 0-5.6-5.6l-1 1m1.9 3.6a4 4 0 0 0-5.6 0l-3 3a4 4 0 0 0 5.6 5.6l1-1" size={17} />How we know
                  </HashLink>
                </div>
              </div>
            </article>

            <HashLink href="#time" id="time-strip" aria-label={`Travel ${tw.years.length} years, ${tw.from} to ${tw.to}: ${datedInWindow ? `${datedInWindow} dated public ${datedInWindow === 1 ? 'record' : 'records'}` : 'no dated public records yet'}`} className={`block rounded-2xl py-1 lg:bg-[color:var(--pl-paper)] lg:p-5 lg:shadow-[0_1px_2px_rgba(28,42,34,0.06),0_8px_24px_rgba(28,42,34,0.05)] ${focusRing}`} data-time-strip={view.timeline.length ? 'dated' : 'empty'}>
              <span className="flex items-center justify-between text-[15px] text-[color:var(--pl-muted)]">
                <span>{tw.from}</span>
                <span className="inline-flex items-center gap-1.5 text-[16px] font-semibold text-[color:var(--pl-ink)]"><Icon d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2" size={18} className="text-[color:var(--pl-green)]" />Travel {tw.years.length} years</span>
                <span>{tw.to}</span>
              </span>
              <span className="mt-2 flex gap-[3px]" aria-hidden="true"><TimeCells years={tw.years} /></span>
              <span className="mt-2 block text-[14px] text-[color:var(--pl-muted)]">{view.timeline.length ? `${view.timeline.length} dated public ${view.timeline.length === 1 ? 'record' : 'records'} so far` : 'No dated public records yet'} · gaps are shown, never filled</span>
            </HashLink>

            {notice ? <PlaceNoticeInvitation notice={notice} /> : <article className="hidden rounded-2xl border border-dashed border-[color:var(--pl-line)] bg-[#F3EFE4] p-5 lg:block" data-contribute="not-open">
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-muted)]">Tell us what you noticed</h2>
              <p className={`${editorial} mt-1 text-[22px] text-[color:var(--pl-ink)]`}>Not open yet</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">Photos and notes will open once safety, privacy and rights checks are in place.</p>
            </article>}
          </div>
          {consent}
        </div>
      </div>

      <section id="arrive-categories" aria-labelledby="arrive-categories-title" className={section}>
        <h2 id="arrive-categories-title" className={sectionTitle}>What the public record holds</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{view.categories.map((c) => <Category key={c.id} c={c} />)}</ul>
      </section>

      <section id="explore" aria-labelledby="explore-title" className={section}>
        <h2 id="explore-title" className={sectionTitle}>Start with a question</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {view.prompts.map((p) => (
            <article key={p.id} id={p.id} className={`${card} scroll-mt-20 p-6`}>
              <h3 className={`${editorial} text-[22px]`}>{p.question}</h3>
              {p.state ? <p className="mt-3"><PlaceStateBadge state={p.state} /></p> : null}
              <p className="mt-3 text-[15px] leading-relaxed">{p.summary}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">{p.detail}</p>
              <p className="mt-3 text-[15px] font-medium" data-prompt-next={p.next.href}><HashLink href={p.next.href} className={`${target44} gap-1.5 text-[color:var(--pl-green)] ${textLink}`}>{p.next.label}<span aria-hidden="true">→</span></HashLink></p>
            </article>
          ))}
        </div>
      </section>

      {invitation}

      {/* EVIDENCE and SOURCE sheets */}
      <Sheet id="how-we-know" title="How we know">
        <blockquote className={`${editorial} mt-4 rounded-2xl border-l-4 border-[color:var(--pl-gold)] bg-[color:var(--pl-paper)] px-4 py-3 text-[19px] leading-snug`}>“{k.statement}”</blockquote>
        <ol className="pa-trace mt-5 grid gap-4" data-trace="">
          <TraceStep label="What we say" title={k.say} detail={k.sayDetail} icon="M7 7h4v4H7zm6 0h4v4h-4zM7 11c0 3-1 5-3 6m9-6c0 3-1 5-3 6" />
          <TraceStep label="Public record" title={k.record?.statement ?? 'NOT RECORDED'} detail={k.record ? `${k.record.classLabel} · ${k.record.detail}` : 'No public record is linked yet.'} icon="M4 6c0-1.5 3.6-3 8-3s8 1.5 8 3-3.6 3-8 3-8-1.5-8-3Zm0 0v12c0 1.5 3.6 3 8 3s8-1.5 8-3V6M4 12c0 1.5 3.6 3 8 3s8-1.5 8-3" />
          <TraceStep label="Original source" title={k.source?.publisher ?? 'UNKNOWN'} detail={k.source ? `Published: ${k.source.published}` : 'No source is linked yet.'} icon="M3 10 12 4l9 6M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18" />
          <TraceStep label="Licence" title={k.licence?.licence ?? 'UNKNOWN'} detail={k.licence?.attribution ?? (k.licence ? 'No attribution recorded' : 'No licence is linked yet.')} icon="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm2.5-11.5a3.5 3.5 0 1 0 0 5" />
        </ol>
        <div className="mt-5 rounded-2xl bg-[#F3E9D2] px-4 py-3" data-does-not-say="">
          <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-gold-text)]">What this does not say</h3>
          <p className="mt-1 text-[14px] leading-relaxed text-[color:var(--pl-ink)]">{k.doesNotSay}</p>
        </div>
        {k.source?.url ? (
          <p className="pa-src mt-4 text-[15px] font-semibold">Open the original source: <OriginalSourceLink href={k.source.url} className={`${attribution} ${target44}`}>{k.source.publisher}</OriginalSourceLink></p>
        ) : null}
        <p className="mt-5 text-[15px] leading-relaxed">Every statement here comes from a public record, shown with its source, licence and dates. Gaps stay visible instead of being filled with guesses.</p>
        <h3 className="mt-6 text-[16px] font-semibold">The rules we keep</h3>
        <div className="mt-2 divide-y divide-[color:var(--pl-line)] rounded-2xl bg-[color:var(--pl-paper)] px-4">
          {THEMES.map((t) => (
            <details key={t.title} className="pa-theme py-1">
              <summary className={`text-[15px] font-medium ${focusRing}`}>{t.title}</summary>
              <p className="pb-3 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">{t.body}</p>
            </details>
          ))}
        </div>
        <h3 className="mt-6 text-[16px] font-semibold">Sources</h3>
        <ul className="pa-src mt-2 grid gap-2">
          {view.sources.map((s) => (
            <li key={`${s.publisher}|${s.licence}|${s.url ?? ''}`} className="rounded-xl bg-[color:var(--pl-paper)] px-4 py-2 text-[14px]">
              {s.url ? <EvidenceLink href={s.url} className={attribution}>{s.publisher}</EvidenceLink> : <span className="font-medium">{s.publisher}</span>}
              <span className="block text-[13px] text-[color:var(--pl-muted)]">Licence: {s.licence} · Retrieved: {s.retrievedAt ?? 'UNKNOWN'} · Published: {s.publishedAt ?? 'UNKNOWN'}</span>
            </li>
          ))}
        </ul>
        {notShown.length ? (
          <>
            <h3 className="mt-6 text-[16px] font-semibold">Not shown yet</h3>
            <ul className="mt-2 grid gap-2">
              {notShown.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 text-[14px]">{c.state ? <PlaceStateBadge state={c.state} /> : null}<span className="font-medium">{c.label}:</span> <span className="text-[color:var(--pl-muted)]">{c.summary}</span></li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="mt-5 text-[14px]"><HashLink href="#evidence" className={`${target44} ${textLink}`}>See the public record</HashLink></p>
      </Sheet>

      <Sheet id="water" title="Water">
        <div className="mt-2 text-center" data-water-empty="">
          <svg viewBox="0 0 160 90" width="160" height="90" aria-hidden="true" focusable="false" className="mx-auto"><g fill="none" stroke="#9AA9A3"><ellipse cx="80" cy="72" rx="62" ry="12" /><ellipse cx="80" cy="72" rx="42" ry="8" /><ellipse cx="80" cy="72" rx="22" ry="4.5" /></g><path d="M80 8c9 13 15 22 15 31a15 15 0 0 1-30 0c0-9 6-18 15-31Z" fill="#E4ECEE" stroke="#35606E" strokeWidth="2.5" /></svg>
          <h3 className={`${editorial} mt-3 text-[28px] leading-tight text-[color:var(--pl-ink)]`}>Water hasn&apos;t been gathered yet</h3>
          <p className="mx-auto mt-3 max-w-md text-[16px] leading-relaxed text-[color:var(--pl-muted)]">No verified public water evidence is linked to {view.title} so far. {water?.summary} When it is linked, every reading will show its source and date.</p>
          <p className={`${editorial} mt-3 text-[19px] italic text-[color:var(--pl-green)]`}>{NO_EVIDENCE_NOTE}</p>
          {water?.state ? <p className="mt-3"><PlaceStateBadge state={water.state} /></p> : null}
        </div>
        <div className="mt-5 rounded-2xl border border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] p-4">
          <h4 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-muted)]">Where it could come from</h4>
          <ul className="mt-2 grid gap-2 text-[15px]">
            <li className="flex items-center justify-between gap-3">Official water-quality monitoring <span className="rounded-full bg-[#EFEBE0] px-3 py-1 text-[13px] font-semibold text-[color:var(--pl-muted)]">Not linked yet</span></li>
            <li className="flex items-center justify-between gap-3">Your photos and notes {notice ? <Link href={notice.href} prefetch={false} className={`${target44} rounded-full bg-[#F3E9D2] px-3 text-[13px] font-semibold text-[color:var(--pl-gold-text)] ${textLink}`}>Private · Unverified</Link> : <span className="rounded-full bg-[#EFEBE0] px-3 py-1 text-[13px] font-semibold text-[color:var(--pl-muted)]">Not open yet</span>}</li>
          </ul>
        </div>
        {available.length ? (
          <>
            <h4 className="mt-5 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-muted)]">Already here</h4>
            <ul className="mt-2 flex flex-wrap justify-center gap-2">{available.map((c) => <Chip key={c.id} c={c} />)}</ul>
          </>
        ) : null}
      </Sheet>

      <Sheet id="time" title={`${tw.from} — ${tw.to}`}>
        <p className="mt-1 text-[16px] text-[color:var(--pl-muted)]">{tw.years.length} years at {view.title}. Each square is a year.</p>
        <div className="mt-4 grid gap-4" aria-hidden="true">
          {decades.map((row) => {
            const n = row.reduce((a, y) => a + y.records, 0)
            return (
              <div key={row[0].year}>
                <p className="flex justify-between text-[15px] font-semibold text-[color:var(--pl-muted)]"><span>{row[0].year}–{row[row.length - 1].year}</span><span>{n ? `${n} ${n === 1 ? 'record' : 'records'}` : 'Not gathered yet'}</span></p>
                <div className="mt-2 flex gap-1.5"><TimeCells years={row} size="sheet" /></div>
              </div>
            )
          })}
        </div>
        {view.timeline.length ? (
          <ol className="mt-5 grid gap-3" data-time-records="">
            {view.timeline.map((r) => (
              <li key={`${r.date}|${r.handle}`} className={`${card} flex items-baseline gap-4 p-4`}>
                <p className={`${editorial} text-[22px] tabular-nums text-[color:var(--pl-green)]`}>{r.date}</p>
                <div><p className="text-[16px] font-medium">{r.statement}</p><p className="text-[13px] text-[color:var(--pl-muted)]">{r.classLabel}</p><HashLink href={`#${recordAnchor(r.handle)}`} className={`${target44} text-[14px] font-medium ${textLink}`}>See the record</HashLink></div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-5 rounded-2xl border border-dashed border-[color:var(--pl-line)] p-4 text-[15px]"><span className="font-semibold">No dated public records yet.</span> <span className="text-[color:var(--pl-muted)]">Undated records, including designations, are not placed on a timeline. No trend is claimed.</span></p>
        )}
        {tw.outside ? <p className="mt-3 text-[14px] text-[color:var(--pl-muted)]">{tw.outside} dated {tw.outside === 1 ? 'record falls' : 'records fall'} outside this window.</p> : null}
        <p className="mt-4 flex flex-wrap gap-4 text-[14px] text-[color:var(--pl-muted)]"><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="h-3.5 w-6 rounded bg-[color:var(--pl-green)]" />Dated public evidence</span><span className="inline-flex items-center gap-2"><span aria-hidden="true" className="pa-gap h-3.5 w-6 rounded" />Not gathered yet</span></p>
        <p className={`${editorial} mt-4 text-center text-[19px] italic text-[color:var(--pl-green)]`}>We never fill gaps with guesses.</p>
        <NextStep href="#species" label="Species and features" />
      </Sheet>

      <Sheet id="species" title="Species and features">
        {recorded.length ? (
          <>
            <h3 className="mt-5 text-[16px] font-semibold">Named in public observation records</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{recorded.map((s) => <SpeciesRow key={s.key} s={s} path={view.path} />)}</ul>
          </>
        ) : (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[15px]"><PlaceStateBadge state="NOT RECORDED" /> No public observation records name species here yet.</p>
        )}
        {designation.length ? (
          <>
            <h3 className="mt-7 text-[16px] font-semibold">Named as reasons this site is protected</h3>
            {view.designationNote ? <p className="mt-3 rounded-xl border-l-4 border-[color:var(--pl-gold)] bg-[color:var(--pl-paper)] px-4 py-3 text-[14px] leading-relaxed">{view.designationNote}</p> : null}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">{designation.map((s) => <SpeciesRow key={s.key} s={s} path={view.path} />)}</ul>
          </>
        ) : null}
        <NextStep href="#evidence" label="The public record" />
      </Sheet>

      <Sheet id="map" title="Where the record places it">
        <p className="mt-2 text-[15px] text-[color:var(--pl-muted)]">Every location is shown only as precisely as its source states it.</p>
        <MapStep map={view.map} subject={view.title} />
        <NextStep href="#time" label="Travel through time" />
      </Sheet>

      <Sheet id="evidence" title="The public record">
        <p className="mt-2 text-[15px] text-[color:var(--pl-muted)]">Each record keeps its source, licence and dates. Unknown dates stay unknown.</p>
        <div className="mt-5 grid gap-4">{view.cards.map((c) => <EvidenceCard key={c.handle} c={c} />)}</div>
        <NextStep href="#how-we-know" label="How we know: the original sources" />
      </Sheet>

      {search ? (
        <Sheet id="place-search" title="Search this place">
          <p className="mt-2 text-[15px] text-[color:var(--pl-muted)]" data-search-query="">Results for “{search.q}” in the public record for {view.title}. Matched word by word, never guessed.</p>
          {search.status === 'invalid' ? <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--pl-line)] p-4 text-[15px]">That search could not be run. Try a shorter search of plain words.</p> : null}
          {search.warning ? <p className="mt-4 rounded-xl border-l-4 border-[color:var(--pl-gold)] bg-[color:var(--pl-paper)] px-4 py-3 text-[14px] leading-relaxed" data-search-warning="">{search.warning}</p> : null}
          {search.species.length ? (
            <>
              <h3 className="mt-5 text-[16px] font-semibold">Species and features</h3>
              <ul className="mt-2 grid gap-2">
                {search.species.map((r) => (
                  <li key={r.slug}>{view.path ? <Link href={`${view.path}/species/${r.slug}`} prefetch={false} className={`block rounded-xl bg-[color:var(--pl-paper)] px-4 py-3 hover:bg-[color:var(--pl-green-soft)] ${focusRing}`}><span className="block text-[15px] font-semibold">{r.title}</span>{r.latin ? <span className="block text-[13px] italic text-[color:var(--pl-muted)]">{r.latin}</span> : null}<span className="block text-[12px] text-[color:var(--pl-muted)]">{r.basis}</span></Link> : <span className="block px-4 py-3 text-[15px] font-semibold">{r.title}</span>}</li>
                ))}
              </ul>
            </>
          ) : null}
          {search.records.length ? (
            <>
              <h3 className="mt-5 text-[16px] font-semibold">Public records</h3>
              <ul className="mt-2 grid gap-2">
                {search.records.map((r) => (
                  <li key={r.handle}><HashLink href={`#${recordAnchor(r.handle)}`} className={`block rounded-xl bg-[color:var(--pl-paper)] px-4 py-3 hover:bg-[color:var(--pl-green-soft)] ${focusRing}`}><span className="block text-[15px] font-medium">{r.statement}</span><span className="block text-[12px] text-[color:var(--pl-muted)]">{r.classLabel}</span></HashLink></li>
                ))}
              </ul>
            </>
          ) : null}
          {search.status === 'ok' && !search.species.length && !search.records.length ? (
            <p className="mt-4 rounded-2xl border border-dashed border-[color:var(--pl-line)] p-4 text-[15px]" data-search-empty=""><span className="font-semibold">Nothing in this place&apos;s public record matches.</span> <span className="text-[color:var(--pl-muted)]">{NO_EVIDENCE_NOTE}</span></p>
          ) : null}
          <p className="mt-5 flex flex-wrap gap-x-5 text-[14px]">
            <HashLink href="#place-menu" className={`${target44} ${textLink}`}>Search again</HashLink>
            <Link href={{ pathname: '/search', query: { q: search.q } }} prefetch={false} className={`${target44} ${textLink}`}>Search all of BioVeracity</Link>
          </p>
        </Sheet>
      ) : null}

      <Sheet id="place-menu" title="Menu" heading={<BioVeracityPlaceMark size={22} />}>
        <PlaceSearch path={view.path} defaultValue={search?.q} />
        <ul className="mt-4 grid gap-1 sm:grid-cols-2">
          {view.prompts.map((p) => (
            <li key={p.id}><HashLink href={`#${p.id}`} className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>{p.question}</HashLink></li>
          ))}
          <li><HashLink href="#arrive-categories" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>What the public record holds</HashLink></li>
          <li><HashLink href="#species" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>Species and features</HashLink></li>
          <li><HashLink href="#map" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>Where the record places it</HashLink></li>
          <li><HashLink href="#time" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>Travel through time</HashLink></li>
          <li><HashLink href="#evidence" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>The public record</HashLink></li>
          <li><HashLink href="#how-we-know" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>How we know</HashLink></li>
          <li><Link href="/" prefetch={false} className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>BioVeracity home</Link></li>
        </ul>
      </Sheet>
    </>
  )
}
