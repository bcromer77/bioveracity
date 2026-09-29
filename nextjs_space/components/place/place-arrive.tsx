// Place ARRIVE screen (Gate F X1). Server component, presentation only: it
// renders a PlaceShellView built from the PR C public DTOs and nothing else.
// Place-neutral: every Place-specific word arrives as data.
// Order follows PLACE -> DISCOVERY -> EVIDENCE -> SOURCE. Sheets are CSS
// :target panels opened through HashLink (works without JavaScript too).

import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ArriveCategory, PlaceShellView, PlaceState, ShellEvidenceCard, ShellFact, ShellSpecies } from '@/lib/place/shell-view'
import { NO_EVIDENCE_NOTE } from '@/lib/place/shell-view'
import { EvidenceLink } from '@/components/evidence-link'
import { HashLink } from '@/components/place-client/hash-link'
import { PlaceSearch } from '@/components/place-client/place-search'
import { BioVeracityPlaceMark } from './place-mark'
import { attribution, card, editorial, eyebrow, focusRing, section, sectionTitle, sheetTitle, target44, textLink } from './place-arrive-styles'

export function PlaceStateBadge({ state }: { state: PlaceState }) {
  return (
    <span
      data-place-state={state}
      className="inline-flex items-center rounded-full border border-[color:var(--pl-line)] bg-[color:var(--pl-warm)] px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-[color:var(--pl-gold-text)]"
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

function EvidenceCard({ c }: { c: ShellEvidenceCard }) {
  return (
    <article className={`${card} p-5 md:p-6`} data-public-handle={c.handle}>
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

function SpeciesRow({ s }: { s: ShellSpecies }) {
  return (
    <li className="rounded-xl bg-[color:var(--pl-paper)] px-4 py-3 shadow-[0_1px_2px_rgba(28,42,34,0.06)]" data-framing={s.framing}>
      <p className="text-[15px] font-semibold">{s.commonName ?? s.label}</p>
      {s.commonName ? <p className="text-[13px] italic text-[color:var(--pl-muted)]">{s.label}</p> : null}
      <p className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[color:var(--pl-muted)]">
        <span>{s.kindLabel} · {s.basis}</span>
        <span className="inline-flex items-center gap-1">Here now: <PlaceStateBadge state={s.presenceNow} /></span>
      </p>
    </li>
  )
}

function Sheet({ id, title, children, heading }: { id: string; title: string; children: ReactNode; heading?: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} role="dialog" aria-modal="true" tabIndex={-1} className="pa-sheet" data-pa-sheet="">
      <div className="pa-sheet-panel">
        <div className="flex items-start justify-between gap-4">
          <h2 id={`${id}-title`} className={`${sheetTitle} inline-flex items-center gap-2`}>{heading}{title}</h2>
          <HashLink href="#place-main" close aria-label={`Close ${title}`} className={`${target44} min-w-[44px] justify-center border border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] px-3 text-[14px] font-medium`}>
            Close
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

const THEMES: Array<{ title: string; body: string }> = [
  { title: 'Evidence is not interpretation', body: 'A record says what its source says. Our wording never adds to it, and analysis is always labelled as analysis.' },
  { title: 'A designation is not presence', body: 'A site is protected for the features named in its designation. That records why it is protected, not what can be found there today.' },
  { title: 'No evidence is not absence', body: `${NO_EVIDENCE_NOTE} States such as NOT RECORDED or NOT YET INGESTED mean the record is silent.` },
  { title: 'An illustration is not evidence', body: 'Illustrations set the scene only. They are always marked Illustrative and never depict what was recorded.' },
  { title: 'Public records only', body: 'Only records cleared for public use are shown. Private, restricted and sensitive locations stay out.' },
]

export function PlaceArrive({ view }: { view: PlaceShellView }) {
  const designation = view.species.filter((s) => s.framing === 'designation_feature')
  const recorded = view.species.filter((s) => s.framing === 'subject')
  const notShown = view.categories.filter((c) => c.status === 'unwired' || c.status === 'unverified')
  return (
    <>
      {/* PLACE */}
      <section aria-labelledby="place-title" className="mx-auto max-w-5xl px-5 pb-6 pt-6 md:px-8 md:pt-12">
        <div className="grid items-center gap-6 md:grid-cols-[1.25fr_1fr] md:gap-10">
          <div className="pa-fade order-2 md:order-1">
            <p className={eyebrow}>A living place record</p>
            <h1 id="place-title" className={`${editorial} mt-3 text-[42px] leading-[1.05] text-[color:var(--pl-green-deep)] md:text-[60px]`}>{view.title}</h1>
            {view.relation ? (
              <p className="mt-3 text-[16px] font-medium text-[color:var(--pl-ink)]" data-place-relation="">{view.relation}</p>
            ) : view.context ? (
              <p className="mt-3 text-[16px] text-[color:var(--pl-muted)]">Held in the public record as <span className="font-medium text-[color:var(--pl-ink)]">{view.context}</span></p>
            ) : null}
            <p className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full border border-[color:var(--pl-line)] bg-[color:var(--pl-paper)] px-3 py-1.5 text-[13px]" data-place-location="">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false" className="text-[color:var(--pl-green)]"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21Z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
              <span className="font-medium">{view.context ?? view.title}</span>
              <span className="text-[color:var(--pl-muted)]">· Named place, no map shown</span>
            </p>
            <div className="mt-5 h-px w-24 bg-[color:var(--pl-gold)]" aria-hidden="true" />
            <p className="mt-5 max-w-xl text-[17px] leading-relaxed">What is known about this place, where it came from, and what is still unknown.</p>
            <p className="mt-2 text-[14px] text-[color:var(--pl-muted)]">{view.publicItemCount} public {view.publicItemCount === 1 ? 'record' : 'records'} · {NO_EVIDENCE_NOTE}</p>
            <p className="mt-4">
              <HashLink href="#how-we-know" className={`${target44} gap-2 rounded-full bg-[color:var(--pl-green-deep)] px-5 text-[15px] font-semibold text-white hover:bg-[color:var(--pl-green)]`}>
                How we know <span aria-hidden="true">→</span>
              </HashLink>
            </p>
          </div>
          <figure className="order-1 md:order-2" data-hero="illustration" data-hero-rights="PENDING">
            <div
              role="img"
              aria-label={`Illustration of ${view.title}: not shown while its rights are pending. Illustrations are presentation only, never evidence.`}
              className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-3xl bg-[radial-gradient(circle_at_30%_25%,var(--pl-paper),var(--pl-green-soft)_60%,#cfe0d3)]"
            >
              <BioVeracityPlaceMark size={88} />
              <span className="absolute left-3 top-3 rounded-full bg-[color:var(--pl-paper)] px-3 py-1 text-[12px] font-semibold text-[color:var(--pl-gold-text)] shadow-sm" data-illustrative-badge="">Illustrative</span>
            </div>
            <figcaption className="mt-2 text-[12px] text-[color:var(--pl-muted)]">Illustration pending rights clearance · presentation only, not evidence</figcaption>
          </figure>
        </div>
      </section>

      {/* DISCOVERY */}
      <section id="arrive-categories" aria-labelledby="arrive-categories-title" className={section}>
        <h2 id="arrive-categories-title" className={sectionTitle}>What the public record holds</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">{view.categories.map((c) => <Category key={c.id} c={c} />)}</ul>
      </section>

      <section id="time-strip" aria-labelledby="time-strip-title" className={section}>
        <h2 id="time-strip-title" className={sectionTitle}>Through time</h2>
        {view.timeline.length ? (
          <ol className="mt-5 flex gap-3 overflow-x-auto pb-2" data-time-strip="dated">
            {view.timeline.map((r) => (
              <li key={`${r.date}|${r.statement}`} className={`${card} min-w-[220px] p-4`}>
                <p className="font-mono text-[13px] font-semibold text-[color:var(--pl-green)]">{r.date}</p>
                <p className="mt-1 text-[15px]">{r.statement}</p>
                <p className="mt-1 text-[12px] text-[color:var(--pl-muted)]">{r.classLabel}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--pl-line)] p-5" data-time-strip="empty">
            <p className="text-[16px] font-semibold">No dated public records yet</p>
            <p className="mt-1 text-[14px] text-[color:var(--pl-muted)]">Undated records, including designations, are not placed on a timeline. No trend is claimed.</p>
          </div>
        )}
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
              {p.id === 'how-do-we-know' ? <p className="mt-3 text-[14px]"><HashLink href="#how-we-know" className={`${target44} ${textLink}`}>How we know</HashLink></p> : null}
            </article>
          ))}
        </div>
      </section>

      {/* EVIDENCE and SOURCE sheets */}
      <Sheet id="how-we-know" title="How we know">
        <p className="mt-3 text-[15px] leading-relaxed">Every statement here comes from a public record, shown with its source, licence and dates. Gaps stay visible instead of being filled with guesses.</p>
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

      <Sheet id="species" title="Species and features">
        {recorded.length ? (
          <>
            <h3 className="mt-5 text-[16px] font-semibold">Named in public observation records</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{recorded.map((s) => <SpeciesRow key={s.key} s={s} />)}</ul>
          </>
        ) : (
          <p className="mt-4 flex flex-wrap items-center gap-2 text-[15px]"><PlaceStateBadge state="NOT RECORDED" /> No public observation records name species here yet.</p>
        )}
        {designation.length ? (
          <>
            <h3 className="mt-7 text-[16px] font-semibold">Named as reasons this site is protected</h3>
            {view.designationNote ? <p className="mt-3 rounded-xl border-l-4 border-[color:var(--pl-gold)] bg-[color:var(--pl-paper)] px-4 py-3 text-[14px] leading-relaxed">{view.designationNote}</p> : null}
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">{designation.map((s) => <SpeciesRow key={s.key} s={s} />)}</ul>
          </>
        ) : null}
      </Sheet>

      <Sheet id="evidence" title="The public record">
        <p className="mt-2 text-[15px] text-[color:var(--pl-muted)]">Each record keeps its source, licence and dates. Unknown dates stay unknown.</p>
        <div className="mt-5 grid gap-4">{view.cards.map((c) => <EvidenceCard key={c.handle} c={c} />)}</div>
      </Sheet>

      <Sheet id="place-menu" title="Menu" heading={<BioVeracityPlaceMark size={22} />}>
        <PlaceSearch />
        <ul className="mt-4 grid gap-1 sm:grid-cols-2">
          {view.prompts.map((p) => (
            <li key={p.id}><HashLink href={`#${p.id}`} className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>{p.question}</HashLink></li>
          ))}
          <li><HashLink href="#arrive-categories" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>What the public record holds</HashLink></li>
          <li><HashLink href="#species" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>Species and features</HashLink></li>
          <li><HashLink href="#evidence" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>The public record</HashLink></li>
          <li><HashLink href="#how-we-know" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>How we know</HashLink></li>
          <li><Link href="/" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${textLink}`}>BioVeracity home</Link></li>
        </ul>
      </Sheet>
    </>
  )
}
