-- Identity & Trust: append-only audit of administrator grants.
--
-- STATUS: NOT DEPLOYED. Additive only: one new table, one index, one trigger
-- function and one trigger. Alters no existing table, column or constraint.
-- Contains no secret material (no password, hash, token or code columns).
-- No foreign key to "User": the record must outlive account erasure, so userId
-- and email are stored as a snapshot.

CREATE TABLE IF NOT EXISTS "AdminGrantAudit" (
  "id"                   TEXT NOT NULL,
  "action"               TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "email"                TEXT NOT NULL,
  "operator"             TEXT NOT NULL,
  "authorisedBy"         TEXT NOT NULL,
  "reason"               TEXT NOT NULL,
  "beforeRole"           TEXT NOT NULL,
  "beforeAccessState"    TEXT NOT NULL,
  "beforeAuthVersion"    INTEGER NOT NULL,
  "afterRole"            TEXT NOT NULL,
  "afterAccessState"     TEXT NOT NULL,
  "afterAuthVersion"     INTEGER NOT NULL,
  "verifiedAdminsBefore" INTEGER NOT NULL,
  "grantedAt"            TIMESTAMP(3) NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminGrantAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AdminGrantAudit_userId_idx" ON "AdminGrantAudit"("userId");

-- Append-only: rows may be inserted but never updated or deleted.
CREATE OR REPLACE FUNCTION "admin_grant_audit_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AdminGrantAudit is append-only';
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'AdminGrantAudit_append_only') THEN
    CREATE TRIGGER "AdminGrantAudit_append_only" BEFORE UPDATE OR DELETE ON "AdminGrantAudit"
      FOR EACH ROW EXECUTE FUNCTION "admin_grant_audit_append_only"();
  END IF;
END $$;
