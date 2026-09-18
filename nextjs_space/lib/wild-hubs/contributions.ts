import { randomUUID } from 'node:crypto'
import type { Database, Sql } from '../workspaces/service'
import { HubError, record, text } from './domain'

// A visitor contribution is a COMMUNITY OBSERVATION. It is deliberately kept
// distinct from three other things:
//   1. the venue's own story (owner-approved WildHub profile/plan),
//   2. authoritative source-linked county records (CountyNature),
//   3. professional ecological evidence (the evidence pipeline).
// Publishing a contribution changes only whether it is publicly visible. It
// NEVER upgrades its evidenceClass to "verified wildlife". Nothing here
// auto-publishes: every contribution starts PENDING and requires the owner to
// approve it, with the visitor's explicit permission.

export const CONTRIBUTION_EVIDENCE_CLASS = 'community-observation'

// Broad, plain-language categories. "I don't know" is intentional — a visitor is
// never forced to identify what they saw. None of these implies verification.
export const CONTRIBUTION_CATEGORIES = [
  { value: 'bird', label: 'Bird' },
  { value: 'mammal', label: 'Mammal' },
  { value: 'insect', label: 'Insect' },
  { value: 'plant', label: 'Plant' },
  { value: 'fungi', label: 'Fungi' },
  { value: 'farm-animal', label: 'Farm animal' },
  { value: 'water', label: 'Water' },
  { value: 'sky', label: 'Sky' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: "I don't know" },
] as const
export type ContributionCategory = (typeof CONTRIBUTION_CATEGORIES)[number]['value']
const CATEGORY_VALUES = new Set<string>(CONTRIBUTION_CATEGORIES.map((c) => c.value))
export function categoryLabel(value: string): string {
  return CONTRIBUTION_CATEGORIES.find((c) => c.value === value)?.label ?? 'Other'
}

export type ContributionFields = {
  broadCategory: string
  whatYouThink: string
  note: string
  coarseLocation: string
  permissionToPublish: boolean
  observedAt: Date | null
}

// Parse and bound the non-photo fields of a contribution. All prose fields are
// optional except the broad category. Location is free text only; anything that
// looks like map coordinates is refused so precise/sensitive sites are never
// captured.
export function contributionInput(raw: unknown): ContributionFields {
  const v = record(raw)
  const broadCategory = text(v.broadCategory, 20)
  if (!CATEGORY_VALUES.has(broadCategory))
    throw new HubError(400, 'Choose one category, or “I don’t know”.')
  const whatYouThink = text(v.whatYouThink ?? '', 300, false)
  const note = text(v.note ?? '', 2000, false)
  const coarseLocation = text(v.coarseLocation ?? '', 200, false)
  if (/-?\d{1,3}\.\d{3,}/.test(coarseLocation))
    throw new HubError(
      400,
      'Please describe the area in words, not map coordinates.',
    )
  const permissionToPublish = v.permissionToPublish
  if (permissionToPublish !== true && permissionToPublish !== false)
    throw new HubError(400, 'Tell us whether we may publish this.')
  let observedAt: Date | null = null
  if (v.observedAt !== null && v.observedAt !== undefined && v.observedAt !== '') {
    const parsed = Date.parse(text(v.observedAt, 40))
    if (!Number.isFinite(parsed))
      throw new HubError(400, 'That date could not be read.')
    observedAt = new Date(parsed)
    if (observedAt.getTime() > Date.now() + 60_000)
      throw new HubError(400, 'An observation cannot be in the future.')
    if (observedAt.getTime() < Date.parse('1900-01-01T00:00:00Z'))
      throw new HubError(400, 'That date is too far in the past.')
  }
  return {
    broadCategory,
    whatYouThink,
    note,
    coarseLocation,
    permissionToPublish,
    observedAt,
  }
}

export type ModerationDecision = {
  action: 'publish' | 'reject'
  hideLocation: boolean
  moderatorNote: string
}
export function moderationInput(raw: unknown): ModerationDecision {
  const v = record(raw)
  const action = text(v.action, 20)
  if (action !== 'publish' && action !== 'reject')
    throw new HubError(400, 'Choose to publish or decline this contribution.')
  return {
    action,
    hideLocation: v.hideLocation === true,
    moderatorNote: text(v.moderatorNote, 2000, false),
  }
}

// What the owner (curator) sees. Full detail, because they are deciding.
export type OwnerContribution = {
  id: string
  broadCategory: string
  categoryLabel: string
  whatYouThink: string
  note: string
  observedAt: string | null
  coarseLocation: string
  permissionToPublish: boolean
  evidenceClass: string
  publicationStatus: string
  sensitiveHidden: boolean
  moderatorNote: string
  createdAt: string
  moderatedAt: string | null
}

// What the public sees for a PUBLISHED contribution. Deliberately narrow:
// the private note is never exposed, and the coarse location is dropped when
// the owner has flagged it sensitive (e.g. a nest or roost).
export type PublicContribution = {
  id: string
  broadCategory: string
  categoryLabel: string
  identified: boolean
  whatYouThink: string
  observedAt: string | null
  createdAt: string
  coarseLocation: string
}

type ContributionRow = {
  id: string
  hubId: string
  broadCategory: string
  whatYouThink: string
  note: string
  observedAt: Date | string | null
  coarseLocation: string
  permissionToPublish: boolean
  evidenceClass: string
  publicationStatus: string
  sensitiveHidden: boolean
  moderatorNote: string
  createdAt: Date | string
  moderatedAt: Date | string | null
}

const iso = (v: Date | string | null): string | null =>
  v == null ? null : new Date(v).toISOString()

function toPublic(row: ContributionRow): PublicContribution {
  return {
    id: row.id,
    broadCategory: row.broadCategory,
    categoryLabel: categoryLabel(row.broadCategory),
    identified: row.broadCategory !== 'unknown' || row.whatYouThink.trim() !== '',
    whatYouThink: row.whatYouThink,
    observedAt: iso(row.observedAt),
    createdAt: iso(row.createdAt)!,
    coarseLocation: row.sensitiveHidden ? '' : row.coarseLocation,
  }
}

const OWNER_COLUMNS =
  '"id","broadCategory","whatYouThink","note","observedAt","coarseLocation","permissionToPublish","evidenceClass","publicationStatus","sensitiveHidden","moderatorNote","createdAt","moderatedAt"'

// Public capabilities: submit a contribution, read published ones, serve a
// published photo. No authentication — anyone who can reach the place can take
// part — but a hub must be published (a real, visitable place) to accept them.
export function contributionService(db: Database) {
  return {
    async submit(hubId: string, prepared: { bytes: Buffer; hash: string }, fields: ContributionFields) {
      return db.transaction(async (sql) => {
        const [hub] = await sql.query<{
          published: boolean
          fresh: boolean
          contribCount: number
        }>(
          'SELECT "published" IS NOT NULL AS published, "contribWindow">now()-interval \'1 hour\' AS fresh, "contribCount" FROM "WildHub" WHERE "id"=$1 FOR UPDATE',
          [hubId],
        )
        // A place that is not published cannot be contributed to. 404 so an
        // unpublished or non-existent hub is indistinguishable to the public.
        if (!hub || !hub.published)
          throw new HubError(404, 'This place is not open for contributions yet.')
        if (hub.fresh && hub.contribCount >= 30)
          throw new HubError(
            429,
            'Thank you — a lot has been shared here in the last hour. Please try again a little later.',
          )
        const [pending] = await sql.query<{ n: number }>(
          'SELECT count(*)::int AS n FROM "WildContribution" WHERE "hubId"=$1 AND "publicationStatus"=\'PENDING\'',
          [hubId],
        )
        if (pending.n >= 200)
          throw new HubError(
            429,
            'We are still reviewing a lot of sightings here. Please try again later.',
          )
        const id = randomUUID()
        await sql.query(
          'INSERT INTO "WildContribution" ("id","hubId","photoBytes","photoHash","broadCategory","whatYouThink","note","observedAt","coarseLocation","permissionToPublish","evidenceClass","publicationStatus") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [
            id,
            hubId,
            prepared.bytes,
            prepared.hash,
            fields.broadCategory,
            fields.whatYouThink,
            fields.note,
            fields.observedAt,
            fields.coarseLocation,
            fields.permissionToPublish,
            CONTRIBUTION_EVIDENCE_CLASS,
            'PENDING',
          ],
        )
        await sql.query(
          'UPDATE "WildHub" SET "contribCount"=$2,"contribWindow"=CASE WHEN $3 THEN "contribWindow" ELSE now() END WHERE "id"=$1',
          [hubId, hub.fresh ? hub.contribCount + 1 : 1, hub.fresh],
        )
        // Deliberately minimal acknowledgement. Nothing is public yet.
        return { id, status: 'PENDING' as const }
      })
    },
    async publicList(hubId: string): Promise<PublicContribution[]> {
      const rows = await db.query<ContributionRow>(
        `SELECT ${OWNER_COLUMNS} FROM "WildContribution" WHERE "hubId"=$1 AND "publicationStatus"='PUBLISHED' ORDER BY "observedAt" NULLS LAST, "createdAt"`,
        [hubId],
      )
      return rows.map(toPublic)
    },
    async publicPhoto(cid: string) {
      const [row] = await db.query<{ photoBytes: Uint8Array }>(
        'SELECT "photoBytes" FROM "WildContribution" WHERE "id"=$1 AND "publicationStatus"=\'PUBLISHED\'',
        [cid],
      )
      return row ? row.photoBytes : null
    },
  }
}

// Owner capabilities: review, moderate and view the photo of contributions to a
// hub they own. Ownership is enforced on every call.
export function ownerContributionService(db: Database, ownerId: string) {
  if (!ownerId) throw new HubError(401, 'Please sign in.')
  async function ownHub(sql: Sql, hubId: string, lock = false) {
    const rows = await sql.query<{ id: string }>(
      `SELECT "id" FROM "WildHub" WHERE "id"=$1 AND "ownerId"=$2${lock ? ' FOR UPDATE' : ''}`,
      [hubId, ownerId],
    )
    if (!rows.length) throw new HubError(404, 'Hub not found.')
  }
  return {
    async list(hubId: string): Promise<OwnerContribution[]> {
      await ownHub(db, hubId)
      const rows = await db.query<ContributionRow>(
        `SELECT ${OWNER_COLUMNS} FROM "WildContribution" WHERE "hubId"=$1 ORDER BY "createdAt" DESC, "id"`,
        [hubId],
      )
      return rows.map((r) => ({
        id: r.id,
        broadCategory: r.broadCategory,
        categoryLabel: categoryLabel(r.broadCategory),
        whatYouThink: r.whatYouThink,
        note: r.note,
        observedAt: iso(r.observedAt),
        coarseLocation: r.coarseLocation,
        permissionToPublish: r.permissionToPublish,
        evidenceClass: r.evidenceClass,
        publicationStatus: r.publicationStatus,
        sensitiveHidden: r.sensitiveHidden,
        moderatorNote: r.moderatorNote,
        createdAt: iso(r.createdAt)!,
        moderatedAt: iso(r.moderatedAt),
      }))
    },
    async photo(hubId: string, cid: string) {
      await ownHub(db, hubId)
      const [row] = await db.query<{ photoBytes: Uint8Array }>(
        'SELECT "photoBytes" FROM "WildContribution" WHERE "id"=$1 AND "hubId"=$2',
        [cid, hubId],
      )
      return row ? row.photoBytes : null
    },
    async moderate(hubId: string, cid: string, decision: ModerationDecision) {
      return db.transaction(async (sql) => {
        await ownHub(sql, hubId, true)
        const [row] = await sql.query<ContributionRow>(
          `SELECT ${OWNER_COLUMNS} FROM "WildContribution" WHERE "id"=$1 AND "hubId"=$2 FOR UPDATE`,
          [cid, hubId],
        )
        if (!row) throw new HubError(404, 'Contribution not found.')
        if (decision.action === 'publish' && !row.permissionToPublish)
          throw new HubError(
            409,
            'This visitor did not give permission to publish, so it can only be declined.',
          )
        const status = decision.action === 'publish' ? 'PUBLISHED' : 'REJECTED'
        // CRITICAL INVARIANT: evidenceClass is never written here. Publication
        // changes visibility only — it never turns an observation into verified
        // ecological evidence. sensitiveHidden hides an approximate location
        // (e.g. a nest or roost) even after publication.
        const [saved] = await sql.query<ContributionRow>(
          `UPDATE "WildContribution" SET "publicationStatus"=$3,"sensitiveHidden"=$4,"moderatorId"=$5,"moderatorNote"=$6,"moderatedAt"=now() WHERE "id"=$1 AND "hubId"=$2 RETURNING ${OWNER_COLUMNS}`,
          [
            cid,
            hubId,
            status,
            decision.action === 'publish' ? decision.hideLocation : row.sensitiveHidden,
            ownerId,
            decision.moderatorNote,
          ],
        )
        return {
          id: saved.id,
          publicationStatus: saved.publicationStatus,
          sensitiveHidden: saved.sensitiveHidden,
          evidenceClass: saved.evidenceClass,
        }
      })
    },
  }
}
