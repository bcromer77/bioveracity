# BioVeracity Regional Intelligence — CSO + UK Place Evidence

## Purpose

Build a **saleable, source-linked regional intelligence layer** for BioVeracity that combines official statistical context with environmental, planning, biodiversity and place evidence.

The immediate demonstration should make a place such as **Kerry / Tralee Bay Wetlands** intelligible through time without implying that correlation is causation. The same architecture must be reusable across UK counties, councils, wetlands, protected landscapes, catchments, destination areas and infrastructure geographies.

This is **not** permission to ingest every dataset or to create an opaque place score. It is a bounded sales-readiness implementation.

## Commercial outcome

A prospect should be able to open one place/project and answer:

1. What has changed here over time?
2. Which official sources show those changes?
3. Which environmental/ecological/planning signals changed in the same period?
4. Where geographically did the changes occur?
5. What is observation versus regulator finding versus BioVeracity analysis?
6. Can every chart point/event be traced to its original source?
7. When was each source last checked and is the train healthy?

The first release must support a compelling demonstration for councils/destination organisations/wetlands and be reusable for evidence-heavy infrastructure prospects.

---

# P0 — repair the railway before adding cargo

## Authoritative ingest contract from read-only audit (26 Sep 2026)

Implementation MUST follow the audited repository contract rather than older assumptions:

- The only implemented app ingest endpoint at audited HEAD is `POST /api/ingest/grok`.
- Auth header is `x-bioveracity-ingest-key`; server compares it to `process.env.BIOVERACITY_INGEST_KEY`.
- Request flow is: auth → JSON parse → schema 2.1 validation → fingerprint dedup → **RawIngest raw-first persistence** → interpretation into ObservationCandidate / CommercialSignal / EntityCandidate → RawIngest status roll-up.
- A successful response returns `success:true`, `rawIngestId`, `observationsReceived`, and status. A duplicate is also success and returns the existing `rawIngestId`.
- Interpretation failure must preserve RawIngest, mark it FAILED and record the bounded error.
- Nothing becomes public merely because ingest accepted it. Candidate normalisation/publication remains a separate reviewed lifecycle.
- There is **no StagedDiscovery model**. Do not create one merely to match operational language. “Staged” outside the app means a payload waiting in the external Scout runtime. Once accepted by this app, lifecycle state is represented by RawIngest / ObservationCandidate statuses and timestamps.
- Existing RawIngest lifecycle: FOUND → PARSED → VERIFICATION_PENDING → VERIFIED → NORMALISED → PUBLISHED, plus FAILED.
- Existing ObservationCandidate lifecycle: CANDIDATE → NEEDS_REVIEW → VERIFIED → NORMALISED → PUBLISHED, or REJECTED.
- Existing ingest-related models are RawIngest, ObservationCandidate, CommercialSignal and EntityCandidate. Reuse them unless an implementation gap is demonstrated.
- The server does **not** read `BIOVERACITY_INGEST_URL`. That URL belongs only in the external Scout sender runtime.
- Do not introduce `INGEST_SECRET` or `CONNECTOR_WRITE_ENABLED` as though they already exist. The audited app auth variable is `BIOVERACITY_INGEST_KEY`.
- No scheduler is version-controlled in the audited repo. Scout/Abacus scheduling is external and must be verified separately.
- Audited repo contains neither `/api/ingest/external` nor `/api/ingest/connectors`. Do not invent those routes simply to satisfy old scheduler configuration; first establish the intended source contract and deliberately repoint/consolidate external tasks.
- There is currently no retry/dead-letter queue or structured logging framework in the ingest path. DB lifecycle state + HTTP responses are the current audit trail.

### Today's Niamh-safe rule

Niamh may log in while this work is underway. Preserve all existing customer/workspace data and authentication behaviour. No migration, seed, replay or production write may be used as a shortcut for her demo. If the new regional intelligence feature is incomplete, keep it behind an explicit feature/config gate rather than destabilising her existing journey.


## Scout direct ingest

Current controller evidence says Scout discovers payloads but its runtime lacks:
- `BIOVERACITY_INGEST_URL`
- `BIOVERACITY_INGEST_KEY`

Production route expected:
`POST https://bioveracity.com/api/ingest/grok`

**Do not commit secrets. Do not copy an unverified plaintext key into code.**

### Acceptance
- production key is confirmed/rotated through the authorised secret manager;
- Scout receives URL + key in its actual execution runtime;
- send exactly ONE staged canary first;
- require HTTP 200;
- response includes `rawIngestId` and app lifecycle status;
- record exists as `RawIngest` and is visible in authenticated `/admin/ingest`;
- source URL, retrieval timestamp and raw payload survive;
- only after canary proof may the external Scout backlog be replayed;
- replay is idempotent via existing `RawIngest.payloadFingerprint @unique` behaviour and reports accepted/duplicate/failed counts;
- no customer/private records are modified by the test.

## External Scout sender contract

The sender is outside this repository. Configure/verify there:
- `BIOVERACITY_INGEST_URL=https://bioveracity.com/api/ingest/grok`
- `BIOVERACITY_INGEST_KEY=<same secret as production server>`

Never print the value. The external sender must record attempt timestamp, HTTP status, returned rawIngestId/status, bounded error, and retry count. A local staged file is NOT an app RawIngest row.

## 6-hour connector train

Determine the actual target of the existing 6-hour Abacus connector task. Controller evidence suggests `/api/ingest/connectors` may be absent on live production.

Acceptance:
- exact target route documented;
- every scheduled run records HTTP outcome, accepted count, duplicate count and failed count;
- a scheduler completion is NEVER represented as successful ingest unless persistence is verified;
- if route is obsolete, retire/repoint it deliberately rather than creating a competing hidden path.

---

# P1 — CSO PxStat connector

Implement CSO as a first-class source adapter using the official PxStat/API mechanism rather than scraping presentation pages.

## Initial bounded dataset registry

Do not ingest the whole CSO catalogue. Add a config-driven allow-list. Candidate families for discovery and human approval:
- planning permissions / construction intensity;
- population and settlement context;
- tourism / travel;
- agriculture / land-use context where available;
- energy / transport context;
- enterprise/corporate sustainability statistics where geographically meaningful.

Each configured dataset must record:
- provider = CSO;
- stable dataset/table identifier;
- title;
- canonical source/API URL;
- geography dimensions and geography code;
- measure;
- unit;
- reference period;
- publication/update timestamp where supplied;
- retrieval timestamp;
- raw value;
- normalised value;
- dataset/schema version where available;
- raw response fingerprint;
- ingestion status;
- correction/supersession relationship.

Unknown dates stay unknown. Do not substitute retrieval date for event/reference/publication date.

## Adapter behaviour
- deterministic fetch and parse;
- timeout + bounded retry;
- rate-limit friendly;
- schema validation;
- raw response retained or reproducibly referenced;
- idempotent fingerprinting;
- explicit no-change outcome;
- changed upstream values create auditable revisions, not silent overwrites;
- malformed/partial records quarantine for review;
- no invented coordinates;
- map only official geographies through an explicit crosswalk.

## Tests
Fixtures must cover:
- normal response;
- empty response;
- changed value/revision;
- duplicate replay;
- missing publication date;
- unknown geography;
- changed schema;
- API timeout/error;
- unit mismatch.

No test may depend on production writes.

---

# P2 — common regional evidence contract

Create/reuse one source-neutral observation contract so CSO is not a bespoke silo.

Minimum conceptual fields:
```
sourceProvider
sourceDatasetId
sourceRecordId
sourceUrl
sourceType
geographyType
geographyCode
geometryRef?
observedAt?
referencePeriodStart?
referencePeriodEnd?
publishedAt?
retrievedAt
measure
value
unit
rawPayloadRef
fingerprint
revisionOf?
reviewStatus
evidenceClass
```

Evidence classes must preserve distinctions such as:
- measurement/statistic;
- regulator finding;
- licence/planning event;
- operator statement;
- community observation;
- BioVeracity analytical inference.

Do not flatten those into a single truth score.

---

# P3 — place/project source registry

A place page must declare the sources it is actually watching.

For each source:
- source name;
- coverage/geography;
- connector;
- last attempted;
- last successful retrieval;
- last successful persistence;
- new/changed records;
- failure reason;
- status GREEN / AMBER / RED / GREY.

Definitions:
- GREEN = verified end-to-end;
- AMBER = partial/degraded;
- RED = expected train failed;
- GREY = not verified.

Never mark GREEN merely because a cron ran or a source returned 200.

Add `oldestUndeliveredAge` to operational reporting.

---

# P4 — Regional Intelligence / sales visualisation

Create a reusable authenticated demonstration component, not a one-off Kerry hard-code.

## User experience

For a selected place/project:
- map;
- chronology;
- source/train status;
- selectable measures;
- temporal chart;
- source-linked evidence drawer;
- 'what changed?' summary;
- comparison of signals on aligned time axes;
- clear data coverage/gaps;
- generated-at/retrieved-at information.

Every plotted point must be inspectable back to its source record.

## Derived outputs — V1

Permitted:
- absolute/percentage change where mathematically valid;
- rate of change;
- direction of change;
- rolling/period comparison where valid;
- spatial aggregation based on explicit boundaries;
- evidence/source density;
- temporal co-movement/divergence clearly labelled analytical;
- lag exploration clearly labelled exploratory.

Not permitted in this PR:
- causal claims from correlation;
- arbitrary 'health', 'risk', 'truth' or sustainability scores;
- hidden weighting;
- fabricated interpolation;
- unsupported predictions.

If two series use different units/scales, the UI must disclose normalisation rather than visually implying equivalence.

## Evidence drawer

Clicking a point/event shows:
- source;
- dataset/document;
- exact measure/event;
- reference/event date;
- publication date if known;
- retrieval date;
- geography;
- unit/value;
- original source link;
- evidence class;
- review status;
- analytical transformation, if any.

---

# P5 — Kerry / Tralee demonstration

Create a **demonstration configuration**, not factual seeded claims unless retrieved from reviewed sources.

Geographic configuration should be capable of representing:
- County Kerry;
- Tralee / relevant official statistical geography;
- Tralee Bay / wetland or protected-area geometry only from authoritative source data;
- catchment/coastal context where authoritative boundaries are available.

Candidate source families to investigate and approve:
- CSO;
- EPA Ireland;
- NPWS/protected-area data;
- NBDC/GBIF where licensing/terms permit;
- local authority planning/open data;
- OPW/flood evidence where relevant;
- water/catchment evidence;
- tourism statistics where geography supports it.

The demo must say exactly what geographic level a statistic represents. A Kerry statistic must never be presented as a Tralee Wetlands measurement.

No implication of partnership with Kerry County Council, Tralee Bay Wetlands or any other organisation without evidence.

---

# P6 — UK replication architecture

The Irish CSO adapter is one implementation of a broader `OfficialStatisticsProvider` interface.

Prepare adapters/registry slots for authoritative UK sources, subject to API/licence verification:
- ONS — England/Wales official statistics;
- NRS — Scotland population/statistical context;
- NISRA — Northern Ireland;
- Environment Agency;
- Natural England;
- planning/open-data sources;
- SEPA / NatureScot;
- NRW;
- DAERA;
- local-authority sources where central coverage is absent.

Do not build every connector in this PR. Implement the interface, registry and at least one UK official-statistics proof connector after source/API review.

## UK opportunity registry

Add a structured, non-customer registry for discovery:
```
placeName
nation
placeType
authority
geometryRef
environmentalAssets[]
longTermEvidenceObligations[]
candidateSources[]
sourceCoverageStatus
documentedBuyerRole?
documentedBuyerName?
buyerEvidenceUrl?
salesHypothesis
lastReviewedAt
```

Named people may only be stored when their relevant responsibility is documented by a public source. A job title alone is not proof of budget ownership.

Priority place types:
- wetlands and wetland centres;
- national parks/AONBs/national landscapes;
- coastal/marine destinations;
- catchments/river restoration areas;
- councils with biodiversity/LNRS/BNG obligations;
- habitat banks;
- major visitor attractions with land/ecology stewardship;
- ports;
- offshore wind/infrastructure project geographies.

---

# P7 — API foundation

Expose a versioned, authenticated read API for approved/reviewed regional outputs.

Proposed routes (adapt to existing conventions):
- `GET /api/v1/places/:id`
- `GET /api/v1/places/:id/sources`
- `GET /api/v1/places/:id/timeline`
- `GET /api/v1/places/:id/series?measure=...`
- `GET /api/v1/places/:id/changes`

Requirements:
- workspace/customer permissions enforced server-side;
- public/open source does not imply private case data is public;
- pagination;
- bounded query windows;
- rate limiting;
- API version;
- provenance included in responses;
- unknown/conflicting values preserved;
- no secrets in client bundle/logs;
- audit API access;
- usage counters suitable for later commercial limits.

API responses should make it possible for a customer visualisation to reproduce the evidence trail, not merely receive a score.

---

# P8 — deployment provenance

Controller found that live production cannot currently be cleanly tied to `main`.

Before calling this production-ready:
- record build commit SHA in the deployed application;
- expose SHA/version to authenticated admin/health diagnostics;
- document Abacus deployment source and rollback point;
- verify the deployed SHA after release;
- do not infer deployment from merge/push.

---

# Security and data governance

- secrets only through authorised secret storage;
- never log ingest keys;
- preserve raw-source provenance;
- respect upstream licensing/attribution;
- identify datasets whose terms prohibit redistribution;
- separate raw source, normalised observation and analytical output;
- corrections are auditable;
- private workspace isolation tests required;
- unauthorised account must not retrieve another customer's regional/case API data;
- downloaded/exported data limitations disclosed where relevant.

---

# Definition of done

This PR is not done because code exists.

## Required evidence

1. Scout canary: source -> staged payload -> authenticated POST -> 200 -> rawIngestId -> DB/admin-visible.
2. Backlog replay reports deterministic counts with no duplicate proliferation.
3. CSO fixture tests + one approved live read complete without production writes.
4. One CSO series persists with full provenance.
5. Kerry/Tralee demo renders at least one approved official-statistics series and at least one environmental/evidence series with honest geographic labelling.
6. Every displayed point opens its evidence/provenance.
7. One UK proof geography runs through the same common contract.
8. API permission test proves cross-workspace denial.
9. Typecheck + relevant tests pass.
10. Production build uses the actual hosting build path.
11. Deployed commit SHA is observable.
12. Post-deploy smoke test records URLs/results.
13. Controller verifies the relevant trains end-to-end and reports GREEN only after persistence.

## Handoff

Report:
- branch + full SHA;
- changed files;
- migrations;
- env var **names only**;
- commands/tests and exact results;
- source/API licences checked;
- deployed/not deployed;
- production SHA if deployed;
- rollback point;
- remaining blockers.

No automatic production deployment. Deployment requires explicit approval.

---

# Deliberately out of scope

- ingesting all CSO/ONS datasets;
- machine-generated causal conclusions;
- universal place rankings;
- predictive ecological risk scores;
- automatic external outreach;
- replacing Railway/hosting observability with a custom monitoring platform;
- new verticals unrelated to this regional evidence journey.

## Product principle

**Official statistics provide context. Environmental records provide evidence. BioVeracity provides the source-linked chronology and analysis connecting them — without pretending correlation is causation.**
