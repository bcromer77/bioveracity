/**
 * Illustrative sample seed for the investigative workspace canvas.
 *
 * IMPORTANT: every record below is a SAMPLE, provided so a new workspace opens
 * with a worked example (the Slaney Valley / Enniscorthy site review) instead of a
 * blank screen. It is clearly labelled as illustrative in the UI and must never be
 * presented as authoritative live agency data. Real evidence is added by the user
 * through the private evidence backend (import, review, export). Coordinates are
 * approximate and for map navigation only.
 *
 * Kept free of React/DOM imports so it can be shared by the client and by tests.
 */

export const SAMPLE_LOCATION = {
  caseTitle: 'Slaney Valley site review',
  place: 'Enniscorthy, Co. Wexford',
  county: 'Wexford',
  lat: 52.5017,
  lng: -6.5658,
  zoom: 13,
};

/** "Your evidence" — sample sources, mix of document and audio. */
export const SAMPLE_EVIDENCE = [
  {
    id: 'sample-ecology-report',
    kind: 'document',
    name: 'Slaney Valley ecological appraisal.pdf',
    meta: '18 pages · PDF · imported for review',
    preview: 'No protected species recorded within 500m of the proposed works. Survey undertaken outside the optimal season.',
    locator: 'p.18',
  },
  {
    id: 'sample-resident-note',
    kind: 'document',
    name: 'Resident objection — flood history.txt',
    meta: 'Text note · imported for review',
    preview: 'Field flooded twice in the last decade; the lower paddock holds water into spring.',
    locator: 'para 3',
  },
  {
    id: 'sample-site-audio',
    kind: 'audio',
    name: 'Site walkover voice note.m4a',
    meta: 'Audio · 02:14 · retained, not auto-transcribed',
    preview: 'Audio is kept as the original source. It is not sent to an AI or transcribed automatically — add a text note with the relevant quote to place it on the timeline.',
    locator: '00:00–02:14',
  },
];

/** "Investigation progress" checklist — illustrative status of a review. */
export const SAMPLE_PROGRESS = [
  { id: 'read', label: 'Document read', done: true },
  { id: 'species', label: 'Species references extracted', done: true },
  { id: 'water', label: 'Water records compared', done: false },
  { id: 'sensitive', label: 'Sensitive locations generalised', done: true },
];

/** "3 things to review" — sample insight cards. */
export const SAMPLE_REVIEW_CARDS = [
  {
    id: 'discrepancy',
    kind: 'Discrepancy',
    title: 'Survey says no species; objection cites otters',
    detail: 'The ecological appraisal records no protected species within 500m, but a resident objection describes otter activity on the river bank. Compare both sources before relying on either.',
    prompt: 'Compare the species statement in the appraisal with the resident objection.',
  },
  {
    id: 'water',
    kind: 'Water status',
    title: 'River water-quality status not yet confirmed',
    detail: 'No reviewed EPA WFD status is attached for the nearest river water body. The EPA layer is not auto-filled — add it from a reviewed source.',
    prompt: 'What is the WFD status of the nearest river water body, and what source confirms it?',
  },
  {
    id: 'timing',
    kind: 'Survey timing',
    title: 'Survey undertaken outside optimal season',
    detail: 'The appraisal notes the survey was outside the optimal season, which may limit the confidence of a “no species” finding. Flag this before it is treated as conclusive.',
    prompt: 'Does the survey timing weaken the “no protected species” conclusion?',
  },
];

/** Bottom source-citation preview shown under the map. */
export const SAMPLE_CITATION = {
  quote: 'No protected species recorded within 500m.',
  locator: 'Slaney Valley ecological appraisal — p.18',
};

/** Chronological timeline rail. */
export const SAMPLE_TIMELINE = [
  { id: 'survey', label: 'Ecological survey', date: '2024-08', detail: 'Walkover survey undertaken outside optimal season.' },
  { id: 'flood', label: 'Flood record', date: '2024-11', detail: 'Resident reports lower paddock flooding after heavy rain.' },
  { id: 'objection', label: 'Resident objection', date: '2025-01', detail: 'Objection lodged citing otter activity and flood history.' },
  { id: 'appraisal', label: 'Site appraisal', date: '2025-03', detail: 'Ecological appraisal finalised: no protected species within 500m.' },
];

/** "Compare source passages" — two sample passages set side by side. */
export const SAMPLE_COMPARE = {
  left: {
    source: 'Ecological appraisal — p.18',
    text: 'No protected species were recorded within 500m of the proposed works during the survey period.',
  },
  right: {
    source: 'Resident objection — para 3',
    text: 'Otters are regularly seen on the river bank below the site, and the field has flooded twice in the last decade.',
  },
};

/** Audit-pack preview card contents. */
export const SAMPLE_AUDIT_PACK = {
  title: 'Audit pack',
  summary: 'A reviewed PDF plus a source manifest of every accepted entry, ready to share.',
  includes: [
    'Accepted timeline entries with exact supporting quotes',
    'Source identity (SHA-256) for each original document',
    'Reviewer, date and rationale for every accepted entry',
  ],
  excludes: 'Draft and rejected entries, and the original files themselves, are excluded.',
};
