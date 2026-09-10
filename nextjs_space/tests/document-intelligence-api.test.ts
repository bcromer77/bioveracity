import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { workspaceService, type Sql, type Database } from '../lib/workspaces/service'
import { caseFiles } from '../lib/workspaces/case-files'
import { parseFile } from '../lib/workspaces/parse-file.mjs'
import { createCaseEndpoint } from '../lib/workspaces/case-endpoint'

test('private intelligence HTTP journey: persisted sources, case isolation, revocation and honest failure', async () => {
  const pg = new PGlite()
  try {
    await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES (\'owner\'),(\'outsider\');')
    for (const m of ['20260909_private_workspace_foundation','20260909_private_case_files']) await pg.exec(readFileSync(new URL(`../prisma/migrations/${m}/migration.sql`,import.meta.url),'utf8'))
    let failReads = false
    const sql = (client: Pick<PGlite,'query'>): Sql => ({ query: async<T>(text:string,values:unknown[]) => {
      if (failReads && text.startsWith('SELECT id,"documentId",locator,text')) throw new Error('Synthetic database outage')
      return (await client.query<T>(text,values)).rows
    } })
    const db: Database = { ...sql(pg), transaction: f => pg.transaction(tx => f(sql(tx))) }
    const service = workspaceService(db,'owner'), w = await service.createWorkspace({name:'Synthetic intelligence fixture'})
    const c = await service.createCase(w.id,{title:'Selected case'}), other = await service.createCase(w.id,{title:'Other authorised case'})
    const key = 'cd'.repeat(32), files = caseFiles(db,'owner',key)
    const report = await files.import(w.id,c.id,await parseFile(Buffer.from('No bats were recorded.\nBats were observed by the river.'),'synthetic-report.txt'))
    const elsewhere = await files.import(w.id,other.id,await parseFile(Buffer.from('Flooding was reported elsewhere.'),'other-case.txt'))
    const before = await files.list(w.id,c.id)
    let actor: string|null = 'owner'
    const endpoint=createCaseEndpoint({ getActor:async()=>actor,db,env:{PRIVATE_WORKSPACES_ENABLED:'true',PRIVATE_EVIDENCE_ENABLED:'true',PRIVATE_EVIDENCE_RUNTIME_APPROVED:'true',PRIVATE_EVIDENCE_KEY:key}, scan:async()=>{throw new Error('Analysis must not scan')},parse:async()=>{throw new Error('Analysis must not reparse')},render:async()=>{throw new Error('Analysis must not export')} })
    const url=`https://fixture.test/api/workspaces/${w.id}/cases/${c.id}/evidence`,context={params:Promise.resolve({workspaceId:w.id,caseId:c.id})}
    const post=(input:unknown)=>endpoint(new Request(url,{method:'POST',headers:{origin:'https://fixture.test','Content-Type':'application/json'},body:JSON.stringify(input)}),context,true)
    const input={action:'analyse',documentId:report.documentId,checkIds:['bats','flooding']}
    const response=await post(input);assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store')
    const result=await response.json()
    assert.equal(result.comparisons.length,1);assert.equal(result.scope.documents.length,1)
    assert.equal(result.coverage[1].status,'NOT_LOCATED_IN_EXTRACTED_TEXT')
    assert.equal(result.caseId,c.id)
    for(const source of result.comparisons[0].sources){const original=await files.passage(w.id,c.id,source.passageId) as {text:string};assert.ok(original.text.includes(source.quote))}
    const after=await files.list(w.id,c.id);assert.deepEqual(after,before,'analysis must not accept events or mutate evidence')
    assert.equal((await post({...input,documentId:elsewhere.documentId})).status,404)
    assert.equal((await post({...input,checkIds:['unknown']})).status,400)
    actor='outsider';assert.equal((await post(input)).status,404)
    actor=null;assert.equal((await post(input)).status,401)
    actor='owner';failReads=true;const failed=await post(input);assert.equal(failed.status,500);const failure=await failed.json();assert.equal(failure.comparisons,undefined);assert.ok(failure.error);failReads=false
    await pg.query('UPDATE "PrivateCaseMember" SET "revokedAt"=now() WHERE "caseId"=$1 AND "userId"=\'owner\'',[c.id])
    assert.equal((await post(input)).status,404)
  } finally { await pg.close() }
})
