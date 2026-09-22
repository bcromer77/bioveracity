-- Additive repair for schema/migration drift discovered during PR 75 QA.
-- The Prisma Event model already requires datePrecision; historical databases
-- created before that field existed may not contain the backing column.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "datePrecision" TEXT;

UPDATE "Event"
SET "datePrecision" = 'day'
WHERE "datePrecision" IS NULL;

ALTER TABLE "Event"
  ALTER COLUMN "datePrecision" SET DEFAULT 'day',
  ALTER COLUMN "datePrecision" SET NOT NULL;
