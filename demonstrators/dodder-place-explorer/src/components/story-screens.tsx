import { useEffect, useState } from "react";
import { placeOrder, records, evidenceById, type PlaceModel } from "@/data/record";
import { useDemo } from "@/state/demo";

export function Together({ place }: { place: PlaceModel }) {
  const setLens = useDemo((s) => s.setLens);
  const [together, setTogether] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const delay = reduce ? 0 : 900;
    const id = window.setTimeout(() => setTogether(true), delay);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section className="bg-cream px-5 py-8 md:px-12 md:py-12">
      <button type="button" className="btn-quiet" onClick={() => setLens("since")}>
        Back
      </button>
      <p className="proposed mt-4">{together ? "One chronology" : "Separate records"}</p>
      <div className={together ? "origin-grid is-together mt-6 max-w-3xl" : "origin-grid mt-6 max-w-3xl"}>
        {place.origins.map((origin) => (
          <article key={origin.title}>
            <h2 className="font-serif text-2xl leading-tight">{origin.title}</h2>
            <p className="text-sm text-ink-soft">{origin.detail}</p>
          </article>
        ))}
      </div>
      <div className={together ? "mt-8 max-w-xl" : "mt-8 max-w-xl opacity-0"}>
        <h2 className="font-serif text-4xl leading-tight text-balance md:text-5xl">
          The evidence was always there. <span className="italic text-botanical">It just wasn’t together.</span>
        </h2>
        <p className="mt-4 text-pretty text-lg text-ink-soft">
          BioVeracity remembers what was said, what happened next, and the evidence connecting the two.
        </p>
        <button type="button" className="btn-primary mt-6 max-w-md" onClick={() => setLens("landscape")}>
          <span>See only the place</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}

export function Landscape({ place }: { place: PlaceModel }) {
  const setLens = useDemo((s) => s.setLens);
  const openEnquiry = useDemo((s) => s.openEnquiry);
  const jump = useDemo((s) => s.jump);
  return (
    <section>
      <div className="relative h-[46dvh] min-h-64">
        <img className="stage-photo" src={place.earlyImage} alt={place.imageAlt} />
        <button type="button" className="btn-quiet absolute top-4 left-4 bg-cream px-3" onClick={() => setLens("time")}>
          Return to the record
        </button>
      </div>
      <div className="bg-cream px-5 py-8 md:px-12 md:py-10">
        <h1 className="max-w-3xl font-serif text-5xl leading-tight text-balance md:text-6xl">
          Every place is changing. <span className="italic text-botanical">Someone should notice.</span>
        </h1>
        <p className="mt-3 font-serif text-xl italic text-ink-soft">Give every place a memory.</p>
        <div className="mt-8 max-w-xl border-t border-line pt-6">
          <h2 className="font-serif text-3xl leading-tight text-balance">
            What happens if we do this with one of your disclosures?
          </h2>
          <p className="mt-3 text-pretty text-ink-soft">
            Send us one sustainability disclosure or target. See what its evidence record could look like.
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => openEnquiry("disclosure")}>
            <span>Show us one disclosure</span>
            <span aria-hidden="true">→</span>
          </button>
          <button type="button" className="btn-quiet mt-2" onClick={() => openEnquiry("place")}>
            Or show us one place you’re responsible for →
          </button>
          <button type="button" className="btn-quiet mt-4" onClick={() => jump("engine")}>
            Try another place →
          </button>
        </div>
      </div>
    </section>
  );
}

const enginePlaces: { id: (typeof placeOrder)[number]; line: string }[] = [
  { id: "dodder", line: "What changed here?" },
  { id: "woodland", line: "What changed here this spring?" },
  { id: "wetland", line: "The water changed. What changed before it?" },
  { id: "company", line: "What did we say about this place?" },
];

export function Engine() {
  const setPlace = useDemo((s) => s.setPlace);
  const setLens = useDemo((s) => s.setLens);
  return (
    <section className="bg-cream px-5 py-8 md:px-12 md:py-12">
      <button type="button" className="btn-quiet" onClick={() => setLens("landscape")}>
        Back
      </button>
      <p className="proposed mt-4">Same engine</p>
      <h1 className="mt-2 max-w-3xl font-serif text-4xl leading-tight text-balance md:text-5xl">
        The question changes. The record does not.
      </h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {enginePlaces.map((entry) => {
          const place = records[entry.id];
          return (
            <button
              key={entry.id}
              type="button"
              className="memory text-left"
              onClick={() => setPlace(entry.id)}
            >
              <img src={place.earlyImage} alt="" className="mb-3 h-36 w-full object-cover" />
              <span className="proposed">
                {place.id === "dodder"
                  ? "River Dodder"
                  : place.id === "company"
                    ? "Company site"
                    : place.name.replace("Example ", "")}
              </span>
              <span className="mt-1 font-serif text-2xl leading-tight">{entry.line}</span>
            </button>
          );
        })}
      </div>
      <ol className="engine-stack mt-10 max-w-sm">
        {["Place", "Time", "Evidence", "Relationships", "Change"].map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <p className="mt-6 font-serif text-2xl italic text-botanical">This is BioVeracity.</p>
    </section>
  );
}

export function SourceSheet({ place }: { place: PlaceModel }) {
  const sourceId = useDemo((s) => s.sourceId);
  const closeSource = useDemo((s) => s.closeSource);
  const item = evidenceById(place, sourceId);
  useEffect(() => {
    if (!item) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeSource();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, closeSource]);
  if (!item) return null;
  return (
    <div className="source-sheet" role="presentation" onClick={closeSource}>
      <article
        className="source-page"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-title"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="proposed">
          {place.id === "dodder" ? "Source record. Open the locator. This is not a copy of the file." : "Illustrative source — not a filed document"}
        </p>
        <h2 id="source-title" className="mt-4 font-serif text-3xl leading-tight">
          {item.document}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {item.publisher} · {item.locator} · {item.published}
        </p>
        <blockquote className="mt-6 border-l border-gold pl-4 font-serif text-2xl leading-snug text-balance">
          {item.excerpt}
        </blockquote>
        <p className="mt-6 text-sm text-pretty text-muted">
          {place.id === "dodder"
            ? "The quotation is the passage held in this pack. The locator is the original. Nothing here adds a cause."
            : "This page exists so the source feels one step away. It is not a reproduction, and it must not be read as one."}
        </p>
        <button type="button" className="btn-primary mt-6 max-w-xs" onClick={closeSource}>
          <span>Close</span>
          <span aria-hidden="true">→</span>
        </button>
      </article>
    </div>
  );
}

export function ContextDialog() {
  return (
    <dialog id="context-dialog" className="context-dialog">
      <div className="p-6 md:p-8">
        <p className="proposed">Context, not a score</p>
        <h2 className="mt-3 font-serif text-3xl leading-tight text-balance">
          Why a listed company might look at a place
        </h2>
        <div className="mt-4 grid gap-3 text-pretty text-ink-soft">
          <p>
            On 30 September 2026 the Financial Conduct Authority published PS26/19. For accounting periods
            beginning on or after 1 January 2027, in-scope listed companies move to sustainability reporting
            aligned with UK Sustainability Reporting Standards S1 and S2, on a comply-or-explain basis.
          </p>
          <p>
            The FCA has encouraged companies preparing for that regime to identify financially material
            sustainability and climate-related risks and opportunities, review governance, integrate them into
            strategy, assess the resilience of the business model, develop the data, metrics and targets the
            disclosures will need, and establish internal controls and review.
          </p>
          <p>
            UK SRS S2 concerns climate-related risks and opportunities. This demonstration stays with one of
            those questions: physical climate risk at a place.
          </p>
          <p>
            It is not a compliance score. It does not predict a regulatory breach. It is a way to navigate
            evidence. BioVeracity is not the regulator, and the company on this screen is not real.
          </p>
        </div>
        <form method="dialog" className="mt-6">
          <button type="submit" className="btn-primary max-w-xs">
            <span>Close</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </div>
    </dialog>
  );
}
