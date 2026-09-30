// Local/test only: instantiate a reviewed Place manifest into a disposable DB.
// Usage: PLACE_INSTANTIATE_DATABASE_URL=postgresql://...@127.0.0.1:PORT/db \
//   yarn tsx scripts/place-instantiate.ts <placeId> [--enable-listening]
//   [--enable-observation --map-centre=<lat>,<lng>]   (PILOT-001 NE demo, local only)
// Refuses any non-loopback host so it can never reach a hosted database.
import { PrismaClient } from '@prisma/client'
import { placeManifestFor } from '@/data/places'
import { instantiateManifestPlace } from '@/lib/place-memory/instantiate-manifest'
import type { Database, Sql } from '@/lib/workspaces/service'

async function main() {
  const url = process.env.PLACE_INSTANTIATE_DATABASE_URL ?? ''
  const host = (() => { try { return new URL(url).hostname } catch { return '' } })()
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('place_instantiate:loopback_database_required')
  const placeId = process.argv[2]
  const manifest = placeId ? placeManifestFor(placeId) : null
  if (!manifest) throw new Error('place_instantiate:unknown_place_manifest')
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  type Client = Pick<PrismaClient, '$queryRawUnsafe'>
  const sql = (c: Client): Sql => ({ query: async <T>(q: string, v: unknown[]) => (await c.$queryRawUnsafe(q, ...v)) as T[] })
  const db: Database = { ...sql(prisma), transaction: (fn) => prisma.$transaction((tx) => fn(sql(tx as Client))) }
  try {
    const out = await instantiateManifestPlace(db, manifest, { enableListening: process.argv.includes('--enable-listening') })
    let observationEnabled = false
    if (process.argv.includes('--enable-observation')) {
      const centre = process.argv.find((a) => a.startsWith('--map-centre='))?.slice(13).split(',').map(Number)
      const [lat, lng] = centre && centre.length === 2 && centre.every(Number.isFinite) ? centre : [null, null]
      await db.query('INSERT INTO "PlaceParticipation" ("placeId","observationEnabledAt","mapCentreLat","mapCentreLng") VALUES ($1,now(),$2::float8,$3::float8) ON CONFLICT ("placeId") DO UPDATE SET "observationEnabledAt"=COALESCE("PlaceParticipation"."observationEnabledAt",now()),"mapCentreLat"=$2::float8,"mapCentreLng"=$3::float8,"updatedAt"=now()', [out.placeId, lat, lng])
      observationEnabled = true
    }
    console.log(JSON.stringify({ ...out, observationEnabled }))
  } finally { await prisma.$disconnect() }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
