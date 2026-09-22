import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const migration = readFileSync(
  new URL('../prisma/migrations/20260930_event_date_precision/migration.sql', import.meta.url),
  'utf8',
)

test('Event datePrecision migration backfills existing rows and is safe to re-run', async () => {
  const pg = new PGlite()
  try {
    await pg.exec(`
      CREATE TABLE "Event" (
        id TEXT PRIMARY KEY,
        "assetId" TEXT NOT NULL,
        title TEXT NOT NULL,
        date TIMESTAMPTZ NOT NULL,
        "eventType" TEXT NOT NULL,
        "evidenceClass" TEXT NOT NULL,
        "changeType" TEXT NOT NULL DEFAULT 'event',
        verified BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO "Event" (id, "assetId", title, date, "eventType", "evidenceClass")
      VALUES ('event-1', 'asset-1', 'Existing event', now(), 'environmental', 'O');
    `)

    await pg.exec(migration)

    const column = await pg.query<{
      is_nullable: string
      column_default: string | null
    }>(`
      SELECT is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Event'
        AND column_name = 'datePrecision'
    `)

    assert.equal(column.rows.length, 1)
    assert.equal(column.rows[0].is_nullable, 'NO')
    assert.match(column.rows[0].column_default ?? '', /day/)

    const row = await pg.query<{ datePrecision: string }>(
      'SELECT "datePrecision" FROM "Event" WHERE id=$1',
      ['event-1'],
    )
    assert.equal(row.rows[0].datePrecision, 'day')

    await pg.exec(migration)

    const after = await pg.query<{ count: number }>(
      'SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name=\'Event\' AND column_name=\'datePrecision\'',
    )
    assert.equal(after.rows[0].count, 1)
  } finally {
    await pg.close()
  }
})
