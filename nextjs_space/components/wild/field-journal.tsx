import type { Journal } from '@/lib/wild-hubs/journal'

// “A year in the woods.” A quiet, unfolding reading of one place as the seasons
// turn. We do NOT lay the year out as twelve identical boxes: a month only
// appears once there is something to say about it — the venue's own seasonal
// note, or what visitors have actually noticed. Empty stretches stay silent
// rather than competing for attention, and every visitor entry keeps its
// provenance in plain words. Photographs lead; the system never does.

export function FieldJournal({ journal, placeName }: { journal: Journal; placeName: string }) {
  const active = journal.months.filter((m) => m.entries.length > 0 || m.campaign)

  return (
    <section className="bv-section bv-journal">
      <p className="bv-eyebrow">A year in the woods</p>
      <h2>The place, as the year turns.</h2>
      <p className="bv-journal-lead">
        {journal.total > 0
          ? `What people have noticed at ${placeName}, kept in the month they saw it — alongside what to look for as the seasons change.`
          : `Nothing has been noticed at ${placeName} yet. As visitors begin to share what they see, this year will slowly fill in, month by month.`}
      </p>

      {active.length > 0 && (
        <div className="bv-journal-year">
          {active.map((m) => (
            <article key={m.index} className="bv-journal-month">
              <header className="bv-journal-month-head">
                <h3>{m.name}</h3>
                {m.entries.length > 0 && (
                  <span className="bv-journal-count">
                    {m.entries.length} {m.entries.length === 1 ? 'observation' : 'observations'}
                  </span>
                )}
              </header>

              {m.campaign && (
                <p className="bv-journal-note">
                  <span className="bv-journal-note-title">{m.campaign.title}.</span>{' '}
                  {m.campaign.introduction}
                </p>
              )}

              {m.entries.length > 0 && (
                <ul className="bv-journal-entries">
                  {m.entries.map((e) => (
                    <li key={e.id} className="bv-journal-entry">
                      <figure>
                        <img
                          src={e.photoUrl}
                          alt={
                            e.identified
                              ? `A visitor's photograph, thought to be ${e.whatYouThink || e.categoryLabel}`
                              : 'A visitor\u2019s photograph, not yet identified'
                          }
                          loading="lazy"
                        />
                        <figcaption>
                          <span className="bv-journal-what">
                            {e.identified ? e.whatYouThink || e.categoryLabel : 'Not yet identified'}
                          </span>
                          <span className="bv-journal-meta">
                            {e.observedLabel}
                            {e.coarseLocation ? ` · ${e.coarseLocation}` : ''}
                          </span>
                          <span className="bv-journal-prov">A visitor's observation</span>
                        </figcaption>
                      </figure>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}

      <p className="bv-small">
        Every photograph above is a visitor’s own observation, shared with permission. It records what
        someone thought they saw — not verified ecological evidence — and appearing here does not change
        that.
      </p>
    </section>
  )
}
