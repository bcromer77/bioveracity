import { useEffect, useRef, useState } from "react";
import { records, ticks, type MemRecord } from "@/data/cherry-hinton";

type Point = "works" | "measure" | "bed" | "clear";
type View = "plaque" | "visitor" | "record";

const points: { id: Point; stand: string; ask: string }[] = [
  { id: "works", stand: "At the works", ask: "What changed here?" },
  { id: "measure", stand: "At a monitoring point", ask: "What are scientists measuring here?" },
  { id: "bed", stand: "At the gravel", ask: "Why does the riverbed matter?" },
  { id: "clear", stand: "Where it looks clear", ask: "Can clean-looking water still have problems?" },
];

const lineKinds = ["Expected", "Rule", "Measured", "Works", "Latest"];

const beats: { yearIndex: number; line: string; detail: string; ids: string[] }[] = [
  {
    yearIndex: 0,
    line: "A cleaner bed was expected to bring bullhead and some insects back.",
    detail: "The same note said the channel works would not, by themselves, deal with the nutrients arriving from outside.",
    ids: ["oct-predict", "oct-limit", "oct-follow"],
  },
  {
    yearIndex: 1,
    line: "Before the digging, a change in the wildlife was ruled out as proof on its own.",
    detail: "Measurements were there to reduce uncertainty, not to claim a cause.",
    ids: ["nov-rule"],
  },
  {
    yearIndex: 2,
    line: "Nitrate was already 8 to 13 milligrams a litre.",
    detail: "Downstream phosphate reached 0.17 in mid-November. The project thought something extra was getting in. It did not say what.",
    ids: ["dec-nitrate", "dec-phos", "dec-read"],
  },
  {
    yearIndex: 3,
    line: "The works started. So did a concern about the water voles, and a doubt about the old gravel.",
    detail: "Coarse gravel that had been put in to help was now described, in a preliminary finding, as something that can smother the bed.",
    ids: ["mar-works", "mar-concern", "mar-survey", "mar-reading", "mar-gravel"],
  },
  {
    yearIndex: 4,
    line: "Nitrate was still about 13. No later survey of the plants or insects was found.",
    detail: "No document here says the works caused a recovery.",
    ids: ["jun-nitrate", "jun-oxygen", "sep-account", "gaps"],
  },
];

const verdicts = [
  {
    title: "A cleaner bed was expected to bring some of the wildlife back.",
    body: "The same update said that would not deal with the nitrate and phosphate coming in from outside.",
  },
  {
    title: "The rule was written down before the digging.",
    body: "A change in the wildlife, on its own, would not prove that the works had worked.",
  },
  {
    title: "The nitrate was already high.",
    body: "Generally 8 to 13 milligrams a litre. One downstream phosphate reading reached 0.17.",
  },
  {
    title: "The works went in. The old gravel was no longer simply a help.",
    body: "Water voles were already recorded. A first reading said coarse gravel can smother this kind of bed. The full study was not in hand.",
  },
  {
    title: "The nitrate had not come down.",
    body: "Still about 13 milligrams a litre, against a chalk-stream figure under 1. One oxygen reading collapsed. The report would not say whether that was the brook or the meter.",
  },
  {
    title: "The works are in. A recovery has not been reported.",
    body: "The council was still citing nitrate around 13, and said this water cannot be judged by looking at it.",
  },
];

function standing(point: Point, year: number) {
  if (point === "works") {
    return year >= 3
      ? "You are standing beside Cherry Hinton Brook, on the stretch where work began in March 2026."
      : "You are on the stretch where the works were later reported. At this date, the digging had not been published.";
  }
  if (point === "measure") {
    return year >= 4
      ? "Scientists were measuring nitrate here. It was still about 13 milligrams a litre. Their chalk-stream figure is under 1."
      : year >= 2
        ? "The published measurements already had nitrate at 8 to 13 milligrams a litre."
        : "The nitrate figures for this brook had not yet appeared in the updates read here.";
  }
  if (point === "bed") {
    return year >= 3
      ? "Gravel put in earlier, to help the bed, was later described as something that can smother it. That reading was preliminary."
      : "The later reading of that gravel had not been published yet.";
  }
  return year >= 5
    ? "The council said this water cannot be judged by looking at it. Nitrate was still about 13."
    : year >= 2
      ? "Nitrate was already high. Nothing in the record so far says the brook looked dirty."
      : "The later warning, that clear water is not a clean bill of health, had not been published.";
}

export function ScienceMemory() {
  const last = ticks.length - 1;
  const [year, setYear] = useState(last);
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [view, setView] = useState<View>("plaque");
  const [point, setPoint] = useState<Point>("works");
  const timer = useRef<number | null>(null);

  function stop() {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setPlaying(false);
  }

  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
  }, []);

  function play() {
    if (playing) {
      stop();
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setYear(year === 0 ? last : 0);
      return;
    }
    let step = year >= last ? 0 : year;
    setYear(step);
    setOpen(null);
    setPlaying(true);
    timer.current = window.setInterval(() => {
      step += 1;
      setYear(step);
      if (step >= last) stop();
    }, 1100);
  }

  function enter(next: Point) {
    setPoint(next);
    setView("visitor");
    setYear(last);
    setOpen(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const visible = beats.filter((beat) => beat.yearIndex <= year);
  const line = verdicts[year];
  const here = points.find((item) => item.id === point) ?? points[0];

  return (
    <main className="mem">
      <p className="mem-key">
        <span data-swatch="works">Works</span>
        <span data-swatch="measure">Measurement</span>
        <span data-swatch="bed">Gravel</span>
        <span data-swatch="clear">Clear water</span>
        <span className="mem-key-note">Colour is not a condition. Green is the works. It does not mean good, and it does not mean recovered.</span>
      </p>
      {view === "plaque" ? (
        <Plaque point={point} onPoint={setPoint} onEnter={() => enter(point)} />
      ) : null}

      {view === "visitor" ? (
        <>
          <header className="mem-stand" data-point={point}>
            <p className="mem-kicker">Beside the brook</p>
            <h1>{here.ask}</h1>
            <p className="mem-dek">{standing(point, year)}</p>
          </header>
          <div className="mem-points">
            {points.map((item) => (
              <button key={item.id} type="button" data-point={item.id} className={item.id === point ? "is-on" : ""} onClick={() => setPoint(item.id)}>
                {item.stand}
              </button>
            ))}
          </div>
          <Time year={year} last={last} playing={playing} play={play} stop={stop} setYear={setYear} />
          <Lines year={year} visible={visible} open={open} setOpen={setOpen} />
          {year >= 4 ? (
            <p className="mem-early">
              Did it work? It is too early for the evidence reviewed here to say.
            </p>
          ) : null}
          <button type="button" className="mem-depth" onClick={() => setView("record")}>
            See what scientists are watching
          </button>
          <button type="button" className="mem-back" onClick={() => setView("plaque")}>
            Back to the plaque
          </button>
        </>
      ) : null}

      {view === "record" ? (
        <>
          <p className="mem-kicker">The same record</p>
          <h1>Cherry Hinton Brook</h1>
          <h2>{line.title}</h2>
          <p className="mem-dek">{line.body}</p>
          <Time year={year} last={last} playing={playing} play={play} stop={stop} setYear={setYear} />
          <Lines year={year} visible={visible} open={open} setOpen={setOpen} />
          {year >= 4 ? <Refusal /> : null}
          <button type="button" className="mem-depth" onClick={() => setView("visitor")}>
            Back beside the brook
          </button>
        </>
      ) : null}

      <footer className="mem-foot">
        <p>
          One record for one brook, read on 2 October 2026. Council updates, a university laboratory report and a local
          newspaper schedule. Not a second dataset for the bank. Not a public upload system. A later measurement would
          be added here. The plaque would stay. None has been installed.
        </p>
      </footer>
    </main>
  );
}

function Plaque({
  point,
  onPoint,
  onEnter,
}: {
  point: Point;
  onPoint: (point: Point) => void;
  onEnter: () => void;
}) {
  return (
    <>
      <p className="mem-kicker">Illustrative. Not a working code. No plaque has been installed.</p>
      <h1>Imagine this beside the works.</h1>
      <article className="mem-plaque">
        <span className="mem-mark" aria-hidden="true" />
        <p>What happened here?</p>
        <h2>Cherry Hinton Brook</h2>
        <p className="mem-plaque-sub">The works, near Coldham’s Lane. March 2026.</p>
        <p>This brook is being restored. Follow what was expected, what was done, what was measured next, and what is still unknown.</p>
      </article>
      <div className="mem-points">
        {points.map((item) => (
          <button key={item.id} type="button" data-point={item.id} className={item.id === point ? "is-on" : ""} onClick={() => onPoint(item.id)}>
            <strong>{item.ask}</strong>
            <span>{item.stand}</span>
          </button>
        ))}
      </div>
      <button type="button" className="mem-depth" onClick={onEnter}>
        Preview the visitor experience
      </button>
      <p className="mem-note">
        Four places to stand. One record. The documents do not give a surveyed spot for a plaque, so these standpoints
        are illustrative.
      </p>
    </>
  );
}

function Time({
  year,
  last,
  playing,
  play,
  stop,
  setYear,
}: {
  year: number;
  last: number;
  playing: boolean;
  play: () => void;
  stop: () => void;
  setYear: (year: number) => void;
}) {
  return (
    <div className="mem-time">
      <div className="mem-ends">
        <span className={year === 0 ? "is-now" : ""}>Before the works</span>
        <button type="button" className="mem-play" onClick={play}>
          {playing ? "Pause" : year >= last ? "Play again" : "Play"}
        </button>
        <span className={year === last ? "is-now" : ""}>Latest record</span>
      </div>
      <input
        type="range"
        min={0}
        max={last}
        step={1}
        value={year}
        aria-valuetext={ticks[year].long}
        onChange={(event) => {
          stop();
          setYear(Number(event.target.value));
        }}
      />
      <ol>
        {ticks.map((tick, index) => (
          <li key={tick.short}>
            <button
              type="button"
              className={index === year ? "is-now" : ""}
              onClick={() => {
                stop();
                setYear(index);
              }}
            >
              {tick.short}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Lines({
  year,
  visible,
  open,
  setOpen,
}: {
  year: number;
  visible: typeof beats;
  open: number | null;
  setOpen: (index: number | null) => void;
}) {
  return (
    <ol className="mem-lines">
      {visible.map((beat, index) => {
        const quiet = index < visible.length - 1;
        const expanded = open === index;
        const docs = beat.ids
          .map((id) => records.find((record) => record.id === id))
          .filter((record): record is MemRecord => !!record && record.yearIndex <= year);
        return (
          <li key={beat.line} className={quiet ? "is-quiet" : "is-now"} data-beat={index}>
            <button type="button" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : index)}>
              <span className="mem-markcol">
                <b>{index + 1}</b>
                <i>{lineKinds[index]}</i>
              </span>
              {beat.line}
            </button>
            {expanded ? (
              <div className="mem-open">
                <p>{beat.detail}</p>
                {docs.map((record) => (
                  <article key={record.id}>
                    <p className="mem-kicker">{record.label}</p>
                    <p>{record.plain}</p>
                    {record.id === "gaps" ? null : <blockquote>{record.passage}</blockquote>}
                    <p>{record.published}</p>
                    <p className="mem-limit">{record.limitation}</p>
                    <a href={record.url} target="_blank" rel="noreferrer">
                      {record.id === "gaps" ? "Project page" : record.document}
                    </a>
                  </article>
                ))}
              </div>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function Refusal() {
  return (
    <figure className="mem-refuse">
      <figcaption>Not a fall</figcaption>
      <div>
        <strong>0.17</strong>
        <span>mg/L phosphate, downstream, mid-November 2025</span>
      </div>
      <div>
        <strong>often under 0.05</strong>
        <span>January to March 2026. Cherry Hinton grouped with two other brooks. Not a single figure.</span>
      </div>
      <p>Different months. Not drawn as a line.</p>
    </figure>
  );
}
