# PR59 — Persist Luogo observations and bounded Evidence Checks

## Objective

Turn PR58's in-memory observation contract into durable place memory without introducing ecological scoring or automated conclusions.

## User outcome

For one place, BioVeracity can retain:
- one canonical observation event;
- multiple findings from that event;
- multiple source representations without counting them as independent events;
- unknown observation dates as unknown;
- source/version lineage;
- a separately persisted Evidence Check describing exactly what was checked and what was not located.

## Deliberate boundaries

- No production migration is executed by this PR.
- No source scheduler or production polling.
- No public API exposing protected event-level data.
- No automatic scientific verification.
- No rate-of-change or acceleration model yet.
- No source silence is converted into ecological absence.

## Why this model

The existing schema already has DatasetCoverage, ChangeRecord, UnresolvedQuestion and ResolutionPath. This PR does not replace them.

ObservationEventRecord is the durable arrival record.
ObservationFindingRecord holds target-specific findings.
ObservationSourceRecord preserves how an event arrived and its upstream identity/version.
EvidenceCheckRecord preserves a bounded inquiry.

ChangeRecord remains the later change engine.
UnresolvedQuestion / ResolutionPath remain the mechanism for deciding what additional evidence would help.

## Release gate before any migration

1. Prisma schema validation and generated client pass on the approved environment.
2. Focused store tests pass.
3. Existing observation-contract and full TypeScript checks pass.
4. Migration SQL is reviewed separately before production authorisation.
5. Backup/restore and rollback are documented for the target database.
6. No historical data is backfilled until source lineage and permissions are reviewed.
