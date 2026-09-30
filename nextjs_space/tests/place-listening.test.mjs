// PILOT-001: Place-linked listening in the service layer (mocked SQL).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listenService } from '../lib/listens/service.mjs'
const PLACE = 'bv_place_test_listening_probe', ID = '00000000-0000-4000-8000-0000000000a1'
function dbWith(handler) {
  const calls = []
  const db = { query: async (sql, values) => { calls.push({ sql, values }); return handler(sql, values) }, transaction: async fn => fn(db) }
  return { db, calls }
}
test('standalone home never includes Place-linked histories; Place home is owner- and Place-bound', async () => {
  const { db, calls } = dbWith(() => [])
  const s = listenService(db, 'owner')
  await s.home()
  assert.ok(calls.every(c => /"placeId" IS NULL/.test(c.sql) && c.values[0] === 'owner'))
  calls.length = 0
  assert.deepEqual(await s.homeForPlace(PLACE), { plots: [], visits: [] })
  assert.equal(calls.length, 2)
  assert.ok(calls.every(c => c.sql.includes('"ownerId"=$1') && c.sql.includes('"placeId"=$2') && c.values[0] === 'owner' && c.values[1] === PLACE))
})
test('listenAtPlace requires a verified participant and inserts nothing otherwise', async () => {
  const { db, calls } = dbWith(() => [])
  await assert.rejects(listenService(db, 'owner').listenAtPlace({ placeId: PLACE, name: 'Probe', id: ID }), e => e.status === 403)
  assert.ok(!calls.some(c => c.sql.startsWith('INSERT')))
})
test('listenAtPlace is idempotent per owner x Place; county NULL; not counted against the three-place quota', async () => {
  let row = null
  const { db, calls } = dbWith((sql, values) => {
    if (sql.includes('FROM "User"')) return [{ id: 'owner' }]
    if (sql.startsWith('SELECT id FROM "ListeningPlot" WHERE "ownerId"=$1 AND "placeId"=$2')) return row ? [{ id: row.id }] : []
    if (sql.startsWith('SELECT id,"payloadHash"')) return []
    if (sql.startsWith('INSERT')) { row = { id: values[0], ownerId: values[1], name: values[2], placeId: values[3] }; return [] }
    return []
  })
  const s = listenService(db, 'owner')
  assert.deepEqual(await s.listenAtPlace({ placeId: PLACE, name: 'Probe', id: ID }), { id: ID })
  const insert = calls.find(c => c.sql.startsWith('INSERT'))
  assert.match(insert.sql, /VALUES \(\$1,\$2,\$3,NULL,\$4,\$5\)/)
  assert.deepEqual(insert.values.slice(0, 4), [ID, 'owner', 'Probe', PLACE])
  assert.ok(!calls.some(c => c.sql.startsWith('SELECT COUNT')), 'Place histories do not consume standalone quota')
  // A retry with a new client identifier returns the existing history rather than creating another.
  assert.deepEqual(await s.listenAtPlace({ placeId: PLACE, name: 'Probe', id: '00000000-0000-4000-8000-0000000000a2' }), { id: ID })
  assert.equal(calls.filter(c => c.sql.startsWith('INSERT')).length, 1)
})
test('standalone quota counts only standalone places', async () => {
  const { db, calls } = dbWith(sql => sql.includes('FROM "User"') ? [{ id: 'owner' }] : sql.startsWith('SELECT COUNT') ? [{ n: 0 }] : [])
  await listenService(db, 'owner').createPlot({ id: ID, name: 'Bench', county: 'Down' })
  assert.ok(calls.find(c => c.sql.startsWith('SELECT COUNT')).sql.includes('"placeId" IS NULL'))
})
test('an identifier already used elsewhere is a 409 without revealing the holder', async () => {
  const { db } = dbWith(sql => sql.includes('FROM "User"') ? [{ id: 'owner' }] : sql.startsWith('SELECT id,"payloadHash"') ? [{ id: ID, payloadHash: 'x', ownerId: 'someone-else' }] : [])
  await assert.rejects(listenService(db, 'owner').listenAtPlace({ placeId: PLACE, name: 'Probe', id: ID }), e => e.status === 409 && !/someone/.test(e.message))
})
