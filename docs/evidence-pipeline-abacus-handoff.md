# Connect council evidence to BioVeracity

## Actual delivery state

The pipeline adds application intake, retained document versions, source-passage review and withdrawal audit. The follow-on registered search change adds full-text and vector evidence search: see [registered-vector-search-handoff.md](registered-vector-search-handoff.md) for its configuration, indexing job, access rules and deployment gates. The pipeline also fixes incoming automatic claim verification based only on a URL/identifier and event-date fallback in the legacy ingest path. Neither change deploys itself, activates a persistent scheduler or proves national source coverage.

GitHub issue #3 tracks integrity fixes; #4 tracks operational coverage. Preserve the current hardened v20 application. Draft PRs #1 and #2 contain the council register and Python collector/honeycomb work. This bridge is based on main and can accept the existing research JSON archive without those branches; `pipeline.run_once` requires the reviewed collector from PR #2. Reconcile those changes before enabling a scheduled collector.

## What becomes searchable

1. Collector or research archive supplies HTTPS source identity, council ID, publication date, event date and precision, retrieval timestamp, and located source sections.
2. `POST /api/ingest/evidence` authenticates a dedicated key and stores a version as `PENDING_REVIEW`. It never trusts submitted verification/access flags. It does not fetch an arbitrary submitted URL.
3. An identified admin opens the actual source at `/admin/evidence`, supplies a checked claim, exact excerpt, locator, evidence type and review explanation, and confirms permitted publication. The server checks that the excerpt matches retained text and records the reviewer/time. Matching text alone is not automatic semantic verification.
4. The approved claim appears in keyword evidence search immediately through a database query. No separate manual website copy is required. Registered account access is enforced before reading source passages. The follow-on search change shows evidence alongside place results and indexes newly reviewed claims for meaning-based retrieval through its bounded scheduled worker.
5. A substantive new source version hides the older verified version from current search until reviewed. Admins can reopen a document by ID to correct or withdraw a claim; previous review rows remain retained.

“Verified by BioVeracity” applies to the specific checked claim, not the entire source, environmental causation, independent measurement certification, or the truth of every operator/community statement. New collection remains private. Unknown event dates remain unknown; year/month precision remains visible. Date-range filters intentionally exclude unknown/coarse event dates.

## Abacus execution handoff

Use the existing BioVeracity app; do not create a replacement website.

1. Fetch the bridge branch and inspect its PR, plus #1 and #2. Reconcile against the current deployed commit. Identify the actual Abacus deployment command, production database and rollback/checkpoint mechanism before a production release.
2. Install application dependencies in an isolated staging checkout. Run `npx prisma generate`, `npm run typecheck`, `npm run test:evidence`; from repository root run `python -m unittest pipeline.test_delivery -v`. Never run the application's seed scripts against production.
3. Use a separate staging PostgreSQL database. Inspect migration state with `npx prisma migrate status`. The additive `0001_evidence_pipeline` migration creates two tables only. Existing installations must establish their actual `0000_init` baseline before `migrate deploy`; do not execute the initial migration blindly against populated tables or mark it applied without checking schema equivalence. Apply the new migration in staging first.
4. Generate a random dedicated key of at least 32 characters in secret settings. Set `BIOVERACITY_EVIDENCE_INGEST_KEY` on both the Next.js server and collection runtime. Never paste the key into a PR, log, chat or browser bundle. Enable `BIOVERACITY_EVIDENCE_ENABLED=true` in staging after migration. Use separate staging/production keys and receipt stores.
5. Test one real public council source with permitted reuse. Deliver it to staging using the commands below. Confirm an acknowledged document ID, a private pending record, a valid admin review, a searchable claim with correct source/date, no results for an unauthorised user, no duplicate version on retry, and suppression after a changed unreviewed version. Test admin withdrawal. Record source URL, document ID and results; synthetic fixtures are not environmental evidence.
6. Configure a persistent collection runtime with private persistent disk, backups, Python/PDF dependencies and an hourly scheduler. Its environment is in `pipeline/.env.example`; choose real absolute paths. `python -m pipeline.run_once` takes a process lock, runs the existing bounded collector and delivers current versions with persistent receipts. Inspect real success/failure counts. A failed source is not an empty successful scan. Confirm behaviour on restart and a second scheduled run.
7. Before live release, record the deploy route and rollback. Take the actual platform checkpoint and database backup. Apply the reviewed additive migration using the established baseline and deploy through the confirmed route. Set the live canonical endpoint and live secret; repeat the real source-to-search checks. Only then describe live population as connected.
8. Rollback: disable the collector schedule and set `BIOVERACITY_EVIDENCE_ENABLED=false`; revoke its dedicated key if needed. Restore the previous application checkpoint through the confirmed Abacus mechanism. Keep evidence/audit tables and persistent collection state; do not drop history as rollback. Ensure legacy verification/date fixes are retained or incoming legacy publication is paused while reverting.

## Commands for the persistent runtime

From repository root, with credentials supplied by secret settings:

```sh
# Import a current materialised copy of the research archive into the review queue:
python -m pipeline.deliver_evidence --records /absolute/path/BioVeracity-council-collection.json --receipts /private/persistent/delivery-receipts.sqlite

# Deliver current versions already held by the collector:
python -m pipeline.deliver_evidence --store /private/persistent/councils.sqlite --receipts /private/persistent/delivery-receipts.sqlite

# Collect and deliver a bounded batch (requires PR #2 collector/config):
python -m pipeline.run_once
```

The ChatGPT research archive does not automatically materialise itself into Abacus. Use the collector directly in its persistent runtime, or establish an explicit authenticated archive-transfer job. Never claim that an hourly ChatGPT research task is this server process.

`BIOVERACITY_EVIDENCE_ENDPOINT` must be the canonical HTTPS `/api/ingest/evidence` URL; redirects are refused to protect the key. Intake bounds records to 1 MB and retained source text to 500,000 characters. Oversized sources need reviewed splitting with distinct representation IDs. Reuse existing receipt state after restart. Successful acknowledgement means private intake, not verification or publication.

## Coverage and search limits

The draft register lists 413 principal councils (317 England, 32 Scotland, 22 Wales, 11 Northern Ireland, 31 Republic of Ireland), plus 15 separately classified strategic authorities. These are directory identities, not 413 live adapters. The 417 requested total remains unreconciled; do not pad the directory to fit it. Track reorganisations and effective dates against current official lists. The collector currently has four configured pilot source groups; other council endpoints/pagination need validation and an honest per-council coverage ledger.

Source checks on 8 September 2026: the England government guidance still states 317, but is labelled last updated April 2023; this alone is not certification of every council's current legal status. See https://www.gov.uk/guidance/local-government-structure-and-elections, https://www.gov.scot/policies/local-government/, https://www.nidirect.gov.uk/articles/local-councils, https://www.localgov.ie/find-my-local-authority and the source manifest in PR #1. Preserve proposed/shadow/successor authorities separately.

The follow-on [registered search handoff](registered-vector-search-handoff.md) adds model-isolated PostgreSQL vector + full-text retrieval with council/date filters and up to 30 current reviewed results. It does not import the raw private SQLite index from PR #2. No live embedding service was called in local validation. Real-source retrieval evaluation, typed source-backed place/river/port relations, national-scale performance and exhaustive pagination remain to be completed. Do not label similarity a verification score.

## Validation performed in this change

- Prisma Client generation and explicit application TypeScript check passed (including repository TypeScript scripts).
- Ten TypeScript/SQL tests passed: intake trust boundaries, version identity, unsupported verification, exact source review, dates, legacy date fallback, key/body limits, ambiguous identifiers, HTTP access gating and actual search SQL.
- Four Python delivery tests passed: acknowledged retry, failed delivery retry, changed content and insecure endpoint rejection. Python compilation passed.
- SQL tests use PostgreSQL-compatible PGlite with synthetic fixtures. They run the application's parameterised search query and additive migration; they do not exercise a live Abacus database, its migration history, Prisma transaction concurrency, HTTP collector delivery, browser layout, or production deployment.
- Existing production claims have not been reclassified or corrected. A separate read-only audit must identify legacy automatic-verification/date-fallback records before any auditable correction.

Completion evidence still required: actual Abacus release/rollback route, staging/live source-to-search run, persistent scheduled worker execution and restart, all intended source adapters, and evaluated live vector retrieval. A GitHub commit or successful test suite alone does not establish these.
