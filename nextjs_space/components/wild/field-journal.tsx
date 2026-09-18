import type { Journal } from '@/lib/wild-hubs/journal'

// “A year in the woods.” A quiet, editorial reading of the place across twelve
// months — the venue's own seasonal notes alongside what visitors have noticed.
// Every visitor entry carries its provenance in plain words. Empty months are
// shown with intent, never padded with invented sightings or a species counter.

export function FieldJournal({ journal, placeName }: { journal: Journal; placeName: string }) {
  return (
    <section className="bv-section bv-journal">
      <p className="bv-eyebrow">A year in the woods</p>
      <h2>The place, month by month.</h2>
      <p>
        {journal.total > 0
          ? 'What people have noticed here, kept in the month they saw it — alongside what to look for as the year turns.'
          : 'Nothing has been noticed here yet. As visitors begin to share what they see, this year will slowly fill in.'}
      </p>
      <ol className="bv-journal-months">
        {journal.months.map((m) => (
          <li key={m.index} className="bv-journal-month">
            <div className="bv-journal-head">
              <h3>{m.name}</h3>
              {m.campaign && <span className="bv-badge">Seasonal note</span>}
            </div>
            {m.campaign && (
              <div className="bv-journal-note">
                <h4>{m.campaign.title}</h4>
                <p>{m.campaign.introduction}</p>
              </div>
            )}
            {m.entries.length > 0 ? (
              <ul className="bv-journal-entries">
                {m.entries.map((e) => (
                  <li key={e.id} className="bv-journal-entry">
                    <figure>
                      <img src={e.photoUrl} alt={e.identified ? `A visitor's photograph, thought to be ${e.whatYouThink || e.categoryLabel}` : 'A visitor\u2019s photograph, not yet identified'} loading="lazy" />
                    </figure>
                    <div className="bv-journal-entry-body">
                      <span className="bv-chip bv-chip-community">Community observation</span>
                      <p className="bv-journal-what">
                        {e.identified
                          ? e.whatYouThink || e.categoryLabel
                          : 'Not yet identified'}
                      </p>
                      <p className="bv-small">
                        {e.categoryLabel}
                        {' · '}
                        {e.observedLabel}
                        {e.coarseLocation ? ` · ${e.coarseLocation}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              !m.campaign && (
                <p className="bv-journal-empty">Nothing recorded here yet.</p>
              )
            )}
          </li>
        ))}
      </ol>
      <p className="bv-small">
        Every entry above is a visitor’s own observation, shared with permission
        and shown as a community sighting. It is not verified ecological
        evidence, and being published here does not change that.
      </p>
    </section>
  )
}
