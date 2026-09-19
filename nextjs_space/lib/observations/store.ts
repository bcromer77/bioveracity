import { randomUUID } from 'node:crypto'
import type { Database, Sql } from '../workspaces/service'
import { validateObservationEvent, type ObservationEvent } from './contract'

export type EvidenceCheckInput = {
  assetId?: string | null
  question: string
  scope: Record<string, unknown>
  sourceVersions: unknown[]
  method: Record<string, unknown>
  resultStatus: 'LOCATED' | 'NOT_LOCATED_IN_REVIEWED_SCOPE' | 'PARTIAL' | 'UNAVAILABLE' | 'OUT_OF_SCOPE'
  resultSummary?: string | null
  coverage: Record<string, unknown>
}

const json = (value: unknown) => JSON.stringify(value)

async function persistFinding(tx: Sql, eventId: string, finding: ObservationEvent['findings'][number]) {
  await tx.query(
    'INSERT INTO "ObservationFindingRecord" (id,"eventId",kind,state,target,value,unit,"ordinalValue","rawStatement","reviewStatus","evidenceClass") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING',
    [finding.id, eventId, finding.kind, finding.state, finding.target ?? null, finding.value ?? null, finding.unit ?? null,
      finding.ordinalValue ?? null, finding.rawStatement ?? null, finding.reviewStatus, finding.evidenceClass],
  )
}

async function persistSource(tx: Sql, eventId: string, source: ObservationEvent['source']) {
  const existing = await tx.query<{ id: string }>(
    'SELECT id FROM "ObservationSourceRecord" WHERE "eventId"=$1 AND "sourceSystem"=$2 AND COALESCE("upstreamRecordId",\'\')=COALESCE($3,\'\') AND COALESCE("versionHash",\'\')=COALESCE($4,\'\') LIMIT 1',
    [eventId, source.sourceSystem, source.upstreamRecordId ?? null, source.versionHash ?? null],
  )
  if (existing[0]) return
  await tx.query(
    'INSERT INTO "ObservationSourceRecord" (id,"eventId","sourceSystem",publisher,"datasetIdentifier","upstreamRecordId","upstreamEventId","sourceUrl",licence,"retrievedAt","versionHash") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [randomUUID(), eventId, source.sourceSystem, source.publisher ?? null, source.datasetIdentifier ?? null,
      source.upstreamRecordId ?? null, source.upstreamEventId ?? null, source.sourceUrl ?? null, source.licence ?? null,
      new Date(source.retrievedAt), source.versionHash ?? null],
  )
}

export function observationStore(db: Database) {
  return {
    async save(eventInput: ObservationEvent) {
      const event = validateObservationEvent(structuredClone(eventInput))
      return db.transaction(async tx => {
        const existing = await tx.query<{ id: string }>(
          'SELECT id FROM "ObservationEventRecord" WHERE "canonicalEventId"=$1 FOR UPDATE',
          [event.canonicalEventId],
        )
        let eventId = existing[0]?.id
        if (!eventId) {
          eventId = event.id
          await tx.query(
            'INSERT INTO "ObservationEventRecord" (id,"canonicalEventId","assetId",method,"observedAt","observedPrecision","observedBasis","receivedAt","placeLabel",geometry,crs,"spatialUncertaintyMeters","placeScopeNote",effort,"coverageState","coverageNote",lineage) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14::jsonb,$15,$16,$17::jsonb)',
            [eventId, event.canonicalEventId, event.place.placeId ?? null, event.method, event.observedTime.value,
              event.observedTime.precision, event.observedTime.basis, new Date(event.receivedAt), event.place.label ?? null,
              event.place.geometry == null ? null : json(event.place.geometry), event.place.crs ?? null,
              event.place.spatialUncertaintyMeters ?? null, event.place.scopeNote ?? null,
              event.effort == null ? null : json(event.effort), event.coverage.state, event.coverage.note, json(event.lineage)],
          )
        }

        for (const finding of event.findings) await persistFinding(tx, eventId, finding)
        await persistSource(tx, eventId, event.source)
        return { id: eventId, canonicalEventId: event.canonicalEventId }
      })
    },

    async recordEvidenceCheck(input: EvidenceCheckInput) {
      if (!input.question.trim()) throw new Error('Evidence check question is required')
      return db.transaction(async tx => {
        const id = randomUUID()
        await tx.query(
          'INSERT INTO "EvidenceCheckRecord" (id,"assetId",question,scope,"sourceVersions",method,"resultStatus","resultSummary",coverage) VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9::jsonb)',
          [id, input.assetId ?? null, input.question.trim(), json(input.scope), json(input.sourceVersions), json(input.method),
            input.resultStatus, input.resultSummary ?? null, json(input.coverage)],
        )
        return { id }
      })
    },
  }
}
