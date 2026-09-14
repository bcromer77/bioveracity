'use client'
import { EvidenceLink } from '@/components/evidence-link'

import Link from 'next/link'
import { useState } from 'react'
const SEASONS = [
  {
    name: 'Spring',
    theme: 'A fresh reason to get away.',
    detail:
      'Local nature stories, thoughtful day-out ideas and a family discovery prompt.',
    prompt: 'Look closely. Which colours and shapes catch your eye?',
    label: 'A fresh perspective',
    month: 'APRIL',
  },
  {
    name: 'Summer',
    theme: 'Make more of the family stay.',
    detail:
      'A pocket-sized discovery guide guests can open from your reception, menu or room.',
    prompt:
      'Make a family field notebook. Record what you notice and what you still want to identify.',
    label: 'Small discoveries. Lasting memories.',
    month: 'JULY',
  },
  {
    name: 'Autumn',
    theme: 'Give a quieter break its own story.',
    detail:
      'Seasonal inspiration and ready-to-edit copy for guests looking beyond the summer rush.',
    prompt:
      'Notice what has changed. What can a dated source help you understand?',
    label: 'A quieter escape',
    month: 'OCTOBER',
  },
  {
    name: 'Winter',
    theme: 'Keep the curiosity going.',
    detail:
      'Local stories to enjoy indoors, a slower-stay theme and a fresh way to introduce your place.',
    prompt:
      'Explore a local story together. Choose one question for your next visit.',
    label: 'Stories for slower days',
    month: 'DECEMBER',
  },
]
export function SeasonalLanding() {
  const [season, setSeason] = useState(2)
  const current = SEASONS[season]
  return (
    <>
      <section className="bv-hero bv-season-hero">
        <div>
          <p className="bv-eyebrow">
            For every place that shares its landscape
          </p>
          <h1>
            The nature around you
            <br />
            is changing.
            <br />
            <em>Help people notice.</em>
          </h1>
          <p className="bv-intro">
            Turn what is actually happening around your place into something
            guests can see, understand and remember — sourced, seasonal,
            and yours to share.
          </p>
          <div className="bv-actions">
            <Link className="bv-button" href="/wild/studio">
              Create your ecology hub
            </Link>
            <EvidenceLink className="bv-text-link" href="#seasons">
              See the seasonal approach ↗
            </EvidenceLink>
          </div>
          <p className="bv-small">
            Your place, your photographs, your story. You approve everything
            before anyone sees it.
          </p>
        </div>
        <aside className="bv-hub-preview" aria-label="Illustrative ecology hub">
          <div className="bv-preview-top">
            <span>BIOVERACITY</span>
            <span>Illustrative example</span>
          </div>
          <figure className="bv-preview-photo">
            <img
              src="/hero-otter.jpg"
              alt="A Eurasian otter resting at the water's edge, its reflection mirrored in still water"
              loading="eager"
              width={1400}
              height={1138}
            />
            <figcaption className="bv-photo-caption">
              <span className="bv-photo-species">Eurasian otter</span>
              <span className="bv-photo-credit">Photograph: Byrdyak (CC BY-SA 4.0)</span>
            </figcaption>
          </figure>
          <div className="bv-preview-body">
            <p className="bv-eyebrow">Your place. A wider world.</p>
            <h2>A world worth noticing.</h2>
            <p>
              Your rooms, food, craft or experiences. The local stories that
              make a visit memorable.
            </p>
            <div className="bv-preview-card">
              <span>{current.month} · SEASONAL INSPIRATION</span>
              <h3>{current.label}</h3>
              <p>{current.prompt}</p>
            </div>
            <p className="bv-small">
              Your website ↗ &nbsp; · &nbsp; Plan your visit ↗
            </p>
          </div>
        </aside>
      </section>
      <section className="bv-section" id="seasons">
        <p className="bv-eyebrow">One place. Four different invitations.</p>
        <h2>
          Your quieter season
          <br />
          <em>deserves a better story.</em>
        </h2>
        <p>
          Build around the experiences you actually offer and the guests you
          want to reach. Use search-interest data, when available, to inform
          your planning alongside sourced local material.
        </p>
        <div
          className="bv-season-tabs"
          role="group"
          aria-label="Choose a season"
        >
          {SEASONS.map((s, i) => (
            <button
              type="button"
              key={s.name}
              aria-pressed={season === i}
              onClick={() => setSeason(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="bv-season-panel" aria-live="polite">
          <div>
            <p className="bv-eyebrow">{current.name} · Illustrative campaign</p>
            <h3>{current.theme}</h3>
            <p>{current.detail}</p>
          </div>
          <div className="bv-prompt">
            <span>A guest discovery prompt</span>
            <p>{current.prompt}</p>
          </div>
        </div>
        <p className="bv-small">
          These are editorial examples, not measured demand, a booking forecast
          or a promise of wildlife sightings.
        </p>
      </section>
      <section className="bv-section bv-tinted">
        <p className="bv-eyebrow">
          You bring the place. BioVeracity builds the starting point.
        </p>
        <h2>
          Set it up once.
          <br />
          <em>Keep the seasons moving.</em>
        </h2>
        <div className="bv-grid bv-four">
          {[
            [
              '01',
              'Add your story',
              'Choose your county and venue type. Add your words, website and photographs.',
            ],
            [
              '02',
              'Generate your plan',
              'Get twelve editable monthly themes, guest discovery prompts and caption drafts. Import Google Trends data if you have it.',
            ],
            [
              '03',
              'Submit for review',
              'Approve your annual plan and submit it. BioVeracity reviews the content before your ecology hub and QR address go live.',
            ],
            [
              '04',
              'Welcome every season',
              'The reviewed monthly feature changes with the calendar. Edit future plans privately and submit them for a fresh review.',
            ],
          ].map(([n, t, b]) => (
            <article className="bv-feature" key={n}>
              <span className="bv-number">{n}</span>
              <h3>{t}</h3>
              <p>{b}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bv-section bv-split">
        <div>
          <p className="bv-eyebrow">
            More to share. Less to start from scratch.
          </p>
          <h2>
            A guest guide.
            <br />A content plan.
            <br />
            <em>A reason to look closer.</em>
          </h2>
          <p>
            Use your hub at reception, in rooms, on menus or beside your
            products. Copy approved captions into your own marketing. Guests
            explore without an account or app download.
          </p>
          <Link
            className="bv-button bv-green"
            href="/wild/places/example-woodland-venue"
          >
            Explore the example ecology hub ↗
          </Link>
        </div>
        <div className="bv-topic">
          <h3>Built for your kind of place.</h3>
          <p>
            A city hotel, coastal café, pottery studio, garden, visitor
            attraction or community space can all be a starting point.
          </p>
          <p>
            Local sources add context. Your own approved material tells your
            story. Participation makes no claim about environmental
            certification.
          </p>
          <Link href="/wild">Explore Wild Counties →</Link>
        </div>
      </section>
      <section className="bv-section bv-pricing">
        <p className="bv-eyebrow">A clear arrangement</p>
        <h2>
          Your hub. Your signage.
          <br />
          <em>Your seasonal community.</em>
        </h2>
        <p>
          Personalised signage is paid upfront. Community membership is monthly.
          We agree the content, support, publication and fulfilment terms before
          any commitment.
        </p>
        <div className="bv-actions">
          <Link className="bv-button" href="/wild/partners#enquire">
            Contact us for pricing
          </Link>
          <Link className="bv-text-link" href="/wild/studio">
            Start with your draft ↗
          </Link>
        </div>
      </section>
      <section className="bv-section bv-professional-entry">
        <div>
          <p className="bv-eyebrow">
            For planners, ecologists, councils & professional teams
          </p>
          <h2>
            Need to understand
            <br />
            <em>the evidence behind a site?</em>
          </h2>
          <p>
            Bring planning records, environmental data and private documents
            into a source-linked chronology. Follow dates, compare statements
            and prepare reviewed reports.
          </p>
        </div>
        <Link className="bv-button bv-green" href="/professionals">
          Explore the professional workspace →
        </Link>
      </section>
    </>
  )
}
