#!/usr/bin/env bash
# BNG reconciliation orchestrator — PREPARED, NOT EXECUTED.
# Nothing here runs until an operator invokes it deliberately with an explicit
# snapshot confirmation. Do NOT wire this into CI/deploy.
#
# Order (as agreed):
#   1. production backup/snapshot confirmation (hard gate)
#   2. immediate preflight row counts + assert obligation/revision = 0 (STOP if not)
#   3. drop PrivateCaseObligationRevision first, PrivateCaseObligation second
#   4. standard migration deployment (prisma migrate deploy)
#   5. post-migration structural verification
#
# Usage (only when authorised):
#   SNAPSHOT_ID="<platform-snapshot-id-or-timestamp>" bash ops/bng-reconcile/run.sh
#
# DATABASE_URL is read from nextjs_space/.env by prisma / psql; it is NEVER
# printed by this script.

set -euo pipefail
cd "$(dirname "$0")/../../nextjs_space"

# ---- 1. Backup / snapshot confirmation (hard gate) --------------------------
if [ -z "${SNAPSHOT_ID:-}" ]; then
  echo "STOP: SNAPSHOT_ID is not set."
  echo "Take a production database snapshot first (Settings -> Database -> snapshots"
  echo "in the Abacus console), then re-run with SNAPSHOT_ID set to its id/timestamp."
  exit 1
fi
echo "Backup/snapshot confirmed by operator: ${SNAPSHOT_ID}"

# Load DATABASE_URL without echoing it.
set -a; . ./.env; set +a

# ---- 2+3. Preflight asserts + guarded drops (single transaction) -----------
echo "Running preflight + guarded drop (transaction aborts before any drop if rows != 0)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../ops/bng-reconcile/01_preflight_and_drop.sql

# ---- 4. Standard migration deployment --------------------------------------
echo "Deploying migrations (prisma migrate deploy)..."
yarn prisma migrate deploy

# ---- 5. Post-migration structural verification -----------------------------
echo "Post-migration verification..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f ../ops/bng-reconcile/03_postverify.sql

echo "Migrate status (expect no unexpected pending; only rolled-back 20260914 stray may remain):"
yarn prisma migrate status

echo "DONE. Review every PASS/FAIL above before declaring reconciliation complete."
