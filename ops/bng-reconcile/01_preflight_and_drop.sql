-- BNG reconciliation — PREFLIGHT + GUARDED DROP (production)
-- PREPARED, NOT EXECUTED. Run only after a confirmed production snapshot.
-- Single transaction: if either obligation table is non-empty, the DO block
-- RAISEs and the whole transaction rolls back BEFORE any DROP occurs.
-- Drops the child (Revision) first, then the parent (Obligation). Plain DROP
-- TABLE (no CASCADE): if any unexpected dependency exists it errors and aborts,
-- rather than silently cascading.

BEGIN;

DO $$
DECLARE
  o_count integer;
  r_count integer;
BEGIN
  SELECT count(*) INTO o_count FROM "PrivateCaseObligation";
  SELECT count(*) INTO r_count FROM "PrivateCaseObligationRevision";

  RAISE NOTICE 'PREFLIGHT row counts -> PrivateCaseObligation=%, PrivateCaseObligationRevision=%', o_count, r_count;

  -- assert PrivateCaseObligation = 0
  IF o_count <> 0 THEN
    RAISE EXCEPTION 'ABORT: PrivateCaseObligation has % row(s), expected 0. No tables dropped.', o_count;
  END IF;

  -- assert PrivateCaseObligationRevision = 0
  IF r_count <> 0 THEN
    RAISE EXCEPTION 'ABORT: PrivateCaseObligationRevision has % row(s), expected 0. No tables dropped.', r_count;
  END IF;
END $$;

-- Only reached when both asserts passed.
DROP TABLE "PrivateCaseObligationRevision";   -- child first
DROP TABLE "PrivateCaseObligation";           -- parent second

COMMIT;
