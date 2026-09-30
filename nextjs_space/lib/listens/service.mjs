import { createHash } from 'node:crypto'
import { ListenError, plotInput, visitInput, key } from './domain.mjs'
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex')
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
    async home() {
      const plots = await db.query('SELECT id,name,county,"createdAt" FROM "ListeningPlot" WHERE "ownerId"=$1 ORDER BY "createdAt",id', [ownerId])
      const visits = await db.query('SELECT v.id,v."plotId",v.payload,v."receivedAt" FROM "ListeningVisit" v JOIN "ListeningPlot" p ON p.id=v."plotId" WHERE p."ownerId"=$1 ORDER BY v."observedAt" DESC,v.id', [ownerId])
      return { plots, visits }
    },
    async createPlot(value) {
      const input = plotInput(value), fingerprint = hash(input)
      return locked(async tx => {
        const [existing] = await tx.query('SELECT id,"payloadHash" FROM "ListeningPlot" WHERE id=$1 AND "ownerId"=$2', [input.id,ownerId])
        if (existing) { if (existing.payloadHash !== fingerprint) throw new ListenError(409, 'This submission identifier was already used'); return { id: existing.id } }
        const [count] = await tx.query('SELECT COUNT(*)::int AS n FROM "ListeningPlot" WHERE "ownerId"=$1', [ownerId])
        if (count.n >= 3) throw new ListenError(409, 'The free pilot supports three places per participant')
        await tx.query('INSERT INTO "ListeningPlot" (id,"ownerId",name,county,"payloadHash") VALUES ($1,$2,$3,$4,$5)', [input.id,ownerId,input.name,input.county,fingerprint])
        return { id: input.id }
      })
    },
    async saveVisit(value) {
      const input = visitInput(value), fingerprint = hash(input)
      return locked(async tx => {
        await owned(tx,input.plotId)
        const [existing] = await tx.query('SELECT id,"payloadHash" FROM "ListeningVisit" WHERE id=$1 AND "plotId"=$2', [input.id,input.plotId])
        if (existing) { if (existing.payloadHash !== fingerprint) throw new ListenError(409, 'This visit identifier was already used'); return { id: existing.id } }
        const [count] = await tx.query('SELECT COUNT(*)::int AS n FROM "ListeningVisit" WHERE "plotId"=$1', [input.plotId])
        if (count.n >= 52) throw new ListenError(409, 'This place has reached the pilot’s 52-visit limit. You can still read and export its history.')
        await tx.query('INSERT INTO "ListeningVisit" (id,"plotId","observedAt",payload,"payloadHash") VALUES ($1,$2,$3,$4::jsonb,$5)', [input.id,input.plotId,new Date(input.observedAt),JSON.stringify(input),fingerprint])
        return { id: input.id }
      })
    },
    async deletePlot(id) {
      key(id)
      return locked(async tx => { await owned(tx,id); await tx.query('DELETE FROM "ListeningPlot" WHERE id=$1 AND "ownerId"=$2 RETURNING id',[id,ownerId]); return { deleted: true } })
    },
  }
}
