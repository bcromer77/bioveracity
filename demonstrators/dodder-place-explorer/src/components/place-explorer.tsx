import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Droplets,
  FileText,
  Landmark,
  Leaf,
  Pause,
  Play,
  Search,
  Shield,
  Users,
} from "lucide-react";
import { eventsAt, projectPlace, sourceById, type PlacePack } from "@/data/contract";
import { dodderHoney, type HoneyItem, type HoneyQuestion } from "@/data/dodder";
import {
  chainState,
  evidenceById,
  evidenceCategory,
  type EvidenceCategory,
  type PlaceModel,
} from "@/data/record";
import { useDemo } from "@/state/demo";
import { PlaceStage } from "@/components/place-stage";
import { RecordPanel } from "@/components/record-panel";
import { TimeBar } from "@/components/time-bar";
import { ContextDialog, Engine, Landscape, SourceSheet, Together } from "@/components/story-screens";

const catIcon = {
  water: Droplets,
  wildlife: Leaf,
  planning: Landmark,
  people: Users,
  designations: Shield,
  reports: FileText,
} as const;

const layerCopy: Record<EvidenceCategory, string> = {
  water: "Water & weather",
  wildlife: "Wildlife observations",
  planning: "Planning & development",
  people: "Statements & people",
  designations: "Habitats & designations",
  reports: "Reports & assessments",
};

const filterLabel: Record<EvidenceCategory, string> = {
  water: "Water",
  wildlife: "Wildlife",
  planning: "Planning",
  people: "People",
  designations: "Designations",
  reports: "Reports",
};

function slot(index: number, count: number) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  return { x: 50 + Math.cos(angle) * 36, y: 50 + Math.sin(angle) * 33 };
}

function Masthead() {
  const jump = useDemo((s) => s.jump);
  const setLens = useDemo((s) => s.setLens);
  function context() {
    const dialog = document.getElementById("context-dialog");
    if (dialog instanceof HTMLDialogElement) dialog.showModal();
  }
  return (
    <header className="mast">
      <div className="brand-lockup">
        <p className="font-serif text-2xl leading-none">BioVeracity</p>
        <p className="brand-kicker">Places remember</p>
      </div>
      <nav aria-label="Demonstration">
        <button className="mast-link" type="button" onClick={() => jump("engine")}>
          Places
        </button>
        <button className="mast-link" type="button" onClick={() => setLens("evidence")}>
          Evidence
        </button>
        <button className="mast-link" type="button" onClick={context}>
          For professionals
        </button>
        <button className="mast-link" type="button" onClick={context}>
          For organisations
        </button>
        <button className="mast-link" type="button" onClick={context}>
          About
        </button>
      </nav>
      <div className="mast-actions">
        <button type="button" className="icon-btn" aria-label="Choose another place" onClick={() => jump("engine")}>
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <button type="button" className="btn-line" onClick={() => jump("engine")}>
          Explore a place →
        </button>
      </div>
    </header>
  );
}

function ConnectHub({
  place,
  year,
  layer,
}: {
  place: PlaceModel;
  year: number;
  layer: EvidenceCategory | "all";
}) {
  const select = useDemo((s) => s.select);
  const seen = new Set<string>();
  const nodes = place.chain.filter((node) => {
    if (!node.evidenceId || seen.has(node.evidenceId)) return false;
    seen.add(node.evidenceId);
    return true;
  });
  return (
    <div className="hub" aria-label="Records that share this place">
      <svg className="hub-svg" viewBox="0 0 100 100" aria-hidden="true">
        {nodes.map((node, index) => {
          const point = slot(index, nodes.length);
          const state = chainState(place, node, year);
          return (
            <line
              key={node.id}
              x1="50"
              y1="50"
              x2={point.x}
              y2={point.y}
              stroke="currentColor"
              strokeWidth="0.35"
              opacity={state === "dim" ? 0.2 : 0.8}
            />
          );
        })}
      </svg>
      <div className="hub-center">{place.siteLabel}</div>
      {nodes.map((node, index) => {
        const point = slot(index, nodes.length);
        const state = chainState(place, node, year);
        const evidence = evidenceById(place, node.evidenceId);
        const category = evidence ? evidenceCategory(evidence) : "reports";
        const dimmed = state === "dim" || (layer !== "all" && category !== layer);
        const Icon = catIcon[category];
        const target = node.laterId && state === "changed" ? node.laterId : node.evidenceId;
        const pole = point.y < 46 ? "n" : "s";
        return (
          <button
            key={node.id}
            type="button"
            className="hub-node"
            data-cat={category}
            data-state={dimmed ? "dim" : state}
            data-pole={pole}
            style={{ left: `${point.x}%`, top: `${point.y}%` }}
            disabled={state === "dim" || !target}
            onClick={() => target && select(target)}
          >
            <span className="hub-ico">
              <Icon size={15} strokeWidth={1.75} aria-hidden="true" />
            </span>
            {node.label}
          </button>
        );
      })}
    </div>
  );
}

export function PlaceExplorer({
  place,
  frame = "standalone",
}: {
  place: PlaceModel;
  frame?: "standalone" | "bare";
}) {
  const pack = projectPlace(place);
  const lens = useDemo((s) => s.lens);
  const year = useDemo((s) => s.year);
  const selectedId = useDemo((s) => s.selectedId);
  const setYear = useDemo((s) => s.setYear);
  const setLens = useDemo((s) => s.setLens);
  const select = useDemo((s) => s.select);
  const touch = useDemo((s) => s.touch);
  const openEnquiry = useDemo((s) => s.openEnquiry);
  const openSource = useDemo((s) => s.openSource);
  const [layer, setLayer] = useState<EvidenceCategory | "all">("all");
  const [chronoAll, setChronoAll] = useState(false);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);
  const deepRef = useRef<HTMLElement>(null);

  function clearTimer() {
    if (timer.current != null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }

  function stop() {
    clearTimer();
    setPlaying(false);
  }

  useEffect(() => clearTimer, []);
  useEffect(() => {
    clearTimer();
    setPlaying(false);
  }, [place.id]);
  useEffect(() => {
    setLayer("all");
    setChronoAll(false);
  }, [place.id]);

  const deep = lens === "changed" || lens === "said" || lens === "evidence" || lens === "since";
  useEffect(() => {
    if (!deep) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    deepRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [deep, lens]);

  function play(from: number, to: number, ms: number) {
    clearTimer();
    touch();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setYear(from);
      setPlaying(false);
      return;
    }
    if (from >= to) {
      setYear(to);
      setPlaying(false);
      return;
    }
    let cursor = from;
    setYear(cursor);
    setPlaying(true);
    timer.current = window.setInterval(() => {
      cursor += 1;
      setYear(cursor);
      if (cursor >= to) {
        clearTimer();
        setPlaying(false);
      }
    }, ms);
  }

  function onYear(next: number) {
    stop();
    setYear(next);
  }

  function onPlayAll() {
    if (playing) {
      stop();
      return;
    }
    setLens("time");
    play(0, place.ticks.length - 1, 900);
  }

  function onPlaySince() {
    setLens("since");
    play(place.playFrom, place.playTo, 1100);
  }

  function onPick(id: string) {
    stop();
    select(id);
  }

  const focused = lens === "landscape" || lens === "engine" || lens === "together";
  const visible = eventsAt(pack, year, layer);
  const chronology = [...visible].reverse();
  const chronoShown = chronoAll ? chronology : chronology.slice(0, 4);
  const knownPool = [...visible].reverse();
  const knownSelected = knownPool.filter((event) => event.id === selectedId);
  const knownRest = knownPool.filter((event) => event.id !== selectedId);
  const known = [...knownSelected, ...knownRest].slice(0, 5);
  const when = pack.timeline.ticks[year]?.long ?? "";

  return (
    <div className="min-h-dvh bg-paper text-ink">
      {frame === "standalone" ? <Masthead /> : null}
      <p className="demo-strip">
        {place.id === "dodder"
          ? place.banner
          : `${place.banner}. Test data only — not an evidence pack for the Slaney, the Dodder or the Cam.`}
      </p>
      <a className="skip" href="#questions">
        Skip to the record
      </a>
      {focused ? (
        lens === "landscape" ? (
          <Landscape place={place} />
        ) : lens === "engine" ? (
          <Engine />
        ) : (
          <Together place={place} />
        )
      ) : lens === "enquiry" ? (
        <div className="enquiry-wrap">
          <RecordPanel place={place} onPlaySince={onPlaySince} />
        </div>
      ) : (
        <>
          <section className="hero-grid" aria-label={place.siteLabel}>
            <div className="hero-copy">
              <p className="kicker">{pack.kicker}</p>
              <h1 className="hero-title">
                {pack.headline} <em>{pack.headlineItalic}</em>
              </h1>
              <p className="hero-dek">{pack.summary}</p>
              {place.id === "dodder" ? (
                <Verdict
                  year={year}
                  when={when}
                  last={place.ticks.length - 1}
                  onShowLatest={() => onYear(place.ticks.length - 1)}
                  onOpenStop={() => {
                    onPick("epa-2011");
                    openSource("epa-2011");
                  }}
                />
              ) : null}
              <div className="cta-row">
                <button type="button" className="btn-solid" onClick={onPlayAll}>
                  {playing ? "Pause" : "Play"}
                </button>
                <button type="button" className="btn-line" onClick={() => openEnquiry("place")}>
                  {place.id === "dodder" ? "Do this for my place →" : "Tell us about your place →"}
                </button>
              </div>
            </div>
            <div className="hero-map">
              <PlaceStage place={place} onPick={onPick} layer={layer}>
                <div className="map-chrome">
                  <TimeBar place={place} onYear={onYear} onPlayAll={onPlayAll} variant="map" />
                  {place.id === "dodder" ? (
                    <div className="map-filters" role="group" aria-label="Compare two evidence states">
                      <button
                        type="button"
                        className="filter-chip"
                        aria-pressed={year === 0}
                        onClick={() => onYear(0)}
                      >
                        Then · 24 Oct 2011
                      </button>
                      <button
                        type="button"
                        className="filter-chip"
                        aria-pressed={year === place.ticks.length - 1}
                        onClick={() => onYear(place.ticks.length - 1)}
                      >
                        Latest evidence
                      </button>
                    </div>
                  ) : null}
                  <div className="map-filters" role="group" aria-label="Evidence layers">
                    <button
                      type="button"
                      className="filter-chip"
                      aria-pressed={layer === "all"}
                      onClick={() => setLayer("all")}
                    >
                      All
                    </button>
                    {pack.layers.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="filter-chip"
                        aria-pressed={layer === item}
                        onClick={() => setLayer(item)}
                      >
                        {filterLabel[item]}
                      </button>
                    ))}
                  </div>
                </div>
              </PlaceStage>
              <button type="button" className="plate-play" onClick={onPlayAll} aria-pressed={playing}>
                <span className="plate-play-ico" aria-hidden="true">
                  {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                </span>
                {playing ? "Pause" : year >= place.ticks.length - 1 ? "Play again" : "Play"}
              </button>
            </div>
          </section>

          <section className="stats-row" aria-label={place.id === "dodder" ? "Records located by this date" : "Illustrative counts at this point in time"}>
            {place.id === "dodder" ? (
              <p className="stats-when">{year === place.ticks.length - 1 ? "Latest evidence located" : when}</p>
            ) : null}
            {pack.layers.map((item) => {
              const Icon = catIcon[item];
              const count = pack.events.filter(
                (event) => event.category === item && event.yearIndex <= year,
              ).length;
              return (
                <article key={item} className="stat" data-cat={item}>
                  <span className="stat-icon">
                    <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
                  </span>
                  <div>
                    <p className="stat-num">{count}</p>
                    <p className="stat-label">{layerCopy[item]}</p>
                    {place.id === "dodder" ? null : (
                      <p className="stat-note">Illustrative · up to {when}</p>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          {place.id === "dodder" ? (
            <CompareBoard
              pack={pack}
              year={year}
              layer={layer}
              when={when}
              selectedId={selectedId}
              onPick={onPick}
              onOpen={openSource}
              onEnquire={() => openEnquiry("place")}
            />
          ) : (
          <section className="questions" id="questions">
            <article className="q-card">
              <h2 className="q-title">What changed here?</h2>
              <p className="q-kicker">Key events in this illustration</p>
              {chronoShown.length === 0 ? (
                <p className="q-lead">Nothing in this layer is on the record yet. Drag forward, or choose All.</p>
              ) : (
                <ol className="chrono">
                  {chronoShown.map((event) => {
                    const source = sourceById(pack, event.sourceId);
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          className="chrono-btn"
                          data-on={selectedId === event.id ? "true" : "false"}
                          onClick={() => onPick(event.id)}
                        >
                          <span className="rail" data-cat={event.category}>
                            <i />
                          </span>
                          <span>
                            <span className="chrono-date">{event.eventDate}</span>
                            <span className="chrono-name">{event.title}</span>
                            <span className="chrono-src">
                              Source: {source?.publisher} · {source?.locator} · Published {event.publicationDate} ·{" "}
                              {event.reviewLabel}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {chronology.length > 4 ? (
                <button type="button" className="q-foot" onClick={() => setChronoAll((open) => !open)}>
                  {chronoAll ? "Show the short list" : "View full chronology →"}
                </button>
              ) : (
                <button type="button" className="q-foot" onClick={() => setLens("changed")}>
                  Read what changed →
                </button>
              )}
            </article>

            <article className="q-card">
              <h2 className="q-title">What does this connect to?</h2>
              <p className="q-kicker">What else was happening around this time?</p>
              <ConnectHub place={place} year={year} layer={layer} />
              <p className="relate-note">
                These records may be related and require review. Nearness in time or place is not a cause.
              </p>
            </article>

            <KnownColumn pack={pack} events={known} selectedId={selectedId} onPick={onPick} onOpen={openSource} onAll={() => setLens("evidence")} />
          </section>
          )}

          {deep ? (
            <section className="deep-read" ref={deepRef} aria-label="The record in full">
              <RecordPanel place={place} onPlaySince={onPlaySince} />
            </section>
          ) : null}
          <TimeBar place={place} onYear={onYear} onPlayAll={onPlayAll} variant="moments" />
        </>
      )}
      <SourceSheet place={place} />
      <ContextDialog />
    </div>
  );
}

const spoken: Record<string, { lead: string; because: string }> = {
  "status-040": {
    lead: "One water body improved by one class, then held.",
    because: "Dodder_040 was Poor, then Moderate. The layer does not say why.",
  },
  "status-030": {
    lead: "Two water bodies changed class, then held.",
    because: "A change of class is not a cause, and not a claim of recovery work.",
  },
  "phase-2": {
    lead: "A downstream defence is recorded as finished in 2023.",
    because: "That sentence is from a written answer of 20 May 2025. It was not known on the night.",
  },
  "gauge-new": {
    lead: "This gauge did not exist on the night of the flood.",
    because: "Anglesea Road starts in 2021. It is not a new reading of Waldron’s Bridge.",
  },
  "status-050": {
    lead: "Two water bodies stay in the same class.",
    because: "Same class is not proof the condition inside it was unchanged.",
  },
  "phase-3-still": {
    lead: "This reach is still a scheme, still tied to 2011.",
    because: "No record retrieved says the Clonskeagh to Orwell works have been built.",
  },
  "between-works": {
    lead: "Two schemes were completed. A third is still in design.",
    because: "None of these records says the works contained a later flood.",
  },
  "between-fish": {
    lead: "A fish-passage project has started. It is not built.",
    because: "A consultancy was awarded in March 2026. That is not a population result.",
  },
  "stage-disagree": {
    lead: "Two official pages do not give this scheme the same stage.",
    because: "Both are shown. They are not averaged.",
  },
  "level-block": {
    lead: "These two levels cannot be compared.",
    because: "Different station, different datum, an estimated flow against a level, and a gauge that did not exist in 2011.",
  },
  "rain-block": {
    lead: "A rain day and a rain month cannot be compared.",
    because: "Same stations. The daily total for 27 January 2026 was not in the statement.",
  },
  "warning-gap": {
    lead: "The warning itself was not retrieved.",
    because: "A newspaper reported it. The newspaper is not the warning.",
  },
  "flood-gap": {
    lead: "No flood-event report was found for January 2026.",
    because: "News photographs are not used as a flood extent.",
  },
  "plan-gap": {
    lead: "No planning application was found.",
    because: "Preparation is not an application, a permission, or a construction.",
  },
  "council-gap": {
    lead: "No adopted council decision was retrieved.",
    because: "An indexed draft minute is not shown as a decision.",
  },
};

function evidenceReady(item: HoneyItem, pack: PlacePack, year: number) {
  return item.evidenceIds.every((id) => {
    const event = pack.events.find((entry) => entry.id === id);
    return !!event && event.yearIndex <= year;
  });
}

function Verdict({
  year,
  when,
  last,
  onShowLatest,
  onOpenStop,
}: {
  year: number;
  when: string;
  last: number;
  onShowLatest: () => void;
  onOpenStop: () => void;
}) {
  const atEnd = year >= last;
  const atStart = year === 0;
  const title = atEnd
    ? "There is no line between these two."
    : atStart
      ? "The warning was in the paper. The gauge note was not."
      : "Only what had been published by this date.";
  const body = atEnd
    ? "The 2011 figure is an estimate of flow at Waldron’s Bridge. The 2026 figure is a water level at Anglesea Road, from a gauge that was not there in 2011."
    : atStart
      ? "The note of that gauge came out the following month. Later reports stay off this date."
      : `Move forward from ${when}. Nothing is compared until every record in the comparison had been published.`;
  return (
    <div className="verdict" data-kind={atEnd ? "stop" : "then"}>
      <p className="kicker">{atEnd ? "About these two figures" : "What was knowable"}</p>
      <p className="verdict-title">{title}</p>
      <p className="verdict-body">{body}</p>
      <button type="button" className="verdict-link" onClick={atEnd ? onOpenStop : onShowLatest}>
        {atEnd ? "See the two records →" : "Show the latest evidence →"}
      </button>
    </div>
  );
}

function CompareBoard({
  pack,
  year,
  layer,
  when,
  selectedId,
  onPick,
  onOpen,
  onEnquire,
}: {
  pack: PlacePack;
  year: number;
  layer: EvidenceCategory | "all";
  when: string;
  selectedId: string | null;
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
  onEnquire: () => void;
}) {
  const inLayer = (category: EvidenceCategory) => layer === "all" || layer === category;
  const questions: { id: HoneyQuestion; title: string; kicker: string; count: string }[] = [
    { id: "changed", title: "What changed here?", kicker: "Only where the same record can be set against a later one.", count: "changed" },
    { id: "between", title: "What happened between?", kicker: "Interventions and decisions, dated when they were published.", count: "interventions" },
    { id: "same", title: "What stayed the same?", kicker: "Only where the same measure turns up again.", count: "unchanged" },
    { id: "disagree", title: "Where does the evidence disagree?", kicker: "Both records. Neither is silently preferred.", count: "disagreement" },
    { id: "incomparable", title: "What can’t we compare?", kicker: "Numbers that look alike and are not.", count: "cannot be compared" },
    { id: "unknown", title: "What don’t we know?", kicker: "Left blank on purpose.", count: "not located" },
  ];
  const known = pack.events.filter((event) => event.yearIndex <= year && inLayer(event.category));
  const afterwards = pack.events.filter((event) => event.yearIndex > year && inLayer(event.category));
  const frontier = [...known].sort((a, b) => b.yearIndex - a.yearIndex || a.title.localeCompare(b.title)).slice(0, 5);
  const readyItems = dodderHoney.filter((item) => evidenceReady(item, pack, year) && inLayer(item.category));
  const tally = questions
    .map((question) => {
      const count = readyItems.filter((item) => item.question === question.id).length;
      return count ? `${count} ${question.count}` : null;
    })
    .filter((line): line is string => !!line);

  function openFinding(item: HoneyItem) {
    const id = item.evidenceIds[0];
    if (!id) return;
    onPick(id);
    onOpen(id);
  }

  return (
    <div id="questions">
      <p className="compare-count">
        {tally.length > 0 ? tally.join("  ·  ") : "Nothing in this layer is on the record at this date."}
      </p>
      <section className="questions" aria-label="Compare 24 October 2011 with the latest evidence located">
        {questions.map((question) => {
          const items = readyItems.filter((item) => item.question === question.id);
          return (
            <article key={question.id} className="q-card q-card-fit">
              <h2 className="q-title">{question.title}</h2>
              <p className="q-kicker">{question.kicker}</p>
              {items.length === 0 ? (
                <p className="q-lead">Not on the record at this date.</p>
              ) : (
                <ul className="know-list">
                  {items.map((item) => {
                    const say = spoken[item.id];
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="know-card plain"
                          data-on={item.evidenceIds.includes(selectedId ?? "") ? "true" : "false"}
                          onClick={() => openFinding(item)}
                        >
                          <span>
                            <strong className="honey-lead">{say?.lead ?? item.title}</strong>
                            <span className="honey-because">{say?.because ?? item.body}</span>
                            <span className="honey-dates">{item.dates}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </article>
          );
        })}
      </section>
      <section className="questions" aria-label="What was known, and what was learned afterwards">
        <article className="q-card q-card-fit">
          <h2 className="q-title">{year === 0 ? "What did we know then?" : "On the record by this date"}</h2>
          <p className="q-kicker">
            {year === pack.timeline.ticks.length - 1
              ? "Every record in this pack. Each one keeps its own publication date."
              : `Only what was public by ${when}. Later documents are not used.`}
          </p>
          {known.length === 0 ? (
            <p className="q-lead">Nothing in this layer was on the record by this date.</p>
          ) : (
            <ul className="know-list">
              {known.map((event) => {
                const source = sourceById(pack, event.sourceId);
                return (
                  <li key={event.id}>
                    <button type="button" className="know-card plain" data-on={selectedId === event.id ? "true" : "false"} onClick={() => { onPick(event.id); onOpen(event.id); }}>
                      <span>
                        <strong>{event.title}</strong>
                        <span>
                          Event {event.eventDate} · Published {event.publicationDate}
                        </span>
                        <span>
                          {source?.publisher} · {event.reviewLabel}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </article>
        <article className="q-card q-card-fit">
          <h2 className="q-title">What we learned afterwards</h2>
          <p className="q-kicker">These records exist. They were not available at {when}.</p>
          {afterwards.length === 0 ? (
            <p className="q-lead">
              {year === pack.timeline.ticks.length - 1
                ? "You are at the latest evidence located. There is no later record in this pack."
                : `Nothing in this pack is dated after ${when}.`}
            </p>
          ) : (
            <ul className="know-list">
              {afterwards.map((event) => (
                <li key={event.id}>
                  <button type="button" className="know-card plain" onClick={() => { onPick(event.id); onOpen(event.id); }}>
                    <span>
                      <strong>{event.title}</strong>
                      <span>Published {event.publicationDate}</span>
                      <span>{event.reviewLabel}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="q-card q-card-fit">
          <h2 className="q-title">Latest evidence located</h2>
          <p className="q-kicker">{when}. Not a claim that the record is complete, or that nothing has happened since.</p>
          {frontier.length === 0 ? (
            <p className="q-lead">Nothing in this layer yet.</p>
          ) : (
            <ul className="know-list">
              {frontier.map((event) => (
                <li key={event.id}>
                  <button type="button" className="know-card plain" onClick={() => { onPick(event.id); onOpen(event.id); }}>
                    <span>
                      <strong>{event.title}</strong>
                      <span>{event.eventDate}</span>
                      <span>{event.reviewLabel}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
      <section className="questions">
        <article className="q-card q-card-fit">
          <h2 className="q-title">Need this for a place you’re responsible for?</h2>
          <p className="q-lead">
            BioVeracity reconstructs what changed, what was known at the time, what happened between, and the evidence connecting it.
          </p>
          <button type="button" className="btn-solid" onClick={onEnquire}>
            Build an Evidence Record →
          </button>
          <button type="button" className="btn-line" onClick={onEnquire}>
            Do this for my place →
          </button>
          <p className="q-kicker">
            Proposed commercial flow. This demonstrator holds the enquiry on this device. It is not sent. No address is shown.
          </p>
        </article>
      </section>
    </div>
  );
}

function KnownColumn({
  pack,
  events,
  selectedId,
  onPick,
  onOpen,
  onAll,
}: {
  pack: PlacePack;
  events: PlacePack["events"];
  selectedId: string | null;
  onPick: (id: string) => void;
  onOpen: (id: string) => void;
  onAll: () => void;
}) {
  return (
    <article className="q-card">
      <h2 className="q-title">What did we know then?</h2>
      <p className="q-kicker">Evidence on the record at this point. Later records do not rewrite it.</p>
      {events.length === 0 ? (
        <p className="q-lead">No illustrative evidence is visible yet.</p>
      ) : (
        <ul className="know-list">
          {events.map((event) => {
            const source = sourceById(pack, event.sourceId);
            return (
              <li key={event.id} className="know-row">
                <button
                  type="button"
                  className="know-card"
                  data-on={selectedId === event.id ? "true" : "false"}
                  onClick={() => onPick(event.id)}
                >
                  <img
                    src={pack.map.earlyImage}
                    alt=""
                    style={{
                      objectPosition: event.coordinates
                        ? `${event.coordinates.x}% ${event.coordinates.y}%`
                        : "center",
                    }}
                  />
                  <span>
                    <strong>{event.title}</strong>
                    <span>
                      {source?.publisher} · {source?.title} · {source?.locator}
                    </span>
                    <span>
                      Event {event.eventDate} · Published {event.publicationDate} · {event.reviewLabel}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  className="know-open"
                  aria-label={`Open illustrative source for ${event.title}`}
                  onClick={() => onOpen(event.id)}
                >
                  <ArrowUpRight size={16} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button type="button" className="q-foot" onClick={onAll}>
        Explore all sources →
      </button>
    </article>
  );
}
