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
          <p className="bv-eyebrow">Source-linked evidence for every place in Ireland</p>
          <h1>
            Every place has a story.
            <br />
            <em>Connect the evidence behind it.</em>
          </h1>
          <p className="bv-intro">
            Explore the wildlife, water, landscape and planning records that help
            explain a place. Bring the sources together to reveal its character,
            understand change and see what needs a closer look.
          </p>
          <div className="bv-routes">
            <article className="bv-route-card">
              <p className="bv-eyebrow">For businesses &amp; places to visit</p>
              <p>
                Turn the nature around your business into a richer guest
                experience—with a local discovery guide, seasonal stories and your
                own QR signage.
              </p>
              <Link className="bv-button" href="/wild/partners">
                Explore the business experience
              </Link>
            </article>
            <article className="bv-route-card">
              <p className="bv-eyebrow">For planners, ecologists &amp; professional teams</p>
              <p>
                Bring environmental records and your own documents into a
                source-linked case. Compare findings, follow the chronology and
                prepare reports for review.
              </p>
              <Link className="bv-button" href="/professionals">
                Explore the professional workspace
              </Link>
            </article>
          </div>
        </div>
        <aside className="bv-hero-figure" aria-label="Featured wildlife photograph">
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
          <p className="bv-small">
            Every photograph and record on BioVeracity carries its source and
            date, so you always know where a story comes from.
          </p>
        </aside>
      </section>

      <section className="bv-section" id="business">
        <p className="bv-eyebrow">For businesses &amp; places to visit</p>
        <h2>
          Give guests a reason
          <br />
          <em>to look closer.</em>
        </h2>
        <div className="bv-split">
          <div>
            <p>
              A city hotel, coastal café, pottery studio, garden or visitor
              attraction can all become a starting point for discovery. We help
              you tell your place’s nature story through photographs and words
              you approve, with a QR code guests can open at your door — no app
              or account needed.
            </p>
            <div className="bv-actions">
              <Link className="bv-button" href="/wild/partners#enquire">
                Contact us for pricing
              </Link>
              <Link className="bv-text-link" href="/wild/places/example-craft-venue">
                See an example experience ↗
              </Link>
            </div>
          </div>
          <aside className="bv-hub-preview" aria-label="Illustrative venue hub">
            <div className="bv-preview-top">
              <span>BIOVERACITY</span>
              <span>Illustrative example</span>
            </div>
            <div className="bv-preview-body">
              <p className="bv-eyebrow">Your place. A wider world.</p>
              <h2>A world worth noticing.</h2>
              <p>
                Your rooms, food, craft or experiences, alongside the local
                stories that make a visit memorable.
              </p>
              <div className="bv-preview-card">
                <span>{current.month} · SEASONAL INSPIRATION</span>
                <h3>{current.label}</h3>
                <p>{current.prompt}</p>
              </div>
              <p className="bv-small">Your website ↗ &nbsp; · &nbsp; Plan your visit ↗</p>
            </div>
          </aside>
        </div>
      </section>

      <section className="bv-section bv-tinted">
        <p className="bv-eyebrow">One place, two perspectives</p>
        <h2>
          The River Nore,
          <br />
          <em>seen two ways.</em>
        </h2>
        <p>
          The same source can serve a guest and a professional. Here is one
          place in Wild Kilkenny, read from both sides of BioVeracity.
        </p>
        <div className="bv-perspectives">
          <article className="bv-perspective">
            <p className="bv-eyebrow">For a riverside business</p>
            <h3>A reason for guests to pause.</h3>
            <p>
              A café or guesthouse by the Nore can tell guests why the river
              matters — otters at dusk, the story of the freshwater pearl mussel
              — each linked to its public source and season.
            </p>
            <Link className="bv-text-link" href="/wild/kilkenny#river-nore">
              See it in Wild Kilkenny →
            </Link>
          </article>
          <article className="bv-perspective">
            <p className="bv-eyebrow">For a professional team</p>
            <h3>The evidence, brought together.</h3>
            <p>
              An ecologist or planner can pull the same River Nore SAC
              designation and qualifying species into a source-linked case,
              compare dated records and prepare a report for review.
            </p>
            <Link className="bv-text-link" href="/professionals">
              See the professional workspace →
            </Link>
          </article>
        </div>
        <p className="bv-small">
          Both views draw on the same public source (River Barrow and River Nore
          SAC, National Parks &amp; Wildlife Service). A designation is not a
          promise of a sighting or a right to enter private land.
        </p>
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
          You bring the place. BioVeracity prepares it with you.
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
              'Tell us about your place',
              'Share your county, venue type, website and photographs in a short, guided conversation.',
            ],
            [
              '02',
              'We build your plan with you',
              'We prepare twelve editable monthly themes, guest discovery prompts and caption drafts, drawing on sourced local material.',
            ],
            [
              '03',
              'You approve everything',
              'Nothing goes live until you have reviewed and approved it. Your ecology hub and QR address are then published.',
            ],
            [
              '04',
              'We keep the seasons moving',
              'The reviewed monthly feature changes with the calendar, and we refresh future plans with you.',
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
          <Link className="bv-text-link" href="/wild/partners">
            Explore the business experience ↗
          </Link>
        </div>
      </section>

      <section className="bv-section bv-professional-entry">
        <div>
          <p className="bv-eyebrow">
            For planners, ecologists, councils &amp; professional teams
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
