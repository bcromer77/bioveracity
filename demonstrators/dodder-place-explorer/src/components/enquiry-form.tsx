import { useState, type FormEvent } from "react";
import { useDemo } from "@/state/demo";

type Fields = {
  name: string;
  email: string;
  organisation: string;
  role: string;
  body: string;
  document: string;
  place: string;
  understand: string;
  accepted: boolean;
};

const empty: Fields = {
  name: "",
  email: "",
  organisation: "",
  role: "",
  body: "",
  document: "",
  place: "",
  understand: "",
  accepted: false,
};

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function EnquiryForm() {
  const kind = useDemo((s) => s.enquiryKind);
  const openEnquiry = useDemo((s) => s.openEnquiry);
  const setLens = useDemo((s) => s.setLens);
  const [fields, setFields] = useState<Fields>(empty);
  const [errors, setErrors] = useState<string[]>([]);
  const [held, setHeld] = useState(false);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const next: string[] = [];
    if (fields.name.trim().length < 2) next.push("Add your name.");
    if (!validEmail(fields.email.trim())) next.push("Add a work email so a reply would have somewhere to go.");
    if (fields.organisation.trim().length < 2) next.push("Add your organisation.");
    if (fields.body.trim().length < 8) {
      next.push(kind === "disclosure" ? "Add the disclosure or target." : "Name the place.");
    }
    if (!fields.accepted) next.push("Confirm what this enquiry is, and what it is not.");
    setErrors(next);
    if (next.length) return;
    const entry = {
      kind,
      ...fields,
      email: fields.email.trim(),
      heldAt: new Date().toISOString(),
      transmitted: false,
    };
    try {
      localStorage.setItem("bv-enquiry-demo", JSON.stringify(entry));
    } catch {
      /* Demonstration only. Storage may be unavailable. */
    }
    setHeld(true);
  }

  if (held) {
    return (
      <div className="grid gap-4">
        <p className="proposed">Private enquiry</p>
        <h2 className="font-serif text-4xl leading-tight text-balance">Held in this demonstration.</h2>
        <p className="text-pretty text-ink-soft">
          Nothing was transmitted. No internal address is used. On the live service, an enquiry like this
          would be reviewed privately by the evidence team and would not be published.
        </p>
        <p className="text-pretty text-ink-soft">
          It would not be a compliance opinion, an audit, or a regulatory determination.
        </p>
        <button type="button" className="btn-primary" onClick={() => setLens("landscape")}>
          <span>Return to the place</span>
          <span aria-hidden="true">→</span>
        </button>
      </div>
    );
  }

  const disclosure = kind === "disclosure";

  return (
    <form className="grid gap-4" onSubmit={submit} noValidate>
      <div className="flex gap-4">
        <button type="button" className="btn-quiet" onClick={() => setLens("time")}>
          Back
        </button>
        <button
          type="button"
          className="btn-quiet"
          onClick={() => openEnquiry(disclosure ? "place" : "disclosure")}
        >
          {disclosure ? "I meant a place" : "I meant a disclosure"}
        </button>
      </div>
      <p className="proposed">Private enquiry</p>
      <h2 className="font-serif text-4xl leading-tight text-balance">
        {disclosure ? "Show us one disclosure" : "Show us one place"}
      </h2>
      <p className="text-pretty text-ink-soft">
        {disclosure
          ? "Send us one sustainability disclosure or target. See what its evidence record could look like."
          : "Or the place you are responsible for. The same record starts from the place instead of the sentence."}
      </p>
      {errors.length ? (
        <ul className="grid gap-1">
          {errors.map((error) => (
            <li key={error} className="form-error">
              {error}
            </li>
          ))}
        </ul>
      ) : null}
      <label className="grid gap-1 text-sm">
        {disclosure ? "The disclosure or target" : "The place"}
        <textarea
          className="field"
          value={fields.body}
          onChange={(event) => set("body", event.target.value)}
          placeholder={
            disclosure
              ? "Paste one paragraph, or describe one target."
              : "A site, a catchment, a wood. A precise address is not required."
          }
        />
      </label>
      <p className="text-sm text-muted">
        Documents are not uploaded in this proposed interface. Paste or describe.
      </p>
      {disclosure ? (
        <label className="grid gap-1 text-sm">
          Where it appears
          <input
            className="field"
            value={fields.document}
            onChange={(event) => set("document", event.target.value)}
            placeholder="Document and year, if you have them"
          />
        </label>
      ) : null}
      <label className="grid gap-1 text-sm">
        {disclosure ? "The place underneath it" : "Where it is"}
        <input
          className="field"
          value={fields.place}
          onChange={(event) => set("place", event.target.value)}
          placeholder="Optional. Region is enough."
        />
      </label>
      <label className="grid gap-1 text-sm">
        What you want to understand
        <input
          className="field"
          value={fields.understand}
          onChange={(event) => set("understand", event.target.value)}
          placeholder="Optional"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Your name
        <input className="field" value={fields.name} onChange={(event) => set("name", event.target.value)} autoComplete="name" />
      </label>
      <label className="grid gap-1 text-sm">
        Work email
        <input
          className="field"
          type="email"
          value={fields.email}
          onChange={(event) => set("email", event.target.value)}
          autoComplete="email"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Organisation
        <input
          className="field"
          value={fields.organisation}
          onChange={(event) => set("organisation", event.target.value)}
          autoComplete="organization"
        />
      </label>
      <label className="grid gap-1 text-sm">
        Role
        <input
          className="field"
          value={fields.role}
          onChange={(event) => set("role", event.target.value)}
          placeholder="Optional"
          autoComplete="organization-title"
        />
      </label>
      <label className="flex items-start gap-3 text-sm text-pretty">
        <input
          type="checkbox"
          checked={fields.accepted}
          onChange={(event) => set("accepted", event.target.checked)}
        />
        <span>
          I understand this is an evidence enquiry. It is not a compliance opinion, an audit, or a regulatory
          determination.
        </span>
      </label>
      <button type="submit" className="btn-primary">
        <span>Hold this enquiry</span>
        <span aria-hidden="true">→</span>
      </button>
      <p className="text-sm text-pretty text-muted">
        Private to this demonstration. Not published. Not transmitted. No internal address is shown. There is
        no account and no fee.
      </p>
    </form>
  );
}
