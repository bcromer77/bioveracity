import { auth } from '@/auth'
import type { Sql } from '../workspaces/service'
import { isAdmin } from '../access'
import { getWildCounty } from '../wild-counties/counties'
import { buildEdition, type EditionView } from './edition'
import type { Plan, Profile } from './domain'
import { enabled, hubDb } from './http'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

// Build the private draft preview an owner (or an admin) may view before anything
// is published. Returns null — never throws — for anyone who may not see it, so the
// route can simply 404. Split from loadPreviewEdition so it is testable with a
// plain Sql client.
export async function previewEdition(
  sql: Sql,
  viewerId: string | null,
  id: string,
): Promise<EditionView | null> {
  if (!viewerId || !UUID.test(id)) return null
  const [row] = await sql.query<{ ownerId: string; profile: Profile; plan: Plan | null }>(
    'SELECT "ownerId","profile","plan" FROM "WildHub" WHERE "id"=$1',
    [id],
  )
  if (!row) return null
  if (row.ownerId !== viewerId) {
    const [user] = await sql.query<{ id: string; role: string; accessState: string }>(
      'SELECT "id","role","accessState" FROM "User" WHERE "id"=$1',
      [viewerId],
    )
    if (!user || !isAdmin({ user, expires: '' } as never)) return null
  }
  const photos = await sql.query<{ id: string; caption: string; credit: string }>(
    'SELECT "id","caption","credit" FROM "WildHubPhoto" WHERE "hubId"=$1 ORDER BY "createdAt","id"',
    [id],
  )
  // Show exactly the photographs the partner curated — the same selection that
  // submission and publication use. Undefined means every photograph.
  const selection = row.profile.photoIds
  const chosen = photos.filter((p) => !selection || selection.includes(p.id))
  const county = getWildCounty(row.profile.county)
  return buildEdition({
    kind: 'preview',
    profile: row.profile,
    plan: row.plan,
    photos: chosen.map((p) => ({ ...p, src: `/api/wild/photos/${p.id}` })),
    countyBrand: county?.brandName || row.profile.county,
    provenanceLabel:
      'Private preview — this is how your Wild Counties page will look once published. Nothing here is published yet. Business identity and environmental performance are not certified by BioVeracity.',
  })
}

export async function loadPreviewEdition(id: string): Promise<EditionView | null> {
  if (!enabled()) return null
  const session = await auth()
  return previewEdition(hubDb, session?.user?.id ?? null, id)
}
