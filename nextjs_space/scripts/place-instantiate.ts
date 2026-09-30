// Local/test only: instantiate a reviewed Place manifest into a disposable DB.
// Usage: PLACE_INSTANTIATE_DATABASE_URL=postgresql://...@127.0.0.1:PORT/db \
//   yarn tsx scripts/place-instantiate.ts <placeId> [--enable-listening]
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
    console.log(JSON.stringify(out))
  } finally { await prisma.$disconnect() }
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
