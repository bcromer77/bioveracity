'use client'
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
            For hotels, guesthouses, restaurants & places to visit
          </p>
          <h1>
            Give guests a reason
            <br />
            to explore.
            <br />
            <em>In every season.</em>
          </h1>
          <p className="bv-intro">
            Turn your photographs and the nature around you into your own
            ecology hub: a beautiful guest guide, a seasonal content plan and
            one QR code that brings it together.
          </p>
          <div className="bv-actions">
            <Link className="bv-button" href="/wild/studio">
              Create your ecology hub
            </Link>
            <a className="bv-text-link" href="#seasons">
              See the seasonal approach ↗
            </a>
          </div>
          <p className="bv-small">
            Your website and booking links stay at the centre. You approve what
            guests see.
          </p>
        </div>
        <aside className="bv-hub-preview" aria-label="Illustrative ecology hub">
          <div className="bv-preview-top">
            <span>BIOVERACITY</span>
            <span>Illustrative example</span>
          </div>
          <div className="bv-preview-art" aria-hidden="true">
            <span className="bv-orbit" />
            <span className="bv-hill bv-hill-one" />
            <span className="bv-hill bv-hill-two" />
            <span className="bv-waterline" />
          </div>
          <div className="bv-preview-body">
            <p className="bv-eyebrow">Your place. A wider world.</p>
            <h2>Your ecology hub</h2>
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
              'Review and publish',
              'Check the content and approve your annual plan. Your ecology hub and stable QR address are created together.',
            ],
            [
              '04',
              'Welcome every season',
              'The approved monthly feature changes with the calendar. Edit future plans in draft and publish when ready.',
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
