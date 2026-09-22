import { releaseInput, RELEASE_CORE, RELEASE_VENUE, RELEASE_BIO, RELEASE_LIMITS, type ReleaseInput } from '../venue-journal/release'
import { randomUUID } from 'node:crypto'
import type { Database, Sql } from '../workspaces/service'
import {
  HubError,
  profileInput,
  record,
  text,
  generatePlan,
  parseTrends,
  editCampaigns,
  type Profile,
  type Plan,
  type Trend,
  type Snapshot,
} from './domain'
export type HubRow = {
  id: string
  ownerId: string
  profile: Profile
  plan: Plan | null
  trend: Trend | null
  published: Snapshot | null
  revision: number
  updatedAt: Date
}
export type Photo = { id: string; caption: string; credit: string }
const columns =
  '"id","ownerId","profile","plan","trend","published","revision","updatedAt"'
export function hubService(db: Database, ownerId: string) {
  if (!ownerId) throw new HubError(401, 'Please sign in.')
  async function owned(sql: Sql, id: string, lock = false): Promise<HubRow> {
    const rows = await sql.query<HubRow>(
      `SELECT ${columns} FROM "WildHub" WHERE "id"=$1 AND "ownerId"=$2${lock ? ' FOR UPDATE' : ''}`,
      [id, ownerId],
    )
    if (!rows.length) throw new HubError(404, 'Hub not found.')
    return rows[0]
  }
  function revision(hub: HubRow, value: unknown) {
    if (value !== hub.revision)
      throw new HubError(
        409,
        'This hub changed in another tab. Reload it before making further changes.',
      )
  }
  async function photos(sql: Sql, id: string) {
    return sql.query<Photo>(
      'SELECT "id","caption","credit" FROM "WildHubPhoto" WHERE "hubId"=$1 ORDER BY "createdAt","id"',
      [id],
    )
  }
  async function result(sql: Sql, hub: HubRow) {
    const [review] = await sql.query<{ id: string; status: string; revision: number; reason: string; snapshot: Snapshot }>(
      'SELECT "id","status","revision","reason","snapshot" FROM "WildHubReview" WHERE "hubId"=$1 ORDER BY "revision" DESC LIMIT 1', [hub.id],
    )
    return { ...hub, photos: await photos(sql, hub.id), review: review ? {
      id: review.id, status: review.status === 'PENDING' && review.revision !== hub.revision ? 'SUPERSEDED' : review.status,
      reason: review.reason, photoIds: review.snapshot.photoIds,
    } : null }
  }
  return {
    async list() {
      return db.query<Pick<HubRow, 'id' | 'profile' | 'revision'>>(
        'SELECT "id","profile","revision" FROM "WildHub" WHERE "ownerId"=$1 ORDER BY "createdAt"',
        [ownerId],
      )
    },
    async get(id: string) {
      return result(db, await owned(db, id))
    },
    async create(raw: unknown) {
      const profile = profileInput(raw),
        id = text(record(raw).requestId, 36)
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        )
      )
        throw new HubError(400, 'Refresh the page before creating your hub.')
      return db.transaction(async (sql) => {
        await sql.query('SELECT "id" FROM "User" WHERE "id"=$1 FOR UPDATE', [
          ownerId,
        ])
        const previous = await sql.query<HubRow>(
          `SELECT ${columns} FROM "WildHub" WHERE "id"=$1`,
          [id],
        )
        if (previous.length) {
          const saved = previous[0],
            p = saved.profile
          if (
            saved.ownerId !== ownerId ||
            p.name !== profile.name ||
            p.story !== profile.story ||
            p.county !== profile.county ||
            p.kind !== profile.kind ||
            p.website !== profile.website ||
            JSON.stringify(p.interests) !== JSON.stringify(profile.interests)
          )
            throw new HubError(
              409,
              'This creation request was already used. Open the saved hub or start a new draft.',
            )
          return result(sql, saved)
        }
        const [count] = await sql.query<{ n: number }>(
          'SELECT count(*)::int AS n FROM "WildHub" WHERE "ownerId"=$1',
          [ownerId],
        )
        if (count.n >= 3)
          throw new HubError(
            429,
            'Three hubs per account during this release. Contact us for more locations.',
          )
        const [hub] = await sql.query<HubRow>(
          `INSERT INTO "WildHub" ("id","ownerId","profile") VALUES ($1,$2,$3::jsonb) RETURNING ${columns}`,
          [id, ownerId, JSON.stringify(profile)],
        )
        return result(sql, hub)
      })
    },
    async change(id: string, raw: unknown) {
      const input = record(raw)
      return db.transaction(async (sql) => {
        const hub = await owned(sql, id, true)
        revision(hub, input.revision)
        let profile = hub.profile,
          plan = hub.plan,
          trend = hub.trend,
          published = hub.published
        switch (input.action) {
          case 'save':
            profile = profileInput(input.profile)
            plan = null
            break
          case 'trends':
            trend = input.trends === null ? null : parseTrends(input.trends)
            plan = null
            break
          case 'generate':
            plan = generatePlan(profile, Number(input.year), trend)
            break
          case 'edit-plan':
            if (!plan)
              throw new HubError(409, 'Generate the seasonal plan first.')
            plan = editCampaigns(plan, input.campaigns)
            break
          case 'publish':
            throw new HubError(409, 'Submit this version for editorial review before publication.')
          case 'submit': {
            if (input.approved !== true || input.authorised !== true)
              throw new HubError(
                400,
                'Confirm your authority and review the content before submitting.',
              )
            if (!plan)
              throw new HubError(
                409,
                'Generate and review a seasonal plan first.',
              )
            const year = new Date().getUTCFullYear()
            if (plan.year < year || plan.year > year + 1)
              throw new HubError(
                409,
                'Refresh the plan for this year or next year.',
              )
            const available = await photos(sql, id)
            if (
              !Array.isArray(input.photoIds) ||
              input.photoIds.length > 12 ||
              new Set(input.photoIds).size !== input.photoIds.length ||
              input.photoIds.some((v) => !available.some((p) => p.id === v))
            )
              throw new HubError(400, 'Select only photos from this hub.')
            const snapshot: Snapshot = {
              profile, plan, photoIds: input.photoIds as string[],
              approvedAt: new Date().toISOString(), version: hub.revision + 1,
            }
            await sql.query(
              'INSERT INTO "WildHubReview" ("id","hubId","submittedBy","revision","snapshot") VALUES ($1,$2,$3,$4,$5::jsonb)',
              [randomUUID(), id, ownerId, hub.revision + 1, JSON.stringify(snapshot)],
            )
            break
          }
          case 'unpublish':
            published = null
            await sql.query(
              'INSERT INTO "WildHubPublication" ("id","hubId","actorId","action") VALUES ($1,$2,$3,$4)',
              [randomUUID(), id, ownerId, 'UNPUBLISH'],
            )
            break
          default:
            throw new HubError(400, 'Unknown hub action.')
        }
        const [saved] = await sql.query<HubRow>(
          `UPDATE "WildHub" SET "profile"=$1::jsonb,"plan"=$2::jsonb,"trend"=$3::jsonb,"published"=$4::jsonb,"revision"="revision"+1,"updatedAt"=now() WHERE "id"=$5 AND "ownerId"=$6 RETURNING ${columns}`,
          [
            JSON.stringify(profile),
            JSON.stringify(plan),
            JSON.stringify(trend),
            JSON.stringify(published),
            id,
            ownerId,
          ],
        )
        return result(sql, saved)
      })
    },
    async reserveScan(id: string) {
      return db.transaction(async (sql) => {
        await owned(sql, id, true)
        const [row] = await sql.query<{ scanCount: number; fresh: boolean }>(
          'SELECT "scanCount", "scanWindow">now()-interval \'1 hour\' AS fresh FROM "WildHub" WHERE "id"=$1',
          [id],
        )
        if (row.fresh && row.scanCount >= 6)
          throw new HubError(
            429,
            'Six photo scan attempts per hour. Please try later.',
          )
        const all = await photos(sql, id)
        if (all.length >= 12)
          throw new HubError(429, 'A hub can hold up to twelve photos.')
        await sql.query(
          'UPDATE "WildHub" SET "scanCount"=$2,"scanWindow"=CASE WHEN $3 THEN "scanWindow" ELSE now() END WHERE "id"=$1',
          [id, row.fresh ? row.scanCount + 1 : 1, row.fresh],
        )
      })
    },
    async addPhoto(
      id: string,
      photo: { caption: string; credit: string; hash: string; bytes: Buffer } & ReleaseInput,
    ) {
      return db.transaction(async (sql) => {
        const hub = await owned(sql, id, true)
        const release = releaseInput(photo)
        const duplicate = await sql.query<Photo>(
          'SELECT "id","caption","credit" FROM "WildHubPhoto" WHERE "hubId"=$1 AND "hash"=$2',
          [id, photo.hash],
        )
        if (duplicate.length) {
          const [prior] = await sql.query<{version:string;contactName:string;contactEmail:string;venuePublications:boolean;bioPublications:boolean;withdrawnAt:Date|null}>('SELECT version,"contactName","contactEmail","venuePublications","bioPublications","withdrawnAt" FROM "VenuePhotoRelease" WHERE "galleryPhotoId"=$1',[duplicate[0].id])
          if (!prior || prior.withdrawnAt || prior.version !== release.releaseVersion || prior.contactName !== release.contactName || prior.contactEmail !== release.contactEmail || prior.venuePublications !== release.venuePublications || prior.bioPublications !== release.bioPublications)
            throw new HubError(409,'This image already exists with a different or older release. Contact us to review its permissions.')
          if (
            duplicate[0].caption !== photo.caption ||
            duplicate[0].credit !== photo.credit
          )
            throw new HubError(
              409,
              'This photo already exists with different description or credit.',
            )
          return result(sql, hub)
        }
        if ((await photos(sql, id)).length >= 12)
          throw new HubError(429, 'A hub can hold up to twelve photos.')
        const photoId = randomUUID()
        await sql.query(
          'INSERT INTO "WildHubPhoto" ("id","hubId","caption","credit","hash","bytes") VALUES ($1,$2,$3,$4,$5,$6)',
          [
            photoId,
            id,
            photo.caption,
            photo.credit,
            photo.hash,
            photo.bytes,
          ],
        )
        await sql.query(`INSERT INTO "VenuePhotoRelease" ("photoId","galleryPhotoId","contactName","contactEmail","venueName",version,wording,"venuePublications","bioPublications") VALUES ($1,$1,$2,$3,$4,$5,$6,$7,$8)`, [photoId,release.contactName,release.contactEmail,hub.profile.name,release.releaseVersion,[RELEASE_CORE,RELEASE_VENUE,RELEASE_BIO,RELEASE_LIMITS].join('\n\n'),release.venuePublications,release.bioPublications])
        const [saved] = await sql.query<HubRow>(
          `UPDATE "WildHub" SET "revision"="revision"+1,"updatedAt"=now() WHERE "id"=$1 RETURNING ${columns}`,
          [id],
        )
        return result(sql, saved)
      })
    },
    async removePhoto(id: string, photoId: string, rev: unknown) {
      return db.transaction(async (sql) => {
        const hub = await owned(sql, id, true)
        revision(hub, rev)
        if (hub.published?.photoIds.includes(photoId))
          throw new HubError(
            409,
            'Publish a version without this photo, or unpublish the hub, before deleting it.',
          )
        await sql.query(
          'DELETE FROM "WildHubPhoto" WHERE "id"=$1 AND "hubId"=$2',
          [photoId, id],
        )
        const [saved] = await sql.query<HubRow>(
          `UPDATE "WildHub" SET "revision"="revision"+1,"updatedAt"=now() WHERE "id"=$1 RETURNING ${columns}`,
          [id],
        )
        return result(sql, saved)
      })
    },
  }
}
export async function publicHub(
  sql: Sql,
  id: string,
): Promise<Snapshot | null> {
  const [row] = await sql.query<{ published: Snapshot | null }>(
    'SELECT "published" FROM "WildHub" WHERE "id"=$1',
    [id],
  )
  return row?.published || null
}
export async function readablePhoto(
  sql: Sql,
  id: string,
  viewerId: string | null,
) {
  const [photo] = await sql.query<Photo & { bytes: Uint8Array }>(
    `SELECT p."id",p."caption",p."credit",p."bytes" FROM "WildHubPhoto" p JOIN "WildHub" h ON h."id"=p."hubId" WHERE p."id"=$1 AND (h."ownerId"=$2 OR h."published"->'photoIds' ? p."id")`,
    [id, viewerId],
  )
  return photo || null
}
