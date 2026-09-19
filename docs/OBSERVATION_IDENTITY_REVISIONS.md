# Observation identity and source-content revisions

## Problem and scope

Repeated fetches previously changed source hashes solely because the receipt time
changed. Bare occurrence event/record identifiers could collide across datasets.
A corrected upstream value was discarded by the finding insert's conflict rule.
This change repairs that storage boundary. It does not add scheduling, deployment,
a public revision endpoint, automatic cross-provider reconciliation, or the saved
Evidence Check user journey.

## Behaviour

- Every adapter hashes the validated observation's semantic content using sorted
  JSON object keys. Receipt/retrieval timestamps and the derived hash itself are
  excluded. Arrays retain order. The stored hash describes the normalised
  representation, not a byte hash of the upstream response.
- Occurrence callers must supply non-empty source-system and dataset identifiers.
  Record, finding and sampling-event identities are scoped to both. Two records
  from the same sampling event in the same source dataset share an event; the
  same string from another dataset or provider does not establish equivalence.
  Cross-provider biological-event reconciliation remains a separate reviewed job.
- Structured checks with no optional event ID use their required upstream record
  identity instead of a random UUID, so retries are stable. Their IDs are also
  source-scoped.
- A canonical-event insert followed by a row lock serialises source/version writes
  through this store, including concurrent first arrivals. A transaction failure
  rolls back the event, findings, source and version together.
- `ObservationRevisionRecord` retains a full, source-linked snapshot of every
  distinct normalised content version: findings, dates, geometry, coverage and
  lineage. Re-fetching or replaying identical content reuses that snapshot.
- Legacy event/finding columns remain first-seen representations. They are **not**
  the current corrected view. Internal consumers needing corrections must read
  `observationStore(db).versions(eventId)` and inspect each source's snapshot.
  That method is internal; any future API must enforce access before calling it.
- Snapshot receipt time is the first receipt for that distinct version. Versions
  are ordered by that timestamp with an ID tie-break; this is not authoritative
  upstream revision order. A replay does not mark old content as current. An
  A→B→A return reuses A; this table is a distinct-content archive, not a run log.
  Source-health/run receipts will be needed for last-seen and return transitions.
- No ecological absence or independence claim is inferred from these identities.
  No data is made public by this change.

## Migration and release boundary

The integration base declared the four observation/evidence-check models without
migration SQL. `20260920_observation_revisions` supplies their additive creation,
plus the new snapshot table and indexes/foreign keys, generated from Prisma.
It does not modify, delete or backfill existing data.

Before applying it in a hosted environment:

1. Confirm the deployed full SHA and recoverable database snapshot through the
   existing Abacus runbook. This PR does not authorise a production migration.
2. Inspect whether any of these tables already exist outside migration history.
   If they do, stop and reconcile their schema/history explicitly. Do not drop
   tables or blindly mark the migration applied. Plain CREATE intentionally
   refuses an unknown pre-existing layout.
3. If historical observation rows exist, review their identities before v2
   ingestion. Occurrence and structured-check IDs changed. This PR does not
   silently relabel, merge, delete or import old rows alongside v2 rows.
   Changes to upstream identity itself also need reconciliation; a stable record
   reassigned to another sampling event must not be silently merged.
4. Validate and apply the additive migration in an isolated database first, then
   follow the separately approved snapshot/migration/deployment runbook.
5. Verify a real record, a repeat fetch and a correction on the hosted path before
   enabling a scheduler. Confirm original and corrected snapshots are readable.

Application rollback must preserve the new tables. Old application code does not
write revision snapshots, so pause ingestion if rolling back the application.
No automatic activation or ingestion/backfill is included.

## Verification

The observation workflow now runs the new identity tests and real PGlite database
tests using the checked-in migration. Cases cover timestamp-only repeats,
source/dataset collisions, corrected measurements and quality, changed dates and
geometry, source-to-snapshot linkage, old-version replay, unknown dates, scoped
documentary checks and atomic rollback. Overlapping calls are tested on PGlite's
serialised connection; this is not a multi-connection PostgreSQL load test.

Local checks: focused tests, strict TypeScript over the observation modules and
their tests, and Prisma schema validation. Full application typechecking remains
in the GitHub workflow. No production database or external acquisition is used.
