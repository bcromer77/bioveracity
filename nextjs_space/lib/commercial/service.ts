import { createHash, randomUUID } from 'node:crypto'
import {
  assertAttachable,
  assertNoInventedConclusion,
  bandFor,
  CommercialError,
  roleQuestion,
  whySeeing,
  type Band,
  type CheckState,
  type Lens,
  type Resolution,
} from './principles'
import { signalById } from './registry'
import { renderReport, type ReportSnapshot } from './pdf'
import { buildWorkbook } from './xlsx'

export type Sql = { query: <T>(text: string, values: unknown[]) => Promise<T[]> }
export type Database = Sql & { transaction: (operation: (sql: Sql) => Promise<void>) => Promise<void> }

type Grant = 'OWNER' | 'EDITOR' | 'COMMENTER' | 'VIEWER'
const READ: Grant[] = ['OWNER', 'EDITOR', 'COMMENTER', 'VIEWER']
const WRITE: Grant[] = ['OWNER', 'EDITOR']
const REVIEW: Grant[] = ['OWNER', 'EDITOR', 'COMMENTER']

function hash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

export function commercialService(db: Database, userId: string) {
  if (!userId) throw new CommercialError(401, 'Authentication required')

  async function workspaceRole(workspaceId: string) {
    const rows = await db.query<{ role: string }>(
      'SELECT role FROM "PrivateWorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2 AND "revokedAt" IS NULL',
      [workspaceId, userId],
    )
    if (!rows[0]) throw new CommercialError(404, 'Not found')
    return rows[0].role
  }

  async function grant(workspaceId: string, portfolioId: string) {
    const rows = await db.query<{ role: Grant }>(
      `SELECT g.role FROM "CommercialPortfolioGrant" g
       JOIN "PrivateWorkspaceMember" m ON m."workspaceId"=g."workspaceId" AND m."userId"=g."userId"
       WHERE g."workspaceId"=$1 AND g."portfolioId"=$2 AND g."userId"=$3
         AND g."revokedAt" IS NULL AND m."revokedAt" IS NULL`,
      [workspaceId, portfolioId, userId],
    )
    if (!rows[0]) throw new CommercialError(404, 'Not found')
    return rows[0].role
  }

  function allows(role: Grant, allowed: Grant[]) {
    if (!allowed.includes(role)) throw new CommercialError(404, 'Not found')
  }

  return {
    async createPortfolio(workspaceId: string, name: string) {
      if ((await workspaceRole(workspaceId)) !== 'OWNER') throw new CommercialError(404, 'Not found')
      const id = randomUUID()
      await db.transaction(async sql => {
        await sql.query('INSERT INTO "CommercialPortfolio" (id,"workspaceId",name) VALUES ($1,$2,$3)', [id, workspaceId, name])
        await sql.query(
          'INSERT INTO "CommercialPortfolioGrant" ("workspaceId","portfolioId","userId",role) VALUES ($1,$2,$3,$4)',
          [workspaceId, id, userId, 'OWNER'],
        )
      })
      return { id }
    },

    async grantPortfolio(workspaceId: string, portfolioId: string, memberId: string, role: Grant) {
      allows(await grant(workspaceId, portfolioId), ['OWNER'])
      const member = await db.query<{ userId: string }>(
        'SELECT "userId" FROM "PrivateWorkspaceMember" WHERE "workspaceId"=$1 AND "userId"=$2 AND "revokedAt" IS NULL',
        [workspaceId, memberId],
      )
      if (!member[0]) throw new CommercialError(404, 'Not found')
      await db.query(
        `INSERT INTO "CommercialPortfolioGrant" ("workspaceId","portfolioId","userId",role)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT ("workspaceId","portfolioId","userId") DO UPDATE SET role=EXCLUDED.role, "revokedAt"=NULL`,
        [workspaceId, portfolioId, memberId, role],
      )
    },

    async createAsset(workspaceId: string, portfolioId: string, asset: {
      name: string
      assetType: string
      address?: string | null
      eircode?: string | null
      latitude?: number | null
      longitude?: number | null
      localAuthority?: string | null
      county?: string | null
      ownershipStatus?: string | null
      geography?: unknown
    }) {
      allows(await grant(workspaceId, portfolioId), WRITE)
      const id = randomUUID()
      await db.query(
        `INSERT INTO "CommercialAsset"
         (id,"workspaceId","portfolioId",name,address,eircode,latitude,longitude,"assetType","ownershipStatus","localAuthority",county,geography)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
        [id, workspaceId, portfolioId, asset.name, asset.address ?? null, asset.eircode ?? null, asset.latitude ?? null, asset.longitude ?? null, asset.assetType, asset.ownershipStatus ?? null, asset.localAuthority ?? null, asset.county ?? null, JSON.stringify(asset.geography ?? {})],
      )
      return { id }
    },

    async recordCheck(workspaceId: string, registrySignalId: string, state: CheckState, detail: string) {
      if ((await workspaceRole(workspaceId)) !== 'OWNER') throw new CommercialError(404, 'Not found')
      signalById(registrySignalId)
      if (state === 'NO_CHANGE' && /unavailable|failed|not checked/i.test(detail)) {
        throw new CommercialError(422, 'A failed check cannot be stored as no change')
      }
      const id = randomUUID()
      await db.query(
        'INSERT INTO "CommercialSourceCheck" (id,"workspaceId","registrySignalId",state,detail) VALUES ($1,$2,$3,$4,$5)',
        [id, workspaceId, registrySignalId, state, detail],
      )
      return { id, state }
    },

    async recordEvent(workspaceId: string, event: {
      registrySignalId: string
      sourceAuthority: string
      sourceRecordId?: string | null
      underlyingMatterId?: string | null
      sourceUrl: string
      title: string
      factualObservation: string
      observedValue?: string | null
      unit?: string | null
      previousValue?: string | null
      eventDate?: string | null
      publicationDate?: string | null
      retrievalDate: string
      spatialResolution: Resolution
      geographicIdentifier?: string | null
      lifecycleStage?: string | null
      previousLifecycleStage?: string | null
      evidenceStatus: string
    }) {
      if ((await workspaceRole(workspaceId)) !== 'OWNER') throw new CommercialError(404, 'Not found')
      signalById(event.registrySignalId)
      assertNoInventedConclusion(event.factualObservation)
      const contentHash = hash({
        signal: event.registrySignalId,
        authority: event.sourceAuthority,
        record: event.sourceRecordId ?? null,
        observation: event.factualObservation,
        eventDate: event.eventDate ?? null,
        publicationDate: event.publicationDate ?? null,
        stage: event.lifecycleStage ?? null,
      })
      const existing = await db.query<{ id: string }>(
        'SELECT id FROM "CommercialSignalEvent" WHERE "workspaceId"=$1 AND "contentHash"=$2',
        [workspaceId, contentHash],
      )
      if (existing[0]) {
        await this.recordCheck(workspaceId, event.registrySignalId, 'NO_CHANGE', 'The same source passage was already stored.')
        return { id: existing[0].id, change: 'NO_CHANGE' as const }
      }
      const id = randomUUID()
      let changeType = 'NEW_RECORD'
      let previous: unknown = null
      if (event.sourceRecordId) {
        const prior = await db.query<{ id: string; factualObservation: string; lifecycleStage: string | null }>(
          `SELECT id,"factualObservation","lifecycleStage" FROM "CommercialSignalEvent"
           WHERE "workspaceId"=$1 AND "sourceAuthority"=$2 AND "sourceRecordId"=$3
           ORDER BY "createdAt" DESC LIMIT 1`,
          [workspaceId, event.sourceAuthority, event.sourceRecordId],
        )
        if (prior[0]) {
          changeType = prior[0].lifecycleStage !== (event.lifecycleStage ?? null) ? 'STATUS_CHANGED' : 'DOCUMENT_UPDATED'
          previous = { id: prior[0].id, observation: prior[0].factualObservation, stage: prior[0].lifecycleStage }
        }
      }
      await db.transaction(async sql => {
        await sql.query(
          `INSERT INTO "CommercialSignalEvent"
           (id,"workspaceId","registrySignalId","sourceAuthority","sourceRecordId","underlyingMatterId","sourceUrl",title,"factualObservation","observedValue",unit,"previousValue","eventDate","publicationDate","retrievalDate","spatialResolution","geographicIdentifier","lifecycleStage","previousLifecycleStage","evidenceStatus","contentHash")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
          [id, workspaceId, event.registrySignalId, event.sourceAuthority, event.sourceRecordId ?? null, event.underlyingMatterId ?? null, event.sourceUrl, event.title, event.factualObservation, event.observedValue ?? null, event.unit ?? null, event.previousValue ?? null, event.eventDate ?? null, event.publicationDate ?? null, event.retrievalDate, event.spatialResolution, event.geographicIdentifier ?? null, event.lifecycleStage ?? null, event.previousLifecycleStage ?? null, event.evidenceStatus, contentHash],
        )
        await sql.query(
          'INSERT INTO "CommercialChange" (id,"workspaceId","changeType","previousState","newState","signalEventId") VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6)',
          [randomUUID(), workspaceId, changeType, JSON.stringify(previous), JSON.stringify({ id, stage: event.lifecycleStage ?? null }), id],
        )
      })
      return { id, change: changeType }
    },

    async relate(workspaceId: string, assetId: string, signalEventId: string, relationshipType: string, relevanceReason: string, dependencyStatus: string) {
      const asset = await db.query<{ portfolioId: string }>(
        'SELECT "portfolioId" FROM "CommercialAsset" WHERE id=$1 AND "workspaceId"=$2',
        [assetId, workspaceId],
      )
      if (!asset[0]) throw new CommercialError(404, 'Not found')
      allows(await grant(workspaceId, asset[0].portfolioId), WRITE)
      const event = await db.query<{ spatialResolution: Resolution; sourceAuthority: string; registrySignalId: string; lifecycleStage: string | null }>(
        'SELECT "spatialResolution","sourceAuthority","registrySignalId","lifecycleStage" FROM "CommercialSignalEvent" WHERE id=$1 AND "workspaceId"=$2',
        [signalEventId, workspaceId],
      )
      if (!event[0]) throw new CommercialError(404, 'Not found')
      const definition = signalById(event[0].registrySignalId)
      const band = bandFor(event[0].spatialResolution, relationshipType)
      assertAttachable(event[0].spatialResolution, band)
      assertNoInventedConclusion(relevanceReason)
      const id = randomUUID()
      await db.query(
        `INSERT INTO "CommercialAssetSignal"
         (id,"workspaceId","assetId","signalEventId","relationshipType","relevanceReason","relevanceRuleId","dependencyStatus","spatialBand")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, workspaceId, assetId, signalEventId, relationshipType, relevanceReason, definition.id, dependencyStatus, band],
      )
      return { id, band }
    },

    async review(workspaceId: string, assetSignalId: string, action: 'ASSIGN' | 'COMMENT' | 'REVIEWED' | 'NO_ACTION' | 'FOLLOW_UP' | 'NOTE', note: string, assigneeId?: string) {
      const row = await db.query<{ portfolioId: string }>(
        `SELECT a."portfolioId" FROM "CommercialAssetSignal" s
         JOIN "CommercialAsset" a ON a.id=s."assetId"
         WHERE s.id=$1 AND s."workspaceId"=$2`,
        [assetSignalId, workspaceId],
      )
      if (!row[0]) throw new CommercialError(404, 'Not found')
      allows(await grant(workspaceId, row[0].portfolioId), REVIEW)
      const id = randomUUID()
      await db.query(
        'INSERT INTO "CommercialReview" (id,"workspaceId","assetSignalId","actorId",action,"assigneeId",note) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, workspaceId, assetSignalId, userId, action, assigneeId ?? null, note],
      )
      return { id }
    },

    async portfolios(workspaceId: string) {
      await workspaceRole(workspaceId)
      return db.query<{ id: string; name: string; role: Grant; assets: number }>(
        `SELECT p.id, p.name, g.role, count(a.id)::int AS assets
         FROM "CommercialPortfolioGrant" g
         JOIN "PrivateWorkspaceMember" m ON m."workspaceId"=g."workspaceId" AND m."userId"=g."userId" AND m."revokedAt" IS NULL
         JOIN "CommercialPortfolio" p ON p.id=g."portfolioId"
         LEFT JOIN "CommercialAsset" a ON a."portfolioId"=p.id
         WHERE g."workspaceId"=$1 AND g."userId"=$2 AND g."revokedAt" IS NULL
         GROUP BY p.id, p.name, g.role
         ORDER BY p.name`,
        [workspaceId, userId],
      )
    },

    async summary(workspaceId: string, portfolioId: string) {
      allows(await grant(workspaceId, portfolioId), READ)
      const assets = await db.query<{ id: string; name: string; assetType: string; changes: number }>(
        `SELECT a.id, a.name, a."assetType",
           count(c.id) FILTER (WHERE c."changeType" <> 'NO_CHANGE')::int AS changes
         FROM "CommercialAsset" a
         LEFT JOIN "CommercialAssetSignal" s ON s."assetId"=a.id
         LEFT JOIN "CommercialChange" c ON c."signalEventId"=s."signalEventId" AND c."workspaceId"=a."workspaceId"
         WHERE a."workspaceId"=$1 AND a."portfolioId"=$2
         GROUP BY a.id
         ORDER BY a.name`,
        [workspaceId, portfolioId],
      )
      const changes = assets.reduce((sum, asset) => sum + Number(asset.changes), 0)
      return {
        assetsMonitored: assets.length,
        assetsWithChange: assets.filter(asset => Number(asset.changes) > 0).length,
        newRecords: changes,
        assets,
      }
    },

    async assetView(workspaceId: string, assetId: string, lens: Lens) {
      const asset = await db.query<{ id: string; name: string; portfolioId: string; assetType: string; address: string | null; eircode: string | null; geography: unknown }>(
        'SELECT id,name,"portfolioId","assetType",address,eircode,geography FROM "CommercialAsset" WHERE id=$1 AND "workspaceId"=$2',
        [assetId, workspaceId],
      )
      if (!asset[0]) throw new CommercialError(404, 'Not found')
      allows(await grant(workspaceId, asset[0].portfolioId), READ)
      const rows = await db.query<{
        id: string
        title: string
        factualObservation: string
        sourceAuthority: string
        sourceUrl: string
        eventDate: string | null
        publicationDate: string | null
        lifecycleStage: string | null
        spatialBand: Band
        relationshipType: string
        relevanceReason: string
        dependencyStatus: string
        family: string
        underlyingMatterId: string | null
      }>(
        `SELECT s.id, e.title, e."factualObservation", e."sourceAuthority", e."sourceUrl",
                e."eventDate"::text, e."publicationDate"::text, e."lifecycleStage",
                s."spatialBand", s."relationshipType", s."relevanceReason", s."dependencyStatus",
                e."registrySignalId" AS family, e."underlyingMatterId"
         FROM "CommercialAssetSignal" s
         JOIN "CommercialSignalEvent" e ON e.id=s."signalEventId"
         WHERE s."assetId"=$1 AND s."workspaceId"=$2
         ORDER BY e."publicationDate" NULLS LAST, e."eventDate" NULLS LAST`,
        [assetId, workspaceId],
      )
      const question = roleQuestion(lens)
      const evidence = rows.map(row => {
        const definition = signalById(row.family)
        const why = whySeeing({
          family: definition.family,
          band: row.spatialBand,
          reason: row.relevanceReason,
          authority: row.sourceAuthority,
          status: row.lifecycleStage ?? 'Not stated',
        })
        return { ...row, family: definition.family, why, question }
      })
      const authorities = new Set(evidence.map(row => row.sourceAuthority))
      const matters = new Set(evidence.map(row => row.underlyingMatterId ?? row.id))
      const cluster = authorities.size >= 2 && matters.size >= 2
        ? `${authorities.size} independently sourced records are linked to this asset. That is not a prediction.`
        : 'No independent multi-source cluster is claimed for this asset.'
      assertNoInventedConclusion(cluster)
      return { asset: asset[0], lens, evidence, cluster }
    },

    async issueReport(workspaceId: string, portfolioId: string, kind: 'PORTFOLIO' | 'FINANCE' | 'LEGAL' | 'ASSET', lens: Lens) {
      allows(await grant(workspaceId, portfolioId), WRITE)
      const portfolio = await db.query<{ name: string }>(
        'SELECT name FROM "CommercialPortfolio" WHERE id=$1 AND "workspaceId"=$2',
        [portfolioId, workspaceId],
      )
      const organisation = await db.query<{ name: string }>('SELECT name FROM "PrivateWorkspace" WHERE id=$1', [workspaceId])
      const assets = await db.query<{ id: string; name: string }>(
        'SELECT id,name FROM "CommercialAsset" WHERE "workspaceId"=$1 AND "portfolioId"=$2 ORDER BY name',
        [workspaceId, portfolioId],
      )
      const rows: ReportSnapshot['rows'] = []
      for (const asset of assets) {
        const view = await this.assetView(workspaceId, asset.id, lens)
        for (const item of view.evidence) {
          if (item.factualObservation.startsWith('Fixture only:')) continue
          rows.push({
            asset: asset.name,
            fact: item.factualObservation,
            relationship: `${item.spatialBand} · ${item.relationshipType} · ${item.dependencyStatus}`,
            why: item.why,
            question: item.question,
            source: `${item.sourceAuthority} ${item.sourceUrl}`,
            eventDate: item.eventDate ?? 'Not stated',
            publicationDate: item.publicationDate ?? 'Not stated',
            unknown: 'A coordinate, a dependency and a financial effect were not established unless a row says so.',
          })
        }
      }
      const checks = await db.query<{ state: string; detail: string; registrySignalId: string }>(
        `SELECT state, detail, "registrySignalId" FROM "CommercialSourceCheck" WHERE "workspaceId"=$1 ORDER BY "checkedAt"`,
        [workspaceId],
      )
      const snapshot: ReportSnapshot = {
        organisation: organisation[0]?.name ?? workspaceId,
        portfolio: portfolio[0]?.name ?? portfolioId,
        kind,
        period: 'Records retrieved for this demonstration',
        generatedAt: new Date().toISOString(),
        version: 'pr105-1',
        status: 'ISSUED',
        summary: [
          `${assets.length} assets are in this portfolio.`,
          `${rows.length} sourced records are attached. Records that name a different place are not attached.`,
          roleQuestion(lens),
        ],
        rows,
        gaps: checks.filter(check => check.state !== 'RECORD_LOCATED' && check.state !== 'NO_CHANGE').map(check => `${check.registrySignalId}: ${check.state}. ${check.detail}`),
        methodology: [
          'Event date and publication date are stored separately.',
          'A news report is not the planning order.',
          'A design-stage rating is not an operational certificate.',
          'Planned capital investment is not delivery.',
          'Distance is not dependency. Missing evidence is not safety.',
          'This snapshot is kept with the issued file. A later retrieval does not change this issue.',
        ],
      }
      const pdfBytes = await renderReport(snapshot)
      const xlsxBytes = await buildWorkbook([
        { name: 'Portfolio', rows: [['Asset', 'Type'], ...assets.map(asset => [asset.name, ''])] },
        { name: 'Signals', rows: [['Asset', 'Fact', 'Event date', 'Publication date', 'Relationship', 'Why', 'Question', 'Source'], ...rows.map(row => [row.asset, row.fact, row.eventDate, row.publicationDate, row.relationship, row.why, row.question, row.source])] },
        { name: 'Projects', rows: [['Asset', 'Stage', 'Source'], ...rows.filter(row => /planned|commenced|design stage/i.test(row.fact)).map(row => [row.asset, row.fact, row.source])] },
        { name: 'Regulatory', rows: [['Asset', 'Fact', 'Source'], ...rows.filter(row => /EPA|planning|licence/i.test(row.fact)).map(row => [row.asset, row.fact, row.source])] },
        { name: 'Evidence gaps', rows: [['Signal', 'State'], ...snapshot.gaps.map(gap => [gap, 'See methodology'])] },
        { name: 'Methodology', rows: snapshot.methodology.map(line => [line]) },
      ])
      const id = randomUUID()
      const snapshotHash = hash(snapshot)
      await db.query(
        `INSERT INTO "CommercialReport"
         (id,"workspaceId",kind,status,"snapshotHash",snapshot,"pdfBytes","xlsxBytes","createdBy","issuedAt")
         VALUES ($1,$2,$3,'ISSUED',$4,$5::jsonb,$6,$7,$8,now())`,
        [id, workspaceId, kind, snapshotHash, JSON.stringify(snapshot), pdfBytes, xlsxBytes, userId],
      )
      return { id, snapshotHash, pdfBytes, xlsxBytes, snapshot }
    },
  }
}
