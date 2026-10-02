import {
  chainState,
  evidenceById,
  reviewKey,
  sinceVisible,
  visibleEvidence,
  type Evidence,
  type PlaceModel,
} from "@/data/record";
import { useDemo } from "@/state/demo";
import { EnquiryForm } from "@/components/enquiry-form";

function ReviewMark({ review }: { review: Evidence["review"] }) {
  return (
    <span className="review" data-review={reviewKey(review)}>
      {review}
    </span>
  );
}

function Honeycomb({ place, year }: { place: PlaceModel; year: number }) {
  const select = useDemo((s) => s.select);
  const setLens = useDemo((s) => s.setLens);
  return (
    <section className="mt-4">
      <h3 className="font-serif text-xl leading-tight text-balance">
        {place.disclosure ? "What does this statement depend on?" : "What is connected to this place?"}
      </h3>
      <p className="mt-1 text-sm text-pretty text-ink-soft">
        Evidence that normally lives separately is connected here.
      </p>
      <ol className="chain mt-3">
        {place.chain.map((node) => {
          const state = chainState(place, node, year);
          const target = node.laterId && state === "changed" ? node.laterId : node.evidenceId;
          return (
            <li key={node.id} data-state={state}>
              <span className="hex" aria-hidden="true">
                {state === "live" ? <span className="live-pip" /> : null}
              </span>
              {target ? (
                <button
                  type="button"
                  disabled={state === "dim"}
                  onClick={() => {
                    select(target);
                    setLens("evidence");
                  }}
                >
                  {node.label}
                </button>
              ) : (
                <span>{node.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Lenses({ place }: { place: PlaceModel }) {
  const setLens = useDemo((s) => s.setLens);
  return (
    <section className="mt-4">
      <h3 className="proposed">What do you want to know?</h3>
      <div className="mt-2 grid gap-2">
        <button type="button" className="lens-choice" onClick={() => setLens("changed")}>
          {place.lenses.changed}
        </button>
        <button type="button" className="lens-choice" onClick={() => setLens("said")}>
          {place.lenses.said}
        </button>
        <button type="button" className="lens-choice" onClick={() => setLens("evidence")}>
          {place.lenses.evidence}
        </button>
      </div>
    </section>
  );
}

function DisclosureCard({ place }: { place: PlaceModel }) {
  const openSource = useDemo((s) => s.openSource);
  const item = evidenceById(place, place.disclosure?.evidenceId);
  if (!item) return null;
  return (
    <article className="mt-3 border border-line bg-paper px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="proposed">What the company said</p>
        <span className="review">Illustrative disclosure</span>
      </div>
      <blockquote className="mt-2 font-serif text-lg leading-snug text-balance">“{item.excerpt}”</blockquote>
      <p className="mt-2 text-sm text-pretty text-ink-soft">
        {item.document} · {item.locator} · {item.published} · {item.review}
      </p>
      <button type="button" className="btn-quiet" onClick={() => openSource(item.id)}>
        Open source
      </button>
    </article>
  );
}

function Provenance({ item }: { item: Evidence }) {
  const openSource = useDemo((s) => s.openSource);
  const rows: [string, string][] = [
    ["Source", item.source],
    ["Publisher", item.publisher],
    ["Document", item.document],
    ["Page / locator", item.locator],
    ["Publication date", item.published],
    ["Event date", item.eventDate],
    ["Place", item.place],
    ["Retrieved", item.retrieved],
  ];
  return (
    <article>
      <p className="proposed">Illustrative evidence</p>
      <h3 className="mt-2 font-serif text-3xl leading-tight text-balance">{item.title}</h3>
      <p className="mt-2 text-pretty text-ink-soft">{item.summary}</p>
      <p className="mt-3">
        <ReviewMark review={item.review} />
      </p>
      <dl className="provenance mt-4">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
        <dt>Review state</dt>
        <dd>{item.review}</dd>
      </dl>
      <button type="button" className="btn-primary mt-4" onClick={() => openSource(item.id)}>
        <span>Open source</span>
        <span aria-hidden="true">→</span>
      </button>
    </article>
  );
}

function CompanySaid({ place, year }: { place: PlaceModel; year: number }) {
  const statements = (place.statements ?? []).filter((item) => item.yearIndex <= year);
  const selectedId = useDemo((s) => s.selectedId);
  const select = useDemo((s) => s.select);
  const active =
    statements.find((item) => item.id === selectedId) ??
    statements.find((item) => item.id === "s2022") ??
    statements[0];
  const visible = visibleEvidence(place, year);
  const then = active ? visible.filter((item) => active.knownIds.includes(item.id)) : [];
  const later = active ? visible.filter((item) => !active.knownIds.includes(item.id)) : [];

  return (
    <div className="grid gap-4">
      <p className="proposed">What the organisation knew when it said it</p>
      <h2 className="font-serif text-3xl leading-tight text-balance">Statements, in the order they were made.</h2>
      <p className="text-sm text-pretty text-ink-soft">{place.saidNote}</p>
      <div className="grid gap-2">
        {statements.map((statement) => (
          <button
            key={statement.id}
            type="button"
            className="memory"
            data-on={active?.id === statement.id ? "true" : "false"}
            onClick={() => select(statement.id)}
          >
            <span className="text-sm text-muted">
              {statement.when} · {statement.document} · {statement.locator}
            </span>
            <span className="font-serif text-lg leading-snug">“{statement.text}”</span>
            {statement.unchanged ? (
              <span className="text-sm text-ink-soft">Wording unchanged from 2022. The evidence around the place is not.</span>
            ) : null}
          </button>
        ))}
        {year >= place.ticks.length - 1 ? (
          <p className="memory">
            <span className="text-sm text-muted">2026 · Current evidence</span>
            <span>Not another statement. The record around the place, as far as this illustration goes.</span>
          </p>
        ) : null}
      </div>
      {active ? (
        <div className="grid gap-4 border-t border-line pt-4">
          <p className="proposed">Illustrative disclosure</p>
          <h3 className="font-serif text-2xl leading-tight">
            {active.when} {active.document}
          </h3>
          <div>
            <p className="text-sm text-canopy">On the record then</p>
            <ul className="mt-2 grid gap-2">
              {then.map((item) => (
                <li key={item.id} className="text-sm">
                  {item.title} · {item.published}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm text-muted">Arrived later — not used to judge this statement</p>
            <ul className="mt-2 grid gap-2">
              {later.length ? (
                later.map((item) => (
                  <li key={item.id} className="text-sm text-ink-soft">
                    {item.title} · {item.eventDate}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted">Nothing later is on the timeline yet. Drag forward.</li>
              )}
            </ul>
          </div>
        </div>
      ) : (
        <p className="text-ink-soft">No statement has been published yet in this illustration. Drag forward.</p>
      )}
    </div>
  );
}

function ObservationSaid({ place, year }: { place: PlaceModel; year: number }) {
  const items = visibleEvidence(place, year);
  const selectedId = useDemo((s) => s.selectedId);
  const select = useDemo((s) => s.select);
  const active = items.find((item) => item.id === selectedId) ?? items[0];
  return (
    <div className="grid gap-4">
      <h2 className="font-serif text-3xl leading-tight text-balance">{place.lenses.said}</h2>
      <p className="text-sm text-pretty text-ink-soft">{place.saidNote}</p>
      <div className="grid gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="memory"
            data-on={active?.id === item.id ? "true" : "false"}
            onClick={() => select(item.id)}
          >
            <span className="text-sm text-muted">{place.ticks[item.yearIndex]?.long}</span>
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      {active ? (
        <div className="grid gap-3 border-t border-line pt-4">
          <p className="text-sm text-canopy">Recorded by {place.ticks[active.yearIndex]?.long}</p>
          <ul className="grid gap-1 text-sm">
            {items
              .filter((item) => item.yearIndex <= active.yearIndex)
              .map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
          </ul>
          <p className="text-sm text-muted">Not yet recorded</p>
          <ul className="grid gap-1 text-sm text-ink-soft">
            {place.evidence
              .filter((item) => item.yearIndex > active.yearIndex)
              .map((item) => (
                <li key={item.id}>
                  {item.title}
                  {item.yearIndex > year ? " — still ahead of the timeline" : ""}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function RecordPanel({
  place,
  onPlaySince,
}: {
  place: PlaceModel;
  onPlaySince: () => void;
}) {
  const year = useDemo((s) => s.year);
  const lens = useDemo((s) => s.lens);
  const selectedId = useDemo((s) => s.selectedId);
  const setLens = useDemo((s) => s.setLens);
  const select = useDemo((s) => s.select);
  const openEnquiry = useDemo((s) => s.openEnquiry);
  const max = place.ticks.length - 1;

  let body = null;
  if (lens === "enquiry") {
    body = <EnquiryForm />;
  } else if (lens === "changed") {
    body = (
      <div className="grid gap-4">
        <button type="button" className="btn-quiet" onClick={() => setLens("time")}>
          Back to the place
        </button>
        <h2 className="font-serif text-4xl leading-tight text-balance">{place.themeLead}</h2>
        <ol className="grid gap-3">
          {place.themes.map((theme, index) => (
            <li key={theme.title} className="border-t border-line pt-3">
              <p className="font-serif text-2xl leading-tight">
                {index + 1}. {theme.title}
              </p>
              <p className="mt-1 text-pretty text-ink-soft">{theme.detail}</p>
            </li>
          ))}
        </ol>
        <p className="text-pretty">{place.themeLine}</p>
        {year < max ? (
          <p className="text-sm text-muted">
            The time control is not at the end of this illustration. Drag forward to see every item on the place.
          </p>
        ) : null}
        <button type="button" className="btn-primary" onClick={onPlaySince}>
          <span>{place.whyLabel}</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  } else if (lens === "said") {
    body = (
      <div>
        <button type="button" className="btn-quiet" onClick={() => setLens("time")}>
          Back to the place
        </button>
        {place.statements ? <CompanySaid place={place} year={year} /> : <ObservationSaid place={place} year={year} />}
      </div>
    );
  } else if (lens === "evidence") {
    const items = visibleEvidence(place, year);
    const selected = items.find((item) => item.id === selectedId) ?? items[0];
    body = (
      <div className="grid gap-5">
        <button type="button" className="btn-quiet" onClick={() => setLens("time")}>
          Back to the statement
        </button>
        <p className="text-sm text-pretty text-muted">
          The short list is not the whole record. Every item below is illustrative.
        </p>
        {selected ? <Provenance item={selected} /> : <p>Nothing is on the record at this point in time.</p>}
        <div className="grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="memory"
              data-on={selected?.id === item.id ? "true" : "false"}
              onClick={() => select(item.id)}
            >
              <span className="text-sm text-muted">{place.ticks[item.yearIndex]?.long}</span>
              <span>{item.title}</span>
              <ReviewMark review={item.review} />
            </button>
          ))}
        </div>
        {place.id === "company" ? (
          <button type="button" className="btn-quiet" onClick={() => setLens("together")}>
            Where did this come from?
          </button>
        ) : null}
      </div>
    );
  } else if (lens === "since") {
    const items = sinceVisible(place, year);
    const done = year >= place.revealAt && items.length === place.sinceIds.length;
    body = (
      <div className="grid gap-4">
        <button type="button" className="btn-quiet" onClick={() => setLens("time")}>
          Back to the place
        </button>
        <p className="proposed">From the moment it was said</p>
        <h2 className="font-serif text-3xl leading-tight text-balance">{place.primaryAction}</h2>
        <ol className="grid gap-2">
          {items.map((item, index) => (
            <li key={item.id} className="memory">
              <span className="text-sm text-muted">
                {index + 1} · {place.ticks[item.yearIndex]?.long}
              </span>
              <span className="font-serif text-xl leading-tight">{item.title}</span>
              <ReviewMark review={item.review} />
            </li>
          ))}
        </ol>
        {items.length === 0 ? (
          <p className="text-ink-soft">Standing at the disclosure. What followed has not arrived yet.</p>
        ) : null}
        {done ? (
          <div className="grid gap-2 border-t border-line pt-4">
            <p className="font-serif text-3xl leading-tight text-balance">{place.sinceLead}</p>
            <p className="text-pretty text-lg">{place.sinceLine}</p>
            {place.sinceQuiet ? <p className="text-sm text-muted">{place.sinceQuiet}</p> : null}
            <button type="button" className="btn-quiet" onClick={onPlaySince}>
              Play it again
            </button>
            <button type="button" className="btn-primary" onClick={() => setLens("together")}>
              <span>Where did this come from?</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        ) : null}
      </div>
    );
  } else if (year === 0) {
    body = (
      <div>
        <p className="proposed">{place.name}</p>
        <h1 className="mt-3 font-serif text-5xl leading-tight text-balance">
          {place.question}{" "}
          <span className="italic text-botanical">{place.questionItalic}</span>
        </h1>
        <p className="mt-4 text-pretty text-lg text-ink-soft">{place.dek}</p>
        <p className="mt-6 font-serif text-2xl text-botanical">Drag through time →</p>
      </div>
    );
  } else if (year === max && place.disclosure) {
    body = (
      <div>
        <p className="proposed">{place.name}</p>
        <h1 className="mt-1 font-serif text-3xl leading-none text-balance">
          {place.question} <span className="italic text-botanical">{place.questionItalic}</span>
        </h1>
        <DisclosureCard place={place} />
        <button type="button" className="btn-primary mt-3" onClick={onPlaySince}>
          <span>{place.primaryAction}</span>
          <span aria-hidden="true">→</span>
        </button>
        <Honeycomb place={place} year={year} />
        <Lenses place={place} />
        <div className="mt-4 border-t border-line pt-3">
          <button type="button" className="btn-primary" onClick={() => openEnquiry("disclosure")}>
            <span>Show us one disclosure</span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="btn-quiet" onClick={() => openEnquiry("place")}>
            Or show us one place you’re responsible for →
          </button>
        </div>
      </div>
    );
  } else if (year === max) {
    body = (
      <div>
        <p className="proposed">{place.name}</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-balance">
          {place.question} <span className="italic text-botanical">{place.questionItalic}</span>
        </h1>
        <p className="mt-3 text-pretty text-ink-soft">{place.dek}</p>
        <button type="button" className="btn-primary mt-4" onClick={onPlaySince}>
          <span>{place.primaryAction}</span>
          <span aria-hidden="true">→</span>
        </button>
        <Honeycomb place={place} year={year} />
        <Lenses place={place} />
      </div>
    );
  } else {
    const items = visibleEvidence(place, year);
    body = (
      <div>
        <p className="proposed">{place.ticks[year]?.long}</p>
        <h2 className="mt-2 font-serif text-3xl leading-tight text-balance">
          Evidence arrives around the place.
        </h2>
        <div className="mt-4 grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="memory"
              onClick={() => {
                select(item.id);
                setLens("evidence");
              }}
            >
              <span className="text-sm text-muted">{place.ticks[item.yearIndex]?.long}</span>
              <span>{item.title}</span>
              <ReviewMark review={item.review} />
            </button>
          ))}
        </div>
        {place.disclosure && year >= place.anchorYear ? <DisclosureCard place={place} /> : null}
        <p className="mt-4 font-serif text-xl text-botanical">Keep dragging →</p>
      </div>
    );
  }

  return (
    <aside id="record" className="panel">
      <div className="panel-scroll">{body}</div>
    </aside>
  );
}
