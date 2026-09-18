import { getWildVenue } from '../wild-counties/venues'
import { enabled, hubDb } from './http'
import { publicHub } from './service'
export async function getPublishedHub(id: string) {
  if (
    !enabled() ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    return null
  return publicHub(hubDb, id)
}
export async function hasPublicVenue(id: string) {
  return Boolean(getWildVenue(id) || (await getPublishedHub(id)))
}

export type PublishedHubResult = {
  id: string
  name: string
  county: string
  story: string
}

export async function searchPublishedHubs(
  query: string,
): Promise<PublishedHubResult[]> {
  if (!enabled()) return []
  const needle = query.trim().toLocaleLowerCase('en-IE')
  if (!needle) return []
  const like = `%${needle.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
  const rows = await hubDb.query<{
    id: string
    name: string | null
    county: string | null
    story: string | null
  }>(
    `SELECT "id",
            "published"->'profile'->>'name'   AS name,
            "published"->'profile'->>'county' AS county,
            "published"->'profile'->>'story'  AS story
     FROM "WildHub"
     WHERE "published" IS NOT NULL
       AND (
         lower("published"->'profile'->>'name')   LIKE $1 ESCAPE '\\'
         OR lower("published"->'profile'->>'county') LIKE $1 ESCAPE '\\'
         OR lower("published"->'profile'->>'story')  LIKE $1 ESCAPE '\\'
       )
     ORDER BY "published"->'profile'->>'name'
     LIMIT 24`,
    [like],
  )
  return rows
    .filter((r) => r.name)
    .map((r) => ({
      id: r.id,
      name: r.name as string,
      county: r.county ?? '',
      story: r.story ?? '',
    }))
}
