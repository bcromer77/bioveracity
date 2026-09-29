-- Place Experience PR E (gate G-ACCESS) — additive Place Access Points.
--
-- An access point is an opaque public LOCATOR (ADR-0001 §2): /p/{publicAccessId}
-- resolves to the immutable Place ID ("Asset".id) and then to the Place's current
-- canonical slug. The identifier encodes nothing (no DB identity, tenant,
-- permission or geography). This migration creates one new table, its indexes,
-- checks and row/statement guard triggers. It alters no existing table or
-- column, inserts no rows and performs no backfill.

-- CreateTable
CREATE TABLE "PlaceAccessPoint" (
    "id" SERIAL NOT NULL,
    "publicAccessId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "PlaceAccessPoint_pkey" PRIMARY KEY ("id"),
    -- 22 base62 characters (>= 128 bits of entropy); nothing else is admitted.
    CONSTRAINT "PlaceAccessPoint_publicAccessId_format_check"
      CHECK ("publicAccessId" ~ '^[0-9A-Za-z]{22}$'),
    CONSTRAINT "PlaceAccessPoint_placeId_format_check"
      CHECK ("placeId" ~ '^bv_place_[a-z0-9_]{1,120}$'),
    CONSTRAINT "PlaceAccessPoint_revoked_after_created_check"
      CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlaceAccessPoint_publicAccessId_key" ON "PlaceAccessPoint"("publicAccessId");

-- CreateIndex
CREATE INDEX "PlaceAccessPoint_placeId_idx" ON "PlaceAccessPoint"("placeId");

-- AddForeignKey (exactly as Prisma generates for onDelete: Restrict). An
-- "Asset".id change would cascade into "placeId", which the guard below refuses,
-- so a Place with access points can neither be deleted nor re-identified.
ALTER TABLE "PlaceAccessPoint" ADD CONSTRAINT "PlaceAccessPoint_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Access points are never deleted (so an identifier is never reused), never
-- re-pointed and never re-keyed. The only permitted change is a single
-- revocation: revokedAt NULL -> timestamp. Once set it can be neither cleared
-- (no un-revocation) nor moved.
CREATE FUNCTION "PlaceAccessPoint_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'place_access_point_never_deleted' USING ERRCODE = '23000';
  END IF;
  IF NEW."publicAccessId" IS DISTINCT FROM OLD."publicAccessId" THEN
    RAISE EXCEPTION 'place_access_point_id_immutable' USING ERRCODE = '23000';
  END IF;
  IF NEW."placeId" IS DISTINCT FROM OLD."placeId" THEN
    RAISE EXCEPTION 'place_access_point_place_immutable' USING ERRCODE = '23000';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'place_access_point_row_immutable' USING ERRCODE = '23000';
  END IF;
  IF OLD."revokedAt" IS NOT NULL AND NEW."revokedAt" IS DISTINCT FROM OLD."revokedAt" THEN
    RAISE EXCEPTION 'place_access_point_revocation_final' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PlaceAccessPoint_guard_trigger"
  BEFORE UPDATE OR DELETE ON "PlaceAccessPoint"
  FOR EACH ROW EXECUTE FUNCTION "PlaceAccessPoint_guard"();

CREATE FUNCTION "PlaceAccessPoint_no_truncate"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'place_access_point_never_deleted' USING ERRCODE = '23000';
END;
$$;

CREATE TRIGGER "PlaceAccessPoint_no_truncate_trigger"
  BEFORE TRUNCATE ON "PlaceAccessPoint"
  FOR EACH STATEMENT EXECUTE FUNCTION "PlaceAccessPoint_no_truncate"();
