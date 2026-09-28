// Universal Place shell (Place Experience PR D). Server component with no
// handlers of its own; links use the app's managed next/link and the shared
// EvidenceLink attribution control (external sources are never navigated to).
// Renders ONLY a PlaceShellView built from the PR C public DTOs.
// Place-neutral: every Place-specific word arrives as data.

import type { PlaceShellView, PlaceState, ShellEvidenceCard, ShellFact, ShellSpecies } from '@/lib/place/shell-view'
import { NO_EVIDENCE_NOTE } from '@/lib/place/shell-view'
import Link from 'next/link'
import { EvidenceLink } from '@/components/evidence-link'
import { BioVeracityPlaceMark } from './place-mark'
import { PlaceMobileNav } from './place-mobile-nav'
import { placeTokenStyle } from './place-tokens'

const focus =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--pl-fuchsia)]'
const editorial = 'font-[family-name:var(--pl-editorial)]'
const link = `underline decoration-[color:var(--pl-gold)] underline-offset-4 hover:text-[color:var(--pl-green)] ${focus}`
// The shared EvidenceLink renders a <button> disclosure for external sources; give it the same 44px target and focus ring.
const attribution =
  'underline decoration-[color:var(--pl-gold)] underline-offset-4 [&>button]:inline-flex [&>button]:min-h-[44px] [&>button]:items-center [&>button]:rounded-lg [&>button:focus-visible]:outline [&>button:focus-visible]:outline-2 [&>button:focus-visible]:outline-offset-2 [&>button:focus-visible]:outline-[color:var(--pl-fuchsia)]'

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

function EvidenceCard({ card }: { card: ShellEvidenceCard }) {
  return (
    <article className="rounded-2xl bg-[color:var(--pl-paper)] p-5 shadow-[0_1px_2px_rgba(28,42,34,0.06),0_8px_24px_rgba(28,42,34,0.06)] md:p-7" data-public-handle={card.handle}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[color:var(--pl-green)]">{card.classLabel}</p>
      <h3 className={`${editorial} mt-2 text-[22px] leading-snug`}>{card.statement}</h3>
      {card.note ? (
        <p className="mt-3 border-l-2 border-[color:var(--pl-gold)] pl-3 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">{card.note}</p>
      ) : null}
      <dl className="mt-4 grid gap-2 sm:grid-cols-2">
        {card.facts.map((fact) => <Fact key={fact.label} fact={fact} />)}
      </dl>
      {card.cautions.length ? (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Limits of this record">
          {card.cautions.map((c) => (
            <li key={c} className="rounded-full bg-[color:var(--pl-green-soft)] px-3 py-1 text-[12px] text-[color:var(--pl-green-deep)]">{c}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-5 border-t border-[color:var(--pl-line)] pt-4 text-[13px] leading-relaxed text-[color:var(--pl-muted)]">
        Source: {card.source.url ? <EvidenceLink href={card.source.url} className={attribution}>{card.source.publisher}</EvidenceLink> : card.source.publisher}
        {' '}· Licence: {card.source.licence}
        {card.source.attribution ? <><br />Attribution: {card.source.attribution}</> : null}
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

export function PlaceShell({ view }: { view: PlaceShellView }) {
  const designation = view.species.filter((s) => s.framing === 'designation_feature')
  const recorded = view.species.filter((s) => s.framing === 'subject')
  return (
    <div style={placeTokenStyle} className="min-h-screen pb-28 font-sans md:pb-0" data-place-shell="v1">
      <Link href="#place-main" className={`sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-[color:var(--pl-paper)] focus:px-4 focus:py-3 ${focus}`}>
        Skip to place content
      </Link>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-5 md:px-8">
        <Link href="/" className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg ${focus}`}>
          <BioVeracityPlaceMark size={28} />
          <span className="text-[17px] font-semibold tracking-tight text-[color:var(--pl-green-deep)]">BioVeracity</span>
        </Link>
        <span className="text-[12px] font-medium text-[color:var(--pl-muted)]">Free to explore · no account needed</span>
      </header>
      <PlaceMobileNav />

      <main id="place-main" tabIndex={-1} className="focus:outline-none">
        <section aria-labelledby="place-title" className="mx-auto max-w-5xl px-5 pb-10 pt-10 md:px-8 md:pt-16">
          <div className="grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--pl-green)]">A living place record</p>
              <h1 id="place-title" className={`${editorial} mt-3 text-[44px] leading-[1.05] text-[color:var(--pl-green-deep)] md:text-[64px]`}>{view.title}</h1>
              {view.context ? (
                <p className="mt-4 text-[16px] text-[color:var(--pl-muted)]">Held in the public record as <span className="font-medium text-[color:var(--pl-ink)]">{view.context}</span></p>
              ) : null}
              <div className="mt-6 h-px w-24 bg-[color:var(--pl-gold)]" aria-hidden="true" />
              <p className="mt-6 max-w-xl text-[17px] leading-relaxed">
                What is known about this place, where it came from, and what is still unknown.
              </p>
              <p className="mt-3 text-[14px] text-[color:var(--pl-muted)]">{view.publicItemCount} public {view.publicItemCount === 1 ? 'record' : 'records'} · {NO_EVIDENCE_NOTE}</p>
            </div>
            <figure className="relative mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center rounded-full bg-[radial-gradient(circle_at_50%_40%,var(--pl-paper),var(--pl-green-soft))]">
              <BioVeracityPlaceMark size={120} />
              <figcaption className="sr-only">BioVeracity Place mark. No map or photograph is shown until its source and licence are verified.</figcaption>
            </figure>
          </div>
        </section>

        <section id="explore" aria-labelledby="explore-title" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-10 md:px-8">
          <h2 id="explore-title" className={`${editorial} text-[30px] text-[color:var(--pl-green-deep)] md:text-[36px]`}>Start with a question</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {view.prompts.map((p) => (
              <article key={p.id} id={p.id} className="scroll-mt-20 rounded-2xl bg-[color:var(--pl-paper)] p-6 shadow-[0_1px_2px_rgba(28,42,34,0.06),0_8px_24px_rgba(28,42,34,0.05)]">
                <h3 className={`${editorial} text-[22px]`}>{p.question}</h3>
                {p.state ? <p className="mt-3"><PlaceStateBadge state={p.state} /></p> : null}
                <p className="mt-3 text-[15px] leading-relaxed">{p.summary}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--pl-muted)]">{p.detail}</p>
                {p.id === 'how-do-we-know' ? <p className="mt-3 text-[14px]"><Link href="#evidence" className={`inline-flex min-h-[44px] items-center ${link}`}>See the public record</Link></p> : null}
              </article>
            ))}
          </div>
        </section>

        <section id="species" aria-labelledby="species-title" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-10 md:px-8">
          <h2 id="species-title" className={`${editorial} text-[30px] text-[color:var(--pl-green-deep)] md:text-[36px]`}>Species and features</h2>
          {recorded.length ? (
            <>
              <h3 className="mt-6 text-[16px] font-semibold">Named in public observation records</h3>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{recorded.map((s) => <SpeciesRow key={s.key} s={s} />)}</ul>
            </>
          ) : (
            <p className="mt-4 flex flex-wrap items-center gap-2 text-[15px]"><PlaceStateBadge state="NOT RECORDED" /> No public observation records name species here yet.</p>
          )}
          {designation.length ? (
            <>
              <h3 className="mt-8 text-[16px] font-semibold">Named as reasons this site is protected</h3>
              {view.designationNote ? (
                <p className="mt-3 max-w-3xl rounded-xl border-l-4 border-[color:var(--pl-gold)] bg-[color:var(--pl-paper)] px-4 py-3 text-[14px] leading-relaxed">{view.designationNote}</p>
              ) : null}
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{designation.map((s) => <SpeciesRow key={s.key} s={s} />)}</ul>
            </>
          ) : null}
        </section>

        <section id="evidence" aria-labelledby="evidence-title" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-10 md:px-8">
          <h2 id="evidence-title" className={`${editorial} text-[30px] text-[color:var(--pl-green-deep)] md:text-[36px]`}>The public record</h2>
          <p className="mt-2 max-w-2xl text-[15px] text-[color:var(--pl-muted)]">Each record keeps its source, licence and dates. Unknown dates stay unknown.</p>
          <div className="mt-6 grid gap-5">{view.cards.map((c) => <EvidenceCard key={c.handle} card={c} />)}</div>
        </section>

        <section id="place-menu" aria-labelledby="place-menu-title" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-10 md:px-8">
          <h2 id="place-menu-title" className={`${editorial} text-[26px] text-[color:var(--pl-green-deep)]`}>Menu</h2>
          <ul className="mt-4 grid gap-1 sm:grid-cols-2">
            {view.prompts.map((p) => (
              <li key={p.id}><Link href={`#${p.id}`} className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${link}`}>{p.question}</Link></li>
            ))}
            <li><Link href="#species" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${link}`}>Species and features</Link></li>
            <li><Link href="#evidence" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${link}`}>The public record</Link></li>
            <li><Link href="/" className={`flex min-h-[44px] items-center rounded-lg px-2 text-[15px] ${link}`}>BioVeracity home</Link></li>
          </ul>
        </section>
      </main>

      <footer className="bg-[color:var(--pl-green-deep)] text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-5 py-8 md:flex-row md:items-center md:justify-between md:px-8">
          <p className="inline-flex items-center gap-2 text-[15px] font-semibold"><BioVeracityPlaceMark tone="white" size={22} /> BioVeracity</p>
          <p className="text-[13px] text-white/85">Evidence first. Unknowns stay visible.</p>
        </div>
      </footer>
    </div>
  )
}
