import { useState } from "react";
import {
  catchmentAsks,
  families,
  overlap,
  years,
  type FamilyId,
  type YearStop,
} from "@/data/burrishoole";

function speaks(id: FamilyId, year: YearStop) {
  const family = families.find((item) => item.id === id);
  if (!family) return false;
  if (family.line === "none") return true;
  if (family.from === undefined || family.to === undefined) return false;
  return year >= family.from && year <= family.to;
}

export function CatchmentListen() {
  const [listening, setListening] = useState(false);
  const [year, setYear] = useState<YearStop>(1970);
  const [on, setOn] = useState<FamilyId[]>(["salmon"]);
  const [open, setOpen] = useState<FamilyId | null>(null);
  const [sideways, setSideways] = useState(false);
  const [question, setQuestion] = useState<string | null>(null);

  function add(id: FamilyId) {
    setOn((current) => (current.includes(id) ? current : [...current, id]));
  }

  const active = families.filter((family) => on.includes(family.id));
  const next = families.find((family) => !on.includes(family.id) && family.optional);

  return (
    <section className="sal-count">
      <p className="sal-kicker">One river has been counting</p>
      <h2>Burrishoole is not Ireland.</h2>
      <p>
        At Burrishoole, in County Mayo, the Marine Institute has counted the salmon that pass the traps between Lough
        Feeagh and Lough Furnace. The count runs from 1970. It can show what happened in that system. It cannot stand
        for the country.
      </p>
      <button type="button" className="sal-go" onClick={() => setListening(true)}>
        Listen to the catchment
      </button>

      {listening ? (
        <div className="sal-score">
          <label className="sal-year">
            Move through the years that can speak
            <input
              type="range"
              min={0}
              max={years.length - 1}
              step={1}
              value={years.indexOf(year)}
              onChange={(event) => setYear(years[Number(event.target.value)])}
            />
            <strong>{year}</strong>
          </label>

          <ul className="sal-staves">
            {active.map((family) => {
              const live = speaks(family.id, year) && family.line !== "none";
              return (
                <li key={family.id} data-class={family.klass}>
                  <button type="button" onClick={() => setOpen(open === family.id ? null : family.id)}>
                    <span>{family.name}</span>
                    <i>{family.klass}</i>
                    <b data-line={family.line} data-live={live ? "yes" : "no"}>
                      {family.line === "none"
                        ? "No line"
                        : family.line === "mark"
                          ? live
                            ? "A mark, not a line"
                            : "Not in this year"
                          : live
                            ? "Counted through these years"
                            : family.id === "invertebrates" && year > 2018
                              ? "Published digital series ends"
                              : "Not in this year"}
                    </b>
                  </button>
                  {open === family.id ? (
                    <div className="sal-why">
                      <p>{family.speak}</p>
                      <p>{family.why}</p>
                      <p>Retrieved {family.retrieved}. Nothing here was fetched live.</p>
                      <a href={family.url} target="_blank" rel="noreferrer">
                        {family.source}
                      </a>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>

          {next ? (
            <button type="button" className="sal-line" onClick={() => add(next.id)}>
              Add {next.name.toLowerCase()}
            </button>
          ) : null}

          {year > 2018 && on.includes("invertebrates") ? (
            <p className="sal-block">Monitoring of the published digital series ends. The insects are not shown as gone.</p>
          ) : null}

          <button type="button" className="sal-go" onClick={() => setSideways(true)}>
            What else changed?
          </button>
          {sideways ? <Side year={year} on={on} /> : null}

          <h3>Ask this catchment</h3>
          <div className="sal-ask">
            {catchmentAsks.map((item) => (
              <button key={item.id} type="button" aria-pressed={question === item.id} onClick={() => setQuestion(item.id)}>
                {item.q}
              </button>
            ))}
          </div>
          {question ? <Answer id={question} year={year} /> : null}
        </div>
      ) : null}
    </section>
  );
}

function Side({ year, on }: { year: YearStop; on: FamilyId[] }) {
  const both = on.includes("salmon") && on.includes("invertebrates") && year >= 2007 && year <= 2018;
  const weather = on.includes("weather");
  return (
    <div className="sal-side">
      <p className="sal-kicker">Around {year}</p>
      {both ? (
        <p>
          <strong>Potential coincidence.</strong> The census is running, and the published invertebrate series is open.
          They are not the same kind of record, and they were not taken on the same day. {overlap}
        </p>
      ) : (
        <p>
          <strong>Change located</strong> in the salmon census, which is still this river only.
          {year < 2007 ? " The invertebrate series opened here has not started." : ""}
          {year > 2018 ? " The published invertebrate series has ended. That is not a collapse of the insects." : ""}
        </p>
      )}
      {weather ? (
        <p>
          <strong>Comparison blocked.</strong> Weather at a station outside the catchment is not the temperature of
          these lakes.
        </p>
      ) : null}
      {on.includes("waste") ? (
        <p>
          <strong>Comparison blocked.</strong> A works on a list is not a discharge in this year.
        </p>
      ) : null}
      {on.includes("barriers") ? (
        <p>
          <strong>Unresolved.</strong> A barrier can be mapped. The map does not say it caused a change in the fish.
        </p>
      ) : null}
      {on.includes("bats") || on.includes("deer") || on.includes("birds") ? (
        <p>
          <strong>Evidence not located in sources reviewed.</strong> No abundance line is drawn for bats, deer or
          starlings at Burrishoole.
        </p>
      ) : null}
      <p className="sal-note">{overlap}</p>
    </div>
  );
}

function Answer({ id, year }: { id: string; year: YearStop }) {
  const knownLater = year >= 2025;
  const text: Record<string, string> = {
    fell: "The national stock reports describe fewer adults coming back from the sea, and say the reason is poorly understood. Burrishoole can calculate survival for its own traps. Those yearly figures were not opened on this page, so no fall is drawn for this river.",
    same:
      year >= 2007 && year <= 2018
        ? "In these years the census and the published invertebrate series can both speak. They do not speak on the same day, or in the same units. The buoy archive’s start was not opened, so it is not placed on this year."
        : "In this year the census can speak. The other opened series cannot all speak with it. Sharing a year is not the same as being measured together.",
    warm: "No temperature series for these lakes was opened. A weather station outside the catchment cannot answer for the water. Comparison blocked.",
    invert:
      "A national invertebrate score exists for 2007 to 2018. The values at Burrishoole’s own stations were not opened. No improvement or decline is stated.",
    bats: "A comparable Burrishoole bat-activity series was not established in the evidence reviewed. Fewer occurrence records would not be enough to conclude that there were fewer bats. The Daubenton’s survey counts passes on a walked kilometre, in August, and only where that walk was repeated.",
    barriers:
      "No. A barrier inventory can show a structure. It cannot show that the structure caused the change in salmon. Comparison blocked.",
    missing:
      "Not located in the sources reviewed: a year-by-year abstraction series, a record of spills as distinct from a list of works, the yearly trap table itself, a Burrishoole bat series, a deer abundance series, and a starling series.",
    stopped:
      "The published digital invertebrate series stops in 2018. That label is the end of the series opened here, not the end of the animals, and not the end of EPA monitoring. The salmon census is not shown as stopped.",
    now: knownLater
      ? "By December 2025 the national advice could say that 28 per cent of 144 stocks were above their limit, on that test. In 1970 that sentence did not exist. It is still a national test. It is not a Burrishoole count."
      : "The later national percentage is not shown. It was published after this year. What this year has is the census, and only the other series whose dates include it.",
  };
  return (
    <div className="sal-answer">
      <p>{text[id]}</p>
      <p className="sal-note">Why this was said: open a line above. Each one names its source. Nothing was asked of a general search.</p>
    </div>
  );
}
