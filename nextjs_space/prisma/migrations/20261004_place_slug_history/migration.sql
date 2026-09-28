-- Place Experience PR B (gate G-SLUG) — additive canonical Place slug history.
--
-- A slug is a public locator only. Identity stays on the immutable "Asset".id
-- (the Place ID). Nothing else may be keyed by slug. This migration creates one
-- new table, its indexes, checks and a row-guard trigger. It alters no existing
-- table or column, inserts no rows and performs no backfill.

CREATE TABLE "PlaceSlug" (
    "slug" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),

    -- Primary key on slug = global collision protection across current AND
    -- retired slugs: a retired slug can never be claimed by another Place.
    CONSTRAINT "PlaceSlug_pkey" PRIMARY KEY ("slug"),
    CONSTRAINT "PlaceSlug_slug_format_check"
      CHECK (char_length("slug") BETWEEN 1 AND 80 AND "slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT "PlaceSlug_placeId_format_check"
      CHECK ("placeId" ~ '^bv_place_[a-z0-9_]{1,120}$'),
    CONSTRAINT "PlaceSlug_retired_after_created_check"
      CHECK ("retiredAt" IS NULL OR "retiredAt" >= "createdAt")
);

CREATE INDEX "PlaceSlug_placeId_idx" ON "PlaceSlug"("placeId");

-- Exactly one current (canonical) slug per Place, enforced under concurrency.
CREATE UNIQUE INDEX "PlaceSlug_one_current_per_place" ON "PlaceSlug"("placeId") WHERE "retiredAt" IS NULL;

-- RESTRICT on update as well as delete: while a Place has slug history its
-- Asset.id cannot be changed or the Asset deleted underneath its locators.
ALTER TABLE "PlaceSlug" ADD CONSTRAINT "PlaceSlug_placeId_fkey"
  FOREIGN KEY ("placeId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- History rows are append-only locators: slug, placeId and createdAt never
-- change and rows are never deleted. Only retiredAt may move (retire/reinstate).
CREATE FUNCTION "PlaceSlug_guard"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'place_slug_history_immutable' USING ERRCODE = '23000';
  END IF;
  IF NEW."slug" IS DISTINCT FROM OLD."slug"
     OR NEW."placeId" IS DISTINCT FROM OLD."placeId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'place_slug_history_immutable' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "PlaceSlug_guard_trigger"
  BEFORE UPDATE OR DELETE ON "PlaceSlug"
  FOR EACH ROW EXECUTE FUNCTION "PlaceSlug_guard"();
