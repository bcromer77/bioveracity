import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { isAdmin } from '../access'
import type { Database, Sql } from '../workspaces/service'
import { HubError, generatePlan, record, type Profile } from './domain'
import { supportedNatureCounty } from '../wild-counties/api-nature'
import { venueSetupInput } from './onboarding-input'

export type VenueSetup = {
  id: string; reference: string; email: string; profile: Profile; hubId: string | null
  revision: number; expiresAt: Date | null; revokedAt: Date | null; acceptedAt: Date | null
  acceptedBy: string | null; tokenHash: string | null
}
export type VenueLaunchRow = Omit<VenueSetup, 'tokenHash'> & {
  status: string; natureSourceConfigured: boolean; photoCount: number; planYear: number | null; publicPath: string | null
}
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
async function administrator(sql: Sql, actorId: string) {
  const [user] = await sql.query<{ id: string; role: string; accessState: string }>(
    'SELECT id,role,"accessState" FROM "User" WHERE id=$1 FOR SHARE', [actorId])
  if (!user || !isAdmin({ user, expires: '' })) throw new HubError(403, 'Administrator access required.')
}
async function audit(sql: Sql, setupId: string, actorId: string, action: string) {
  await sql.query('INSERT INTO "WildVenueSetupEvent" (id,"setupId","actorId",action) VALUES ($1,$2,$3,$4)',
    [randomUUID(), setupId, actorId, action])
}
export function venueOnboardingService(db: Database, actorId: string) {
  if (!actorId) throw new HubError(401, 'Please sign in.')
  return {
    async list(page = 0) {
      await administrator(db, actorId)
      const offset = Math.max(0, Math.min(10000, Math.floor(page))) * 50
      const rows = await db.query<VenueSetup & { published: unknown; planYear: number | null; photoCount: number; reviewStatus: string | null; currentRevision: number | null; reviewRevision: number | null }>(
        `SELECT s.*, h.published, (h.plan->>'year')::int AS "planYear", h.revision AS "currentRevision",
         (SELECT count(*)::int FROM "WildHubPhoto" p WHERE p."hubId"=h.id) AS "photoCount",
         r.status AS "reviewStatus",r.revision AS "reviewRevision"
         FROM "WildVenueSetup" s LEFT JOIN "WildHub" h ON h.id=s."hubId"
         LEFT JOIN LATERAL (SELECT status,revision FROM "WildHubReview" WHERE "hubId"=h.id ORDER BY revision DESC LIMIT 1) r ON true
         ORDER BY s."createdAt",s.id LIMIT 50 OFFSET $1`, [offset])
      const [{ total }] = await db.query<{ total: number }>('SELECT count(*)::int AS total FROM "WildVenueSetup"', [])
      const [{ bytes }] = await db.query<{ bytes: string }>('SELECT COALESCE(sum(octet_length(bytes)),0)::text AS bytes FROM "WildHubPhoto"', [])
      const places: VenueLaunchRow[] = rows.map(({ tokenHash: hash, published, reviewStatus, reviewRevision, currentRevision, ...row }) => ({
        ...row,
        natureSourceConfigured: Boolean(supportedNatureCounty(row.profile.county)),
        status: published ? 'Published' : row.acceptedAt
          ? reviewStatus === 'PENDING' && reviewRevision === currentRevision ? 'Awaiting review'
            : reviewStatus === 'REJECTED' ? 'Changes requested' : 'Owner preparing'
          : row.revokedAt ? 'Revoked' : !hash ? 'Prepared'
            : row.expiresAt && row.expiresAt.getTime() <= Date.now() ? 'Link expired' : 'Awaiting owner',
        publicPath: published ? `/wild/places/${row.hubId}` : null,
      }))
      return { places, total, page: Math.floor(offset / 50), photoBytes: bytes }
    },
    async prepare(raw: unknown) {
      const input = record(raw)
      if (input.authorised !== true) throw new HubError(400, 'Confirm you are authorised to prepare these venue details.')
      if (!Array.isArray(input.places) || input.places.length < 1 || input.places.length > 50) throw new HubError(400, 'Prepare between 1 and 50 places at a time.')
      const places = input.places.map(venueSetupInput)
      if (new Set(places.map(p => p.reference)).size !== places.length) throw new HubError(400, 'Each venue needs a different reference.')
      return db.transaction(async sql => {
        await administrator(sql, actorId)
        const ids: string[] = []
        // Consistent order avoids opposing batch lock order.
        for (const place of [...places].sort((a, b) => a.reference.localeCompare(b.reference))) {
          const id = randomUUID()
          const created = await sql.query<{ id: string }>(
            'INSERT INTO "WildVenueSetup" (id,reference,email,profile,"createdBy") VALUES ($1,$2,$3,$4::jsonb,$5) ON CONFLICT (reference) DO NOTHING RETURNING id',
            [id, place.reference, place.email, JSON.stringify(place.profile), actorId])
          const [saved] = await sql.query<VenueSetup>('SELECT * FROM "WildVenueSetup" WHERE reference=$1 FOR UPDATE', [place.reference])
          if (saved.email !== place.email || JSON.stringify(venueSetupInput({ ...saved, profile: saved.profile }).profile) !== JSON.stringify(place.profile)) {
            throw new HubError(409, `Reference ${place.reference} already has different details. Edit its prepared record before issuing a new link.`)
          }
          if (created.length) await audit(sql, saved.id, actorId, 'PREPARED')
          ids.push(saved.id)
        }
        return { ids }
      })
    },
    async change(id: string, raw: unknown) {
      const input = record(raw)
      return db.transaction(async sql => {
        await administrator(sql, actorId)
        const [setup] = await sql.query<VenueSetup>('SELECT * FROM "WildVenueSetup" WHERE id=$1 FOR UPDATE', [id])
        if (!setup) throw new HubError(404, 'Venue setup not found.')
        if (setup.acceptedAt) throw new HubError(409, 'This place already belongs to its owner. Setup links cannot change ownership.')
        if (input.revision !== setup.revision) throw new HubError(409, 'This setup changed. Reload before continuing.')
        if (input.action === 'issue') {
          if (setup.revokedAt) throw new HubError(409, 'Edit and confirm the details before reopening this setup.')
          const token = randomBytes(32).toString('base64url')
          const expiresAt = new Date(Date.now() + 7 * 86400000)
          await sql.query('UPDATE "WildVenueSetup" SET "tokenHash"=$2,"expiresAt"=$3,revision=revision+1,"updatedAt"=now() WHERE id=$1', [id, tokenHash(token), expiresAt])
          await audit(sql, id, actorId, 'LINK_ISSUED')
          return { path: `/wild/join#token=${token}`, expiresAt }
        }
        if (input.action === 'revoke') {
          await sql.query('UPDATE "WildVenueSetup" SET "tokenHash"=NULL,"revokedAt"=now(),revision=revision+1,"updatedAt"=now() WHERE id=$1', [id])
          await audit(sql, id, actorId, 'REVOKED')
          return { revoked: true }
        }
        if (input.action === 'edit') {
          if (input.authorised !== true) throw new HubError(400, 'Confirm your authority to update these details.')
          const updated = venueSetupInput({ ...input, reference: setup.reference })
          await sql.query('UPDATE "WildVenueSetup" SET email=$2,profile=$3::jsonb,"tokenHash"=NULL,"expiresAt"=NULL,"revokedAt"=NULL,revision=revision+1,"updatedAt"=now() WHERE id=$1',
            [id, updated.email, JSON.stringify(updated.profile)])
          await audit(sql, id, actorId, 'EDITED')
          return { updated: true }
        }
        throw new HubError(400, 'Choose issue, revoke or edit.')
      })
    },
    async claim(raw: unknown) {
      const input = record(raw)
      if (input.confirmed !== true || typeof input.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(input.token)) throw new HubError(400, 'Confirm you represent this venue and use a valid setup link.')
      return db.transaction(async sql => {
        // Fresh database identity, never an email supplied by the browser or stale JWT.
        const [user] = await sql.query<{ id: string; email: string }>('SELECT id,email FROM "User" WHERE id=$1 FOR UPDATE', [actorId])
        if (!user?.email) throw new HubError(401, 'Please sign in again.')
        const [setup] = await sql.query<VenueSetup>('SELECT * FROM "WildVenueSetup" WHERE "tokenHash"=$1 FOR UPDATE', [tokenHash(input.token as string)])
        if (!setup || setup.revokedAt || !setup.expiresAt || setup.expiresAt.getTime() <= Date.now()) throw new HubError(410, 'This setup link has expired or been revoked. Ask BioVeracity for a new link.')
        if (setup.email !== user.email.trim().toLowerCase()) throw new HubError(403, 'Sign in with the email address this setup link was sent to.')
        if (setup.acceptedAt) {
          if (setup.acceptedBy !== actorId) throw new HubError(410, 'This setup link has already been used.')
          return { destination: `/wild/studio?hub=${setup.hubId}`, hubId: setup.hubId }
        }
        const [{ count }] = await sql.query<{ count: number }>('SELECT count(*)::int AS count FROM "WildHub" WHERE "ownerId"=$1', [actorId])
        if (count >= 3) throw new HubError(409, 'Your account already has three places. Contact BioVeracity before adding another.')
        const duplicate = await sql.query<{ id: string }>(
          `SELECT id FROM "WildHub" WHERE "ownerId"=$1 AND lower(profile->>'name')=lower($2) AND profile->>'county'=$3 LIMIT 1`,
          [actorId, setup.profile.name, setup.profile.county])
        if (duplicate.length) throw new HubError(409, 'Your account already has a place with this name and county. Open it in your studio or contact BioVeracity before creating another.')
        const hubId = randomUUID()
        const plan = generatePlan(setup.profile, new Date().getUTCFullYear(), null)
        await sql.query('INSERT INTO "WildHub" (id,"ownerId",profile,plan) VALUES ($1,$2,$3::jsonb,$4::jsonb)', [hubId, actorId, JSON.stringify(setup.profile), JSON.stringify(plan)])
        await sql.query('UPDATE "WildVenueSetup" SET "hubId"=$2,"acceptedBy"=$3,"acceptedAt"=now(),revision=revision+1,"updatedAt"=now() WHERE id=$1', [setup.id, hubId, actorId])
        await audit(sql, setup.id, actorId, 'ACCEPTED')
        return { destination: `/wild/studio?hub=${hubId}`, hubId }
      })
    },
  }
}
