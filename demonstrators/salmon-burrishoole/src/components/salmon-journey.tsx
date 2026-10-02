import { useState, type FormEvent } from "react";
import { CatchmentListen } from "@/components/catchment-listen";
import { cards, links, stages, type Stage, type When } from "@/data/salmon";

type Gate = null | "sources" | "report";

export function SalmonJourney() {
  const [stage, setStage] = useState<Stage>("stream");
  const [when, setWhen] = useState<When>("then");
  const [open, setOpen] = useState<string | null>(null);
  const [honey, setHoney] = useState(false);
  const [gate, setGate] = useState<Gate>(null);
  const [preview, setPreview] = useState(false);
  const [notice, setNotice] = useState("");
  const [place, setPlace] = useState("");
  const [asked, setAsked] = useState("");

  const here = stages.find((item) => item.id === stage) ?? stages[0];
  const visible = cards.filter((card) => card.stage === stage && (when === "latest" || card.when === "then"));

  function askDeeper(next: Gate) {
    if (!preview) {
      setGate(next);
      return;
    }
    setOpen("deeper");
  }

  function requestPlace(event: FormEvent) {
    event.preventDefault();
    const name = place.trim();
    if (!name) return;
    setAsked(name);
    setNotice("not-sent");
  }

  return (
    <main className="sal">
      <p className="sal-kicker">13 May 2022 · an article, not a verdict</p>
      <h1>Where did Ireland’s salmon go?</h1>
      <p className="sal-dek">One man’s proposition. Decades of evidence. Explore it yourself.</p>

      <section className="sal-author">
        <p>
          Nicholas Grubb, published by Salmon Watch Ireland. He writes from a life on the Tar, a tributary of the Suir,
          and from Dromana on the Munster Blackwater. Salmon Watch Ireland called it a point of view. They agreed
          especially about the banks. They did not say every proposition was theirs.
        </p>
        <p className="sal-note">No partnership is claimed. Nobody was contacted.</p>
      </section>

      <div className="sal-when" role="group" aria-label="What could be known">
        <button type="button" aria-pressed={when === "then"} onClick={() => setWhen("then")}>
          Then · 13 May 2022
        </button>
        <button type="button" aria-pressed={when === "latest"} onClick={() => setWhen("latest")}>
          Latest evidence
        </button>
      </div>
      <p className="sal-when-note">
        {when === "then"
          ? "Only what was published by the day of his article. Later reports stay out."
          : "His article stays. Reports published after that day are added. They do not rewrite what he wrote."}
      </p>

      <ol className="sal-path">
        {stages.map((item, index) => (
          <li key={item.id}>
            <button type="button" aria-current={item.id === stage} onClick={() => setStage(item.id)}>
              <i>{index + 1}</i>
              {item.place}
            </button>
          </li>
        ))}
      </ol>

      <h2>{here.ask}</h2>

      <ul className="sal-cards">
        {visible.map((card) => (
          <li key={card.id}>
            <button type="button" aria-expanded={open === card.id} onClick={() => setOpen(open === card.id ? null : card.id)}>
              <span>{card.kicker}</span>
              {card.text}
            </button>
            {open === card.id ? (
              <div className="sal-more">
                <p>{card.limit}</p>
                <p>{card.published}</p>
                <a href={card.url} target="_blank" rel="noreferrer">
                  {card.source}
                </a>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {stage === "stream" ? (
        <p className="sal-block">
          This comparison is blocked. The Castle Grace tailrace is one length of water, in his words. It is not the
          national stock.
        </p>
      ) : null}
      {stage === "estuary" && when === "latest" ? (
        <p className="sal-block">
          This comparison is blocked. A national figure for estuaries is not his view of the Blackwater tideway. Neither
          is a count of salmon.
        </p>
      ) : null}
      {stage === "return" && when === "latest" ? (
        <p className="sal-block">
          This comparison is blocked. Forty-eight rivers with a surplus, in the January 2022 advice, and 28 per cent of
          144 stocks above the limit at a 75 per cent chance, in December 2025, are not the same test. They are not
          drawn as a fall.
        </p>
      ) : null}
      {stage === "ocean" && when === "latest" ? (
        <p className="sal-conflict">
          Two sources. Same worry. Different weight. He calls fish farming the most important cause. The later national
          list names it as one priority, beside pollution and habitat, under a change in the ocean. This page does not
          choose.
        </p>
      ) : null}

      <button type="button" className="sal-quiet" onClick={() => setHoney((value) => !value)}>
        {honey ? "Hide what connects" : "Show me what connects"}
      </button>
      {honey ? (
        <ul className="sal-honey">
          {links.map((link) => (
            <li key={link.from}>
              <strong>
                {link.from} → {link.to}
              </strong>
              <em>{link.status}</em>
              <p>{link.note}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <section className="sal-end">
        <p>Nicholas asked where the salmon went.</p>
        <p>The evidence doesn’t give one simple answer.</p>
        <p>It can help us ask a better question.</p>
        <button type="button" className="sal-go" onClick={() => askDeeper("sources")}>
          Explore every source
        </button>
        <button type="button" className="sal-line" onClick={() => askDeeper("report")}>
          Open the evidence record
        </button>
      </section>

      <CatchmentListen />

      <form className="sal-place" onSubmit={requestPlace}>
        <h2>What should BioVeracity investigate next?</h2>
        <label>
          River, catchment or place
          <input value={place} onChange={(event) => setPlace(event.target.value)} placeholder="A river" />
        </label>
        <button type="submit">Request this place</button>
        {asked ? (
          <p>
            The {asked} isn’t in BioVeracity yet. Request the {asked}. Nothing was sent.
          </p>
        ) : null}
      </form>

      <p className="sal-sign">BioVeracity. A place remembers.</p>

      {preview && open === "deeper" ? (
        <section className="sal-record">
          <p>Preview only. A 14-day access has not started. No report was generated.</p>
          <ul>
            {cards.map((card) => (
              <li key={card.id}>
                <span>{card.when === "then" ? "By 13 May 2022" : "After 13 May 2022"}</span>
                {card.text}
                <small>{card.limit}</small>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {gate ? (
        <div className="sal-gate" role="dialog" aria-modal="true" aria-labelledby="sal-gate-title">
          <div>
            <h2 id="sal-gate-title">Want to follow the evidence?</h2>
            <p>
              Create a free BioVeracity account and get 14 days’ access to the complete evidence record, reports and
              source-linked investigation tools.
            </p>
            <p className="sal-note">
              Prototype only. This button does not create an account, start a trial, send an email, or save what you
              typed.
            </p>
            <button
              type="button"
              className="sal-go"
              onClick={() => {
                setNotice("no-account");
              }}
            >
              Start 14 days free
            </button>
            <button type="button" className="sal-line" onClick={() => setNotice("no-account")}>
              Sign in
            </button>
            {notice === "no-account" ? (
              <p>No account was created. No trial started. Nothing was sent. You can keep reading this preview.</p>
            ) : null}
            <button
              type="button"
              className="sal-quiet"
              onClick={() => {
                setPreview(true);
                setGate(null);
                setOpen("deeper");
              }}
            >
              Keep reading this preview
            </button>
            <button type="button" className="sal-quiet" onClick={() => setGate(null)}>
              Back
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
