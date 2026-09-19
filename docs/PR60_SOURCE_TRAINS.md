# PR60 — First source trains and source-health control room

## Objective

Make the first four source families look like trains on one railway:

1. Wild Field Journal community observations.
2. Cambridgeshire biological occurrence records.
3. Natural England SSSI spatial context.
4. Environment Agency rainfall measurements.

This PR is stacked on PR59 and therefore assumes durable observation persistence exists.

## What this PR does

- defines a source-train registry;
- states what each source is and is not authoritative for;
- normalises the four source shapes through the PR58 contract;
- defines a source-health receipt so Ground Control can answer whether a train actually ran;
- adds focused tests that prevent context, occurrence and physical measurements from being conflated.

## Source-health fields

Every source train should eventually expose:

- last attempted run;
- last successful run;
- inspected record count;
- accepted record count;
- coverage state/note;
- failure reason;
- source version/hash where available;
- next scheduled run when a scheduler is actually configured.

A missing scheduler must remain null. This PR does not claim continuous production ingestion.

## Reconciliation requirements

### Wild Field Journal
Use PR57's existing moderation and privacy rules. Publication is visibility, not scientific verification.

### Cambridgeshire GBIF
Reconcile the event-level acquisition from PR50 before public grouping. Preserve upstream event identity where available. Public district summaries remain a projection and are not a rate-of-change dataset.

### Natural England
Port the tested SSSI adapter logic from the historical branch onto the current integration line rather than merging the old divergent branch wholesale. Preserve stable REF_CODE, source identity/licence checks, request provenance and source-edit detection.

### Environment Agency rainfall
Port the tested named-station adapter onto the current integration line. Preserve quality/completeness and null missing values. Do not map a station to a site/catchment without a documented relationship.

## Explicit non-goals

- no automatic external scheduler;
- no production credentials;
- no production database migration;
- no national completeness claim;
- no automatic ecological change finding;
- no composite biodiversity score;
- no "live" badge unless a successful production run and refresh owner are verified.

## Acceptance journey

For one Cambridge place:
1. a community observation can arrive as COMMUNITY / REPORTED;
2. an occurrence representation can arrive as DETECTED;
3. an SSSI boundary can arrive as CONTEXT_ONLY;
4. rainfall can arrive as MEASURED with mm/day and provider-quality text;
5. each source has a health receipt;
6. all four can be persisted by the PR59 store without changing their evidence class;
7. a failed source is visible as failed/partial and never becomes an absence result.

## Follow-on after this stack is green

Add one internal control-room view: place -> connected trains -> last success -> current coverage -> unresolved questions -> next useful observation.

Only after that should we add more connectors.
