# CPCA 30-Year BNG Evidence Record Demonstration

## Purpose

Build one evidence-defensible demonstration of BioVeracity solving a real 30-year Biodiversity Net Gain evidence-management problem in Greater Cambridge.

This is not a generic BNG dashboard, a mock-up, an AI compliance scoring system, or permission to redesign BioVeracity.

The proposition under test is:

> BioVeracity remembers a site's environmental commitments for 30 years and keeps the evidence attached to them.

The demonstration must use one real Greater Cambridge BNG site, habitat bank or development supported by genuine public evidence. The professional remains the decision-maker. BioVeracity must not state that a site is compliant or non-compliant unless an authoritative source explicitly makes that determination.

The CPCA demonstration must answer:

1. What was promised here?
2. What is legally or operationally required?
3. When should it happen?
4. What evidence exists that it happened?
5. What evidence is missing or unavailable?
6. What independent environmental evidence exists around the same place?
7. What needs checking next?
8. Where did every piece of evidence come from?

## Phase 0 — protect the existing product

Before implementation:

- inspect the current repository, branches and open PRs;
- identify and record the authoritative integration base and full SHA;
- read AGENTS.md, docs/DEVELOPMENT_WORKFLOW.md and docs/CURRENT_HANDOVER.md where present;
- identify and preserve unmerged work;
- do not modify production, deploy, migrate production data or change existing Irish Honeycomb behaviour;
- use one dedicated implementation branch and report the exact starting SHA.

## Phase 1 — select one real Cambridge site

Research Greater Cambridge, Cambridge City and South Cambridgeshire public sources and select the real site with the strongest evidence chain, not the most visually attractive site.

Do **not** hard-code a candidate planning reference, UKHab code, habitat condition, metric result, Section 106 term, monitoring milestone or responsible party from an example or implementation prompt. Candidate sites such as Waterbeach or Darwin Green may be investigated, but the selected site and every populated field must come from retrieved authoritative evidence.

Prefer evidence including, where publicly available:

- planning reference, site location and boundary;
- Biodiversity Gain Plan and statutory biodiversity metric;
- baseline and target habitat information;
- Habitat Management and Monitoring Plan (HMMP);
- Section 106 agreement or conservation covenant where applicable;
- responsible party/body;
- habitat creation or enhancement commitments;
- monitoring schedule, target condition and management actions;
- subsequent monitoring evidence;
- planning history and ecological reports;
- council committee/report references;
- Natural England or Biodiversity Gain Sites Register information where relevant;
- other authoritative environmental evidence around the site.

Do not fabricate missing documents, create fictional monitoring evidence or treat a press release as proof that an action occurred.

Before implementation report: selected site, planning reference, location, why selected, public documents found, documents not found, authoritative sources, likely 30-year obligations and known evidence gaps.

## Phase 2 — reconstruct the original promise

Extract only what source documents support.

Capture where available:

**Site:** name, location, boundary, planning reference, responsible planning authority and relevant BNG registration/reference.

**Baseline:** date, habitat, habitat condition, biodiversity units, source document and page/section, assessment author/date.

**Commitment:** habitat to be created or enhanced, target condition, biodiversity units, percentage/net-gain commitment where stated, spatial commitment, responsible party, legal mechanism, commencement date and duration.

**Management:** required action, responsible party, frequency, start date, duration and expected evidence.

**Monitoring:** event, due date/year, required survey/assessment, expected report/evidence, responsible party, recipient where stated and documented remediation/review mechanism.

Every extracted obligation must retain provenance: original document title, issuing organisation, original URL, publication/execution date, page/section/paragraph locator where possible, retrieval date and a supporting passage where legally/licensing appropriate.

Classify statements as REQUIRED, PLANNED, TARGET, RECOMMENDED, INFERRED or UNKNOWN. Never silently convert inferred or vague wording into a requirement.

## Phase 3 — 30-year evidence timeline

Reuse BioVeracity's existing chronology/evidence architecture wherever possible. Do not create a parallel application when the existing case/evidence/timeline system can perform the job.

The chronology is:

BASELINE → COMMITMENT → ACTION DUE → EVIDENCE EXPECTED → EVIDENCE RECEIVED / NOT LOCATED → PROFESSIONAL REVIEW → DOCUMENTED FOLLOW-UP → NEXT OBLIGATION.

Create a persistent record that a professional can understand chronologically.

Preserve these distinctions everywhere:

- Evidence not located does not mean the action did not happen.
- No public evidence found does not mean non-compliant.
- Source unavailable does not mean no evidence exists.

## Phase 4 — obligation calendar

Create or reuse the minimum structure required to answer:

- What is due?
- When is it due?
- Who is responsible?
- What evidence should exist?
- Has that evidence been located?
- What is next?

Support, where available: title, obligation type, source, responsible party, due date/year, recurrence, expected evidence, linked evidence, review status and next due event.

Workflow statuses may include UPCOMING, EVIDENCE LOCATED, UNDER REVIEW, EVIDENCE NOT LOCATED, OVERDUE EVIDENCE CHECK and SOURCE UNAVAILABLE.

Do not use COMPLIANT, NON-COMPLIANT, PASS, FAIL, GOOD or BAD as BioVeracity judgements. If an authoritative source makes such a determination, attribute it explicitly.

## Phase 5 — independent environmental context

Connect the same site to Honeycomb. Research the appropriate authoritative English providers rather than assuming Irish providers apply.

Potential categories include biodiversity/species observations, protected/designated sites, Natural England evidence, Environment Agency water and flood evidence, planning history and relevant habitat/environment datasets.

For each provider document: source, owner, endpoint/dataset, licence, geographic resolution, update frequency, available provenance, limitations and implementation cost/complexity.

Reuse the existing Honeycomb provider contract and geographic architecture wherever technically sensible. The demonstration should test whether English providers can be substituted without redesigning the core system.

Before writing an English provider, inspect the **current Irish environmental-evidence implementation** (including the GBIF/NBDC, EPA water and OPW flood work if it has been reconciled into the chosen base) and reuse its current provider result/status/provenance contract. Do not create a second `english-providers.ts` abstraction merely because an example suggests one.

Verify every proposed English endpoint, response shape, licence, attribution requirement, geographic semantics and availability from the implementation environment before coding. Natural England/MAGIC and Environment Agency are candidate authorities, not pre-approved endpoints. Do not invent an API URL from memory or accept an illustrative URL as implementation evidence.

Where an English dataset is not commercially reusable, treat that as an explicit provider capability/restriction and prefer metadata/reference/linking where lawful rather than silently repackaging the dataset.

Provider states must distinguish OK, PARTIAL, NO MATCHING EVIDENCE, UNAVAILABLE and ERROR. A failed provider must not destroy the investigation. Do not seed environmental records merely to make the demonstration look populated.

## Phase 5A — smallest BNG-specific implementation

The existing evidence, provenance, chronology, workspace/case and export machinery is the starting point. Add the smallest BNG-specific structure necessary; do not build a Cambridge-only parallel evidence system.

Do **not** create a standalone `bng-taxonomy.ts` with hard-coded Cambridge evidence unless repository inspection proves that this is the smallest compatible implementation. Prefer shared domain types/validation plus persisted records linked to the existing evidence/case architecture.

A BNG obligation must retain the relationship between:

SOURCE OBLIGATION → DUE DATE / RECURRENCE → EXPECTED EVIDENCE → EVIDENCE LOCATED / NOT LOCATED → PROFESSIONAL REVIEW → NEXT OBLIGATION.

Do not model an obligation as an ordinary chronology event if doing so loses those relationships.

UKHab codes, habitat conditions, biodiversity metric values, net-uplift percentages, responsible parties, Section 106 terms and milestone dates are **evidence values**, not source-code constants. They must be populated only from the selected site's authoritative documents and retain source locators.

Before changing the Prisma schema, prove that the requirement cannot be represented safely with the existing persistent case/evidence model. If an additive schema change is necessary, prepare and test it on the implementation branch but do not migrate production.

## Phase 6 — bullseye user experience

Do not redesign the whole site. Build the smallest professional experience that makes the proposition obvious.

The site record should make clear:

**This place:** identity, location and governing planning/BNG commitment.

**What was promised:** material commitments with original-source links.

**30-year timeline:** baseline → commitments → management → monitoring → evidence → next obligation.

**What is due:** upcoming monitoring/evidence obligations.

**What evidence do we have:** linked reports, documents and authoritative records.

**What could we not establish:** missing or unavailable evidence stated honestly.

**What else is happening around this place:** independent environmental context through Honeycomb.

Every meaningful item must provide a route back to its original evidence.

## Phase 7 — private case and evidence workflow

Where existing capability supports it, verify:

SITE → SOURCE EVIDENCE → SELECT RELEVANT EVIDENCE → PRIVATE CASE → PROFESSIONAL REVIEW → CITED REPORT/EXPORT.

Do not weaken workspace/case isolation. Test unauthorised cross-workspace access. Do not expose private documents through the public demonstration. Keep public-source and private uploaded evidence clearly distinguishable.

## Individual professional offer — 10 concurrent live cases

The individual professional case offer must support **up to 10 live cases at the same time per individual account/workspace**.

This is a concurrent-live-case limit, not a lifetime case limit. A professional may retain completed or archived cases without those cases consuming one of the 10 live slots.

For this requirement:

- LIVE means an active case that can continue to receive/populate evidence, documents, Honeycomb findings, timeline entries, reviews and exports;
- COMPLETED or ARCHIVED cases remain readable and retain their evidence/provenance, but do not consume a live slot;
- evidence population for one live case must not block or overwrite population of any of the other nine;
- all 10 live cases must remain isolated from one another and from other users/workspaces;
- each case must retain its own documents, evidence, chronology, sites, reviews, exports and provenance;
- opening an 11th live case must not silently overwrite, delete or close another case;
- if the 10-live-case limit is reached, the product must give a clear human message and require the user to complete/archive an existing case before activating another;
- the limit must be enforced server-side, not only hidden or disabled in the UI;
- concurrent/background population must be idempotent and safe to retry so that one failed provider or ingestion job does not corrupt another case;
- do not create a second case system for this offer: reuse the existing PrivateWorkspace → PrivateCase architecture and add only the minimum lifecycle/entitlement controls needed.

For the CPCA demonstration, prove the architecture can hold 10 distinct live cases concurrently. Only the selected Cambridge BNG case needs the full curated demonstration dataset; the other nine must not be populated with fabricated BNG evidence merely to satisfy the concurrency test.

Acceptance checks:

1. one individual account/workspace can have 10 LIVE cases concurrently;
2. all 10 can be independently opened and populated without cross-case leakage;
3. an attempt to activate/create an 11th LIVE case is safely rejected with a clear message;
4. archiving/completing one case frees one live slot without deleting its evidence;
5. the archived/completed case remains readable and source-linked;
6. another user's case cannot be accessed through IDs, APIs, exports or population jobs;
7. case counts and lifecycle state are enforced on the server under concurrent requests.

## Phase 8 — CPCA demonstration output

The finished product must support a five-minute demonstration:

- This is a real Cambridge site.
- This is what was promised.
- These obligations last for 30 years.
- This is what should have happened by now.
- This is the evidence we can actually find.
- This is something we could not establish.
- This is what independent environmental evidence says about the same place.
- This is what needs checking next.
- Every statement takes us back to its original source.

The generated Evidence Record should contain site identity, boundary/location, baseline, commitments, obligation chronology, evidence located, evidence gaps, upcoming obligations, environmental context, source citations, original URLs and retrieval dates.

Reuse the **actual current case export/report route** found during repository inspection. Do not assume `app/api/generate-pdf/route.ts`, `lib/pdf-report.ts`, QR verification, or any other historical/example route is authoritative until it is verified in the selected base. The demonstration passes only if the real private-case journey produces a readable cited output from the same evidence snapshot the professional reviewed.

Include a clear statement that BioVeracity organises evidence and does not itself determine statutory compliance.

The report must be understandable to a planning or environmental professional without developer explanation.

## Phase 8A — Cambridge trial execution

Once the real site and authoritative sources are confirmed, the shortest acceptable trial is:

1. lock the implementation branch and record the starting SHA;
2. select ONE real Greater Cambridge site on evidence quality;
3. ingest/reconstruct only source-supported site, baseline, commitment and monitoring information;
4. run the site's English environmental context through the existing Honeycomb architecture;
5. open/save the evidence in a private case and review it;
6. generate the real cited case output;
7. rehearse the five-minute CPCA demonstration from the resulting evidence record.

The demonstration narrative must use whatever the evidence actually establishes. Do not script a particular planning reference, habitat code, Year 3/Year 5 milestone or missing report before the source documents have been retrieved.

The trial should be easy to repeat for a second site eventually, but **do not add a second Cambridge site in this PR**.

## Phase 9 — explicitly out of scope

Do not build: generic BNG SaaS dashboard, compliance or biodiversity risk scores, red/amber/green judgements, automatic statutory decisions, replacement for ecologists/Natural England/LPAs, general AI chatbot, speculative predictive ecology, invoicing, Stripe, CRM, 100-site bulk ingestion, new mobile application, unrelated UI redesign, resident-objection ingestion, a new automatic divergence engine, broad 30by30 product, LNRS management platform or automated enforcement.

Record adjacent opportunities as LATER. Do not implement them.

## Phase 10 — data integrity

Never invent dates, obligations, species, habitat condition, monitoring results, responsible parties, compliance conclusions, missing documents or source availability.

Preserve EVENT DATE, DOCUMENT DATE, PUBLICATION DATE and RETRIEVAL DATE separately where relevant.

Show conflicting dates rather than resolving them silently. Show stale evidence dates. When evidence is absent, state what was searched. Expose source failure honestly. Preserve superseded historical documents and identify newer versions.

## Phase 11 — acceptance test

The demonstration passes only when a reviewer can answer from real evidence:

1. What real site is this?
2. What is its BNG/planning reference?
3. What was the ecological baseline?
4. What habitat gain was committed?
5. What legal/documentary source created the commitment?
6. How long does the obligation last?
7. Who is responsible, where stated?
8. What management/monitoring actions are required?
9. Which actions/evidence are due next?
10. What monitoring evidence has actually been located?
11. What expected evidence has not been located?
12. What independent environmental evidence exists around the site?
13. Can every material statement be traced to an original source?
14. Can relevant evidence be brought into a private case?
15. Can BioVeracity generate a readable cited evidence record?
16. Can an unauthorised user access the private case? The answer must be NO.
17. Does the product avoid unsupported compliance judgements?

Run relevant existing tests, new BNG evidence-record tests, Honeycomb provider tests, workspace isolation tests, case/evidence tests, PDF/export tests and the production build.

Also verify:

- the selected site's obligations survive a reload/restart and are not demo-only in-memory data;
- an evidence item imported from Honeycomb retains provider/source/licence/retrieval provenance in the private case;
- an English provider returning zero results is distinguishable from an unavailable/erroring provider;
- provider failure cannot corrupt or erase the case's BNG obligations;
- the cited export uses the reviewed evidence snapshot and does not introduce unsupported statements;
- no secrets or populated `.env` files are committed to the implementation branch;
- any Cambridge-specific seed/fixture is clearly separated from production data and contains no invented statutory evidence.

Do not deploy.

## Phase 12 — commercial measurement

Do not invent ROI. Prepare the demonstration so a council officer can be asked: **How do you do this today?**

Discovery should establish the number of BNG sites monitored, people involved, current systems, time spent locating evidence, monitoring/review frequency, ecological/administrative review cost, how missed/late evidence is identified, staff handover handling, where the 30-year record lives, budget owner, procurement route and willingness to pilot.

The proposed commercial unit for testing is ONE MONITORED SITE / YEAR. Do not put a public price into the product or assume willingness to pay.

## Final handover

Return one structured report containing:

1. authoritative starting branch + full SHA;
2. implementation branch + full SHA;
3. selected real Cambridge site;
4. why selected;
5. original authoritative sources;
6. documents found;
7. documents not found;
8. reconstructed BNG baseline;
9. reconstructed 30-year commitments;
10. monitoring/obligation calendar;
11. evidence located;
12. evidence gaps;
13. English Honeycomb providers used;
14. licences/attribution requirements;
15. files changed;
16. database/migration changes, if any;
17. environment variables, if any;
18. tests run + exact results;
19. build result;
20. access-isolation result;
21. generated report/PDF result;
22. known limitations;
23. external/API cost estimate;
24. rollback plan;
25. items deliberately left for later.

Finish with exactly one of:

CPCA DEMONSTRATION READY

CPCA DEMONSTRATION PARTIALLY READY

CPCA DEMONSTRATION NOT READY

Then explain why.

## Stop condition

Once one real Cambridge site demonstrates:

REAL PLACE → REAL BASELINE → REAL 30-YEAR COMMITMENT → REAL OBLIGATIONS → REAL EVIDENCE → HONEST GAPS → INDEPENDENT ENVIRONMENTAL CONTEXT → ORIGINAL SOURCES → PRIVATE CASE → CITED OUTPUT

STOP DEVELOPMENT.

Do not add another feature. Do not seed another site. Do not deploy.

Return the evidence for review and deployment authorisation.

The purpose is one undeniable CPCA demonstration that lets a council or planning professional understand the commercial problem and BioVeracity's solution within five minutes.
