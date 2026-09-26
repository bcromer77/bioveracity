# BNG migration reconciliation — PREPARED, NOT EXECUTED

These files stage the production reconciliation agreed after the read-only audit.
**Nothing here has been run. No production write, migration, drop, push or deploy has occurred.**

## Why
Production `3e9a3890e_preview` has two BNG tables (`PrivateCaseObligation`,
`PrivateCaseObligationRevision`) that were created out-of-band, are **empty (0 rows)**,
and carry the WRONG foreign key (`evidenceCheckId` -> global `EvidenceCheckRecord`
instead of the case-scoped `PrivateCaseEvidenceCheck`). Because migration
`20260923_bng_obligations` uses `CREATE TABLE IF NOT EXISTS`, a plain
`migrate deploy` would SKIP them and leave the cross-case provenance hole open.

The fix drops the two empty, structurally-wrong tables so the migration can
recreate all three tables correctly, then deploys.

## Preconditions already satisfied (local, no DB write)
- `20260917_register_interest` restored verbatim into `feat/bng-evidence-record`
  (checksum `daeb1b55...0c95` MATCHES production `_prisma_migrations`).
- `prisma migrate status`: last common = `20260922_account_recovery`; pending =
  `20260923_bng_obligations`, `20260930_event_date_precision`; only rolled-back
  `20260914_wild_editorial_review` remains "not found locally" (intentionally NOT restored).

## Execution order (only when authorised)
1. Take a production DB snapshot (Settings -> Database -> snapshots). Record its id.
2. `SNAPSHOT_ID="<id>" bash ops/bng-reconcile/run.sh`
   - runs `01_preflight_and_drop.sql` (asserts both tables = 0 rows, else aborts BEFORE any drop; drops Revision then Obligation)
   - runs `prisma migrate deploy`
   - runs `03_postverify.sql` + `prisma migrate status`
3. Review every PASS/FAIL.

## Guarantees
- No `--accept-data-loss`, no `migrate reset`, no `--force`.
- Drops are guarded: a non-zero row count aborts the transaction before any DROP.
- Only empty, structurally-wrong tables are dropped; no data is destroyed.
- The rolled-back `20260914_wild_editorial_review` stray is left untouched.
