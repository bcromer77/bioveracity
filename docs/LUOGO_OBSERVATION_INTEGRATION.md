# Luogo observation integration — bounded architecture PR

Date: 19 September 2026
Branch: `feat/luogo-observation-contract`
Base: `clarity/usability-release`

## Bullseye

Create one canonical observation contract that can receive materially different evidence without collapsing their meaning:

- community observations from Wild Field Journal;
- biological occurrence records such as GBIF / future records-centre or NBN representations;
- physical measurements such as Environment Agency rainfall;
- official spatial context such as Natural England SSSI boundaries;
- structured non-detections where a target was actually checked under a recorded protocol.

This PR does not migrate production data, schedule external polling, deploy, create a new public score, or claim that any historical branch is live.

## Why this is the integration seam

Current work already has useful but separate paths:

- Honeycomb returns source coverage, spatial relationship, date precision and occurrence context.
- Cambridgeshire PR50 has a real bounded GBIF acquisition, but its public snapshot intentionally aggregates away record-level detail.
- Natural England's historical SSSI branch preserves stable site identity, geometry, request provenance and source hashes.
- The rainfall experiment preserves values, units, provider quality flags and station identity.
- PR57 keeps casual visitor contributions explicitly separate from verified ecological evidence.
- The canonical schema already contains `DatasetCoverage`, `ChangeRecord`, `UnresolvedQuestion` and `ResolutionPath`.

The integration contract therefore sits before interpretation. Luogo should consume normalized observations plus coverage, not scrape user-facing prose or turn source silence into absence.

## Non-negotiable distinctions

1. Observed time is not ingestion time. Unknown dates remain unknown.
2. One event may have multiple findings.
3. A source representation is not automatically an independent observation.
4. A non-detection exists only when a relevant target was actually checked under a recorded protocol.
5. A polygon or designation is context, not an ecological condition measurement.
6. Instrument measurements retain units, provider quality and station/site scope.
7. Coverage is a separate object from ecological state.
8. AI review/publication never upgrades a community observation into verified wildlife evidence.
9. No composite biodiversity score is introduced.
10. Change estimates will require a later, versioned metric/model layer with exact input snapshots and uncertainty.

## Previous PR reconciliation

### PR50 — Cambridgeshire ecology search

Keep:
- district polygon filtering;
- licence and sensitivity gates;
- explicit partial/unavailable coverage;
- raw location privacy in public projection;
- real acquisition receipts.

Repair before using for Luogo:
- retain an approved protected event-level analytical representation before public grouping;
- preserve upstream event identity when available, not only GBIF record keys;
- do not estimate rates from `count/firstYear/lastYear` public groups;
- record source lineage so the same biological event arriving through GBIF/NBN/local records is not multiplied.

### Natural England SSSI branch

Keep:
- stable `REF_CODE` identity;
- fail-closed source/licence checks;
- request and content hashes;
- source-change detection during collection.

Reconcile rather than merge wholesale because the branch is materially behind the current release base.
SSSI polygons remain spatial context only.

### Cambridge rainfall branch

Keep:
- physical value + unit;
- provider quality/completeness;
- missing values as null;
- station-specific scope;
- bounded upstream calls.

Do not describe a named station as a site or catchment measurement unless a documented spatial relationship is established.

### PR57 — Wild Field Journal

Keep:
- community-observation evidence class;
- no automatic scientific verification;
- coarse public location and sensitive-location controls;
- optional observation date.

Add later:
- an optional structured-check flow for repeatable monitoring;
- explicit protocol/effort fields only for users who have chosen a structured check;
- a protected scientific contribution path where a receiving organisation requires more precise context.

## Commercial route first: Greater Cambridge BNG evidence continuity

The immediate paid job is not a new biodiversity map.

Greater Cambridge already requires BNG evidence in planning, and Cambridge City Council states that BNG is tracked in corporate systems and that off-site BNG providers can be subject to a chargeable monitoring regime. Natural England guidance requires significant gains to be managed and monitored for at least 30 years through legal agreements/HMMPs.

Proposed first offer to validate:

**BNG Evidence Continuity Check — one site / one monitoring milestone**

Deliverable:
- source-linked obligation and expected evidence;
- what evidence has been located;
- what cannot be established;
- relevant independent environmental context;
- one professional-reviewed cited brief;
- explicit next evidence due/check date.

Do not sell this as a compliance certificate. The LPA/professional remains the decision-maker.

Potential buyers to validate:
- habitat-bank / off-site BNG provider;
- developer or ecological consultant responsible for monitoring evidence;
- LPA ecology/planning team where procurement and governance allow.

A price is deliberately not set in this PR. First establish reviewer time, source-access cost, report-production cost and buyer willingness to pay.

## Second route: Luogo place observation service

Venues get the human-facing loop:
notice -> clarify -> remember -> compare -> explain -> suggest the next useful observation.

The protected analytical substrate can later aggregate appropriately governed observations across participating places. Policy outputs must state the participating population and observation coverage; they are not automatically representative of Cambridgeshire or England.

## Candidate source plumbing order

1. Existing Wild Field Journal contributions.
2. Existing Honeycomb/provider results.
3. Cambridgeshire GBIF acquisition reconciled from PR50.
4. Natural England SSSI adapter reconciled onto the current base.
5. Environment Agency rainfall/hydrology adapter reconciled onto the current base.
6. Greater Cambridge planning/document evidence through the existing evidence pipeline.
7. CPERC/NBN or other records-centre data only through agreed licensing/access terms.
8. Further sources only when they answer a defined missing question.

## Acceptance for this PR

- Four materially different source shapes normalize into one contract.
- Unknown observation dates remain unknown.
- A physical measurement requires a finite value and unit.
- A spatial context record cannot be mistaken for condition.
- A structured non-detection requires a target and protocol.
- Two representations carrying the same upstream event ID count as one independent event in the contract helper.
- Coverage remains explicit and separate.
- No Prisma migration, production write, scheduler or deployment is performed.

## Follow-on PR after contract validation

Persist the minimum canonical event/finding/source-lineage records by reusing existing provenance/coverage/change/question tables where possible. Add one saved Evidence Check flow and one end-to-end Cambridge demonstration before expanding connector count.

## Public evidence reviewed for commercial framing

- Natural England / Defra HMMP guidance: https://www.gov.uk/guidance/creating-a-habitat-management-and-monitoring-plan-for-bng
- Natural England Action Plan 2026–27: https://www.gov.uk/government/publications/natural-england-action-plan-2026-to-2027/natural-england-action-plan-2026-to-2027
- Cambridgeshire & Peterborough LNRS: https://www.cambridgeshire.gov.uk/residents/climate-change-energy-and-environment/improving-the-natural-environment/cambridgeshire-and-peterborough-local-nature-recovery-strategy
- Cambridge City Council Biodiversity Strategy 2026–31 committee appendix (BNG tracking/monitoring regime): https://democracy.cambridge.gov.uk/documents/s72526/Item%2B7%2BAppendix%2BA%2BCambridge%2BCity%2BCouncil%2BBiodiversity%2BStrategy%2B2026%2B-2031%2BAppendices%2B1%2Bto%2B3.pdf
- Greater Cambridge planning validation requirements: https://www.greatercambridgeplanning.org/the-planning-application-process-and-advice/planning-application-validation-checklists/full-planning-permission
- CPERC data services: https://www.cperc.org.uk/our-services/
- Environment Agency Catchment Data API: https://environment.data.gov.uk/catchment-planning/api/docs
