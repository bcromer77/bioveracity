import { createHash } from 'node:crypto'
import { ListenError, plotInput, visitInput, key } from './domain.mjs'
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex')
// A primary-key race with another participant's identical identifier surfaces as a unique violation;
// report it as the same conflict, without revealing who holds the identifier.
const unique = error => /23505|unique constraint/i.test(`${error?.code ?? ''} ${error?.meta?.code ?? ''} ${error?.message ?? ''}`)
async function insert(tx, sql, values, message) {
  try { await tx.query(sql, values) } catch (error) { if (unique(error)) throw new ListenError(409, message); throw error }
}
export function listenService(db, ownerId) {
  async function owned(tx, id) {
    const [plot] = await tx.query('SELECT id,name,county FROM "ListeningPlot" WHERE id=$1 AND "ownerId"=$2', [id,ownerId])
    if (!plot) throw new ListenError(404, 'Place not found')
    return plot
  }
  async function locked(operation) {
    return db.transaction(async tx => {
      const [user] = await tx.query('SELECT id FROM "User" WHERE id=$1 AND "emailVerified" IS NOT NULL FOR UPDATE', [ownerId])
      if (!user) throw new ListenError(403, 'Verify your email before saving a place or visit')
      return operation(tx)
    })
  }
  return {
    // Standalone home: participant-named places only. Place-linked histories are read through homeForPlace.
    async home() {
      const plots = await db.query('SELECT id,name,county,"createdAt" FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId" IS NULL ORDER BY "createdAt",id', [ownerId])
      const visits = await db.query('SELECT v.id,v."plotId",v.payload,v."receivedAt" FROM "ListeningVisit" v JOIN "ListeningPlot" p ON p.id=v."plotId" WHERE p."ownerId"=$1 AND p."placeId" IS NULL ORDER BY v."observedAt" DESC,v.id', [ownerId])
      return { plots, visits }
    },
    // placeId is always resolved server-side from a public slug; it is never taken from the browser.
    async homeForPlace(placeId) {
      const plots = await db.query('SELECT id,name,county,"createdAt" FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId"=$2 ORDER BY "createdAt",id', [ownerId,placeId])
      const visits = await db.query('SELECT v.id,v."plotId",v.payload,v."receivedAt" FROM "ListeningVisit" v JOIN "ListeningPlot" p ON p.id=v."plotId" WHERE p."ownerId"=$1 AND p."placeId"=$2 ORDER BY v."observedAt" DESC,v.id', [ownerId,placeId])
      return { plots, visits }
    },
    // One private history per participant per Place. Not counted against the three standalone places.
    async listenAtPlace({ placeId, name, id }) {
      const plotId = key(id), fingerprint = hash({ placeId })
      return locked(async tx => {
        const [mine] = await tx.query('SELECT id FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId"=$2', [ownerId,placeId])
        if (mine) return { id: mine.id }
        const [existing] = await tx.query('SELECT id,"payloadHash","ownerId" FROM "ListeningPlot" WHERE id=$1', [plotId])
        if (existing) throw new ListenError(409, 'This submission identifier was already used')
        await insert(tx, 'INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"placeId","payloadHash") VALUES ($1,$2,$3,NULL,$4,$5) ON CONFLICT ("ownerId","placeId") DO NOTHING', [plotId,ownerId,name,placeId,fingerprint], 'This submission identifier was already used')
        const [created] = await tx.query('SELECT id FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId"=$2', [ownerId,placeId])
        if (!created) throw new ListenError(409, 'The place history could not be confirmed. Retry.')
        return { id: created.id }
      })
    },
    async createPlot(value) {
      const input = plotInput(value), fingerprint = hash(input)
      return locked(async tx => {
        // Identifiers are global: a collision with any other participant's record is a conflict, never a leak or a 500.
        const [existing] = await tx.query('SELECT id,"payloadHash","ownerId" FROM "ListeningPlot" WHERE id=$1', [input.id])
        if (existing) { if (existing.ownerId !== ownerId || existing.payloadHash !== fingerprint) throw new ListenError(409, 'This submission identifier was already used'); return { id: existing.id } }
        const [count] = await tx.query('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId" IS NULL', [ownerId])
        if (count.n >= 3) throw new ListenError(409, 'The free pilot supports three places per participant')
        await insert(tx, 'INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"payloadHash") VALUES ($1,$2,$3,$4,$5)', [input.id,ownerId,input.name,input.county,fingerprint], 'This submission identifier was already used')
        return { id: input.id }
      })
    },
    async saveVisit(value) {
      const input = visitInput(value), fingerprint = hash(input)
      return locked(async tx => {
        await owned(tx,input.plotId)
        const [existing] = await tx.query('SELECT id,"payloadHash","plotId" FROM "ListeningVisit" WHERE id=$1', [input.id])
        if (existing) { if (existing.plotId !== input.plotId || existing.payloadHash !== fingerprint) throw new ListenError(409, 'This visit identifier was already used'); return { id: existing.id } }
        const [count] = await tx.query('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', [input.plotId])
        if (count.n >= 52) throw new ListenError(409, 'This place has reached the pilot’s 52-visit limit. You can still read and export its history.')
        await insert(tx, 'INSERT INTO "ListeningVisit" (id,"plotId","observedAt",payload,"payloadHash") VALUES ($1,$2,$3,$4::jsonb,$5)', [input.id,input.plotId,new Date(input.observedAt),JSON.stringify(input),fingerprint], 'This visit identifier was already used')
        return { id: input.id }
      })
    },
    async deletePlot(value) {
      const id = key(value)
      return locked(async tx => { await owned(tx,id); await tx.query('DELETE FROM "ListeningPlot" WHERE id=$1 AND "ownerId"=$2 RETURNING id',[id,ownerId]); return { deleted: true } })
    },
  }
}
