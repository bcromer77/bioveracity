import { createHash, randomUUID } from 'node:crypto'
import { isAdmin } from '../access'
import type { Database, Sql } from '../workspaces/service'
import { HubError, record, text, type Snapshot } from './domain'
type Review = {
  id: string; hubId: string; submittedBy: string; revision: number; snapshot: Snapshot
  status: string; reason: string; ownerId: string; currentRevision: number
}
const selection = 'r.*, h."ownerId", h."revision" AS "currentRevision"'
export function reviewService(db: Database, actorId: string) {
  async function requireReviewer(sql: Sql) {
    if (!actorId) throw new HubError(401, 'Please sign in.')
    // Refresh permissions from the database; a stale JWT must not retain review access.
    const [user] = await sql.query<{ id: string; role: string; accessState: string }>(
      'SELECT "id","role","accessState" FROM "User" WHERE "id"=$1', [actorId])
    if (!user || !isAdmin({ user, expires: '' }))
      throw new HubError(403, 'Administrator access required.')
  }
  async function pending(sql: Sql, id: string, lock = false) {
    const [review] = await sql.query<Review>(
      `SELECT ${selection} FROM "WildHubReview" r JOIN "WildHub" h ON h."id"=r."hubId" WHERE r."id"=$1${lock ? ' FOR UPDATE OF h,r' : ''}`, [id])
    if (!review) throw new HubError(404, 'Review not found.')
    if (review.ownerId === actorId) throw new HubError(403, 'Another administrator must review your own hub.')
    if (review.status !== 'PENDING' || review.revision !== review.currentRevision)
      throw new HubError(409, 'This submission changed or was already reviewed. Reload the queue.')
    return review
  }
  return {
    async list(page = 0) {
      await requireReviewer(db)
      const offset = Math.max(0, Math.min(100000, Number.isFinite(page) ? Math.floor(page) : 0)) * 20
      const reviews = await db.query<Review>(
        `SELECT ${selection} FROM "WildHubReview" r JOIN "WildHub" h ON h."id"=r."hubId"
         WHERE r."status"='PENDING' AND r."revision"=h."revision" AND h."ownerId"<>$1
         ORDER BY r."createdAt",r."id" LIMIT 20 OFFSET $2`, [actorId, offset])
      const [storage] = await db.query<{ count: number; bytes: string }>(
        'SELECT count(*)::int AS count, COALESCE(sum(octet_length("bytes")),0)::text AS bytes FROM "WildHubPhoto"', [])
      const items = await Promise.all(reviews.map(async review => {
        const photos = await db.query<{ id: string; caption: string; credit: string }>(
          'SELECT "id","caption","credit" FROM "WildHubPhoto" WHERE "hubId"=$1', [review.hubId])
        return { ...review, photos: photos.filter(p => review.snapshot.photoIds.includes(p.id)) }
      }))
      return { reviews: items, storage }
    },
    async photo(id: string, photoId: string) {
      await requireReviewer(db)
      const review = await pending(db, id)
      if (!review.snapshot.photoIds.includes(photoId)) throw new HubError(404, 'Photo not found.')
      const [photo] = await db.query<{ bytes: Uint8Array; caption: string; credit: string }>(
        'SELECT "bytes","caption","credit" FROM "WildHubPhoto" WHERE "id"=$1 AND "hubId"=$2', [photoId, review.hubId])
      if (!photo) throw new HubError(404, 'Photo not found.')
      return photo
    },
    async decide(id: string, raw: unknown) {
      const input = record(raw)
      if (!['approve','reject'].includes(String(input.action))) throw new HubError(400, 'Choose a review decision.')
      if (input.confirmed !== true) throw new HubError(400, 'Read the submitted material and confirm your review.')
      const reason = text(input.reason, 2000)
      return db.transaction(async sql => {
        await requireReviewer(sql)
        const review = await pending(sql, id, true)
        if (input.revision !== review.revision) throw new HubError(409, 'Reload the current submission.')
        const approve = input.action === 'approve'
        if (approve) {
          // The seasonal plan is optional. Only validate the year when one exists.
          if (review.snapshot.plan) {
            const year = new Date().getUTCFullYear()
            if (review.snapshot.plan.year < year || review.snapshot.plan.year > year + 1)
              throw new HubError(409, 'The owner must submit a plan for this year or next year.')
          }
          const available = await sql.query<{ id: string }>('SELECT "id" FROM "WildHubPhoto" WHERE "hubId"=$1', [review.hubId])
          if (review.snapshot.photoIds.some(id => !available.some(p => p.id === id)))
            throw new HubError(409, 'A submitted photo is no longer available.')
          const snapshot = { ...review.snapshot, version: review.currentRevision + 1, reviewedAt: new Date().toISOString() }
          const encoded = JSON.stringify(snapshot)
          await sql.query('UPDATE "WildHub" SET "published"=$1::jsonb,"revision"="revision"+1,"updatedAt"=now() WHERE "id"=$2',
            [encoded, review.hubId])
          await sql.query('INSERT INTO "WildHubPublication" ("id","hubId","actorId","action","snapshot","hash") VALUES ($1,$2,$3,$4,$5::jsonb,$6)',
            [randomUUID(), review.hubId, actorId, 'PUBLISH', encoded, createHash('sha256').update(encoded).digest('hex')])
        }
        await sql.query('UPDATE "WildHubReview" SET "status"=$1,"reviewedBy"=$2,"reason"=$3,"reviewedAt"=now() WHERE "id"=$4',
          [approve ? 'APPROVED' : 'REJECTED', actorId, reason, id])
        return { status: approve ? 'APPROVED' : 'REJECTED', hubId: review.hubId }
      })
    },
  }
}
