# Port provenance and private community intake: execution contract

Status: implemented locally and tested; pending GitHub review, preview migration and runtime acceptance. No production data changes, seed runs, deployment or paid map services.

## What this change does

- Keeps Leaflet, existing dark styles and existing historical baseline rows. No map dependencies added.
- Uses existing `CapitalProject` as the dedicated development pipeline. Do not put projected expenditure, throughput or capacity into historical Asset/Measurement fields. A future project is not an achieved operating result.
- Adds nullable sourcePublisher/sourceRetrievedAt/sourceLocation to Event, CapitalProject and Authorisation; adds explicit project/permit datePrecision defaulting to unknown. Existing unknown provenance is not fabricated or backfilled.
- Irish Ports `/live` requires a specific HTTPS source URL, publisher, genuine retrieval time and supporting passage locator before rendering a record. This checks metadata completeness, not truth. Human source reconciliation remains mandatory.
- Gives eligible dated projects and permits their own chronology cards and schematic Leaflet nodes; the same server access window controls both. Unknown date precision stays unknown. No whole-place verification/divergence verdict is inferred from old status text/counts.
- Quarantines `scripts/seed.ts` and `enrichIrishPorts()` before any writes. The legacy enrichment contains unsupported dates/figures and incomplete provenance. There is deliberately no environment bypass. `safe-seed` also fails if it cannot read its input. Review and replace legacy incoming records before removing the quarantine in a separately reviewed change. A deployment path that automatically seeds must stop; do not work around this gate.
- Prevents legacy ChangeRecord reruns from republishing withdrawn records. New candidate change records, if ingestion is later repaired, start unpublished and use actual detection time rather than historical event time.
- Adds `/postcode` as authenticated private intake against an existing mapped reference place. Postcode geocoding is not implemented. Topic taxonomy: Water, River, Odour, Operations, Air, Soil, Weather, Noise, Biodiversity, Other.
- Stores submissions separately from public CommunityReport/Event/evidence embedding tables. Defaults: PENDING_VERIFICATION + PRIVATE. A database check prevents public visibility in this phase, even if status changes.
- Requires same-origin authenticated POST, server-owned identity/status, bounded fields, 10 reports per account per rolling day and per-user retry uniqueness. No uploads or third-party AI processing.
- Displays the submitter's own last 72 hours of received reports immediately after successful save. Map pins are clearly labelled selected reference places, not exact incident coordinates. Observation time is separately labelled in the card.

## Ownership and acceptance: one bite-sized task at a time

### Task 1 — Abacus integration owner: preview schema and private intake

Integrate the branch preserving the Cambridge rainfall/Place History work from PRs 18/19. Inspect migration history and database target first, including the known pgvector infrastructure constraint; do not blindly apply all migrations to the managed database. Apply additive migration 0004 to an isolated preview with the expected existing tables and regenerate Prisma. Do not run seed. Set COMMUNITY_REPORTS_ENABLED=true only in that preview.

Prove with two separate signed-in accounts: Alice submits one report, sees a pending node/card immediately; Bob and signed-out visitors cannot retrieve Alice's report. Direct POST without authentication is rejected. Caller-supplied status/userId/coordinates are rejected. Retry the same requestId and verify one row. Verify the daily limit. Submit an older observation today and show submission-time placement with observation time kept separate. Keep logs free of report text and identities.

Acceptance evidence: preview URL, commit SHA, test account roles (no passwords), status codes and redacted screenshots. Do not report “live” on the strength of code or a local screenshot.

### Task 2 — Research/Abacus data owner: port source reconciliation

For each named development, produce one reviewed candidate with source URL, publishing body, actual retrieval timestamp, exact supporting passage/locator, publication date, event date + precision, claim class, planned/approved/operational distinction, licence/reuse review and reviewer decision. See port-source-reconciliation.md. No inferred January 1 dates, projected-date completions, invented amounts or automatic statutory verification.

New projects belong in CapitalProject/developmentPipeline. Route announcements are operator statements linked to a place; retain route dates distinctly from publication dates. Historical baseline corrections require a separate before/after audit and supporting evidence, never silent replacement. Verify an existing generic URL is inadequate rather than retaining it as “already sourced”. Reconcile affected existing rows in a dry-run manifest before any apply step.

Acceptance: each visible milestone opens its supporting page and its passage supports the precise displayed claim. Counts of eligible/withheld records reported honestly. No placeholder provenance used to make a record pass. Legacy seed stays quarantined until replacement input and import checks are reviewed.

### Task 3 — Abacus QA owner: Leaflet and timeline

With reviewed preview records, select every project/permit node; its associated card must appear. Scrub before/at/after each dated record; card filtering must agree with the displayed window and selected node. Test a non-institutional account against old project/permit records to prove server withholding, not just hidden UI. Test narrow mobile and desktop layouts. Positions in the honeycomb ring are schematic, not boundaries.

Run `node scripts/check-map-scope.mjs`, the three new test files, and TypeScript. The added PR workflow checks dependency scope and integrity tests; it is not a screenshot test or a protected-branch requirement. No Google Maps, Cesium or 3D dependencies. No redesign. Report actual failures with the node/record id, expected window and observed result.

## Release decision

Codex owns the code/test handoff; the named Abacus integration owner must return the acceptance evidence above. Bazil owns the final release decision. Production is not changed by pushing a PR. Enable intake only after preview checks, migration target review and an agreed retention/moderation process. Public publication, precise incident geocoding, attachment sanitisation, reviewer console and restricted biodiversity ingestion are separate work; none is implied by this private intake.

Rollback: disable COMMUNITY_REPORTS_ENABLED to stop intake; retain submitted rows. Revert UI/application changes only after reviewing schema compatibility. Do not drop the additive table or delete reports as rollback. For port source controls, restore reviewed coverage rather than re-enabling unreviewed seed writes.

## Local verification and limits

Eight focused tests cover source metadata rejection, precision, shared replay access windows, input validation, forged promotion fields, seed quarantine and a PGlite execution of migration 0004 preserving a baseline value and enforcing private/pending/retry constraints. TypeScript and map dependency scope pass. Real authenticated API/database integration, browser scrub smoothness, GitHub Actions completion and deployment remain acceptance gates; local tests do not prove them.
