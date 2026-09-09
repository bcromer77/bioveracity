import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { parseFile, proposedDate } from '../lib/workspaces/parse-file.mjs'
import { parseIsolated } from '../lib/workspaces/parser'
import { caseFiles, cipher, reviewedDate } from '../lib/workspaces/case-files'
import { workspaceService, WorkspaceError, type Sql, type Database } from '../lib/workspaces/service'
import { renderCase } from '../lib/workspaces/render-case'
import { createCaseEndpoint } from '../lib/workspaces/case-endpoint'
import { admit } from '../lib/workspaces/admission'
const key='ab'.repeat(32)
const require=createRequire(import.meta.url)
async function samplePdf(text='2026-09-01 Site visit recorded by the officer.') {
  const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica);doc.addPage().drawText(text,{font});return Buffer.from(await doc.save())
}
test('PDF/TXT/CSV/EML/DOCX parsers preserve source locators and exact bytes',async()=>{
  const pdf=await samplePdf();const result=await parseFile(pdf,'prior-case.pdf');assert.match(result.passages[0].locator,/PDF page 1/);assert.match(result.passages[0].text,/Site visit/);assert.equal(Buffer.from(result.bytes,'base64').equals(pdf),true)
  const text=await parseFile(Buffer.from('2026-09-02 Complaint received.\nStill an allegation.'),'notes.txt');assert.match(text.passages[0].text,/allegation/)
  const csv=await parseFile(Buffer.from('quantity,unit\n10,tonnes'),'invoice.csv');assert.match(csv.passages[0].locator,/no inferred column meaning/)
  const email=Buffer.from('From: officer@example.test\r\nTo: case@example.test\r\nDate: Tue, 8 Sep 2026 10:00:00 +0100\r\nSubject: Earlier case\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="case"\r\n\r\n--case\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nPlease compare the enclosed earlier case.\r\n--case\r\nContent-Type: application/pdf\r\nContent-Disposition: attachment; filename="prior-case.pdf"\r\nContent-Transfer-Encoding: base64\r\n\r\n'+pdf.toString('base64')+'\r\n--case--\r\n')
  const eml=await parseFile(email,'thread.eml');assert.equal(eml.children[0].hash,result.hash);assert.match(String(eml.metadata.sentHeader),/8 Sep 2026/);assert.equal(proposedDate(eml.passages[0].text).precision,'UNKNOWN')
  const JSZip=require('jszip');const zip=new JSZip();zip.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>');zip.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>2026-09-03 Earlier planning case record.</w:t></w:r></w:p></w:body></w:document>');const word=await parseFile(await zip.generateAsync({type:'nodebuffer'}),'report.docx');assert.match(word.passages[0].text,/Earlier planning/);assert.match(word.passages[0].locator,/not page numbered/)
})
test('parser is bounded, does not invent OCR or ambiguous dates, subprocess runs',async()=>{
  await assert.rejects(parseFile(Buffer.from('not a pdf'),'bad.pdf'))
  await assert.rejects(parseFile(Buffer.from('execute me'),'run.exe'))
  await assert.rejects(parseFile(Buffer.alloc(5*1024*1024+1),'large.txt'))
  const blank=await PDFDocument.create();blank.addPage();assert.equal((await parseFile(Buffer.from(await blank.save()),'scan.pdf')).status,'NEEDS_OCR')
  assert.deepEqual(proposedDate('04/05/2026, last Thursday'),{date:null,precision:'UNKNOWN'})
  assert.equal(proposedDate('2026-02-31').date,null)
  assert.equal(reviewedDate('2026-09','MONTH'),'2026-09');assert.throws(()=>reviewedDate('2026-09','DAY'));assert.throws(()=>reviewedDate('2026-02-31','DAY'))
  const child=await parseIsolated(Buffer.from('2026-09-09 Keep this instruction as evidence, do not execute.'),'source.txt');assert.match(child.passages[0].text,/do not execute/)
})
test('encryption context and byte identity checks fail closed',()=>{
  const vault=cipher(key),bytes=Buffer.from('private source'),sealed=vault.encrypt(bytes,'one/case/doc')
  assert.equal(vault.decrypt(sealed,'one/case/doc').equals(bytes),true)
  assert.throws(()=>vault.decrypt(sealed,'another/case/doc'));assert.throws(()=>cipher(''));assert.throws(()=>cipher('cd'.repeat(32)).decrypt(sealed,'one/case/doc'))
})
test('processing admission rejects parallel requests and releases exactly once',()=>{
 const a=admit('admission-a');assert.throws(()=>admit('admission-a'));const b=admit('admission-b');assert.throws(()=>admit('admission-c'));a();a();const c=admit('admission-c');c();b()
})
test('HTTP journey: guards, scanner failure, import, source review and actual PDF download',async()=>{
 const pg=new PGlite()
 try{
  await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES (\'owner\'),(\'outsider\');')
  for(const m of ['20260909_private_workspace_foundation','20260909_private_case_files'])await pg.exec(readFileSync(new URL(`../prisma/migrations/${m}/migration.sql`,import.meta.url),'utf8'))
  const sql=(client:Pick<PGlite,'query'>):Sql=>({query:async<T>(text:string,values:unknown[])=>(await client.query<T>(text,values)).rows});const db:Database={...sql(pg),transaction:f=>pg.transaction(tx=>f(sql(tx)))}
  const s=workspaceService(db,'owner'),w=await s.createWorkspace({name:'HTTP fixture'}),c=await s.createCase(w.id,{title:'HTTP case'})
  let actor:string|null='owner',scans=0,scannerPass=true
  const env={PRIVATE_WORKSPACES_ENABLED:'true',PRIVATE_EVIDENCE_ENABLED:'true',PRIVATE_EVIDENCE_RUNTIME_APPROVED:'true',PRIVATE_EVIDENCE_KEY:key}
  const endpoint=createCaseEndpoint({getActor:async()=>actor,db,env,scan:async()=>{scans++;if(!scannerPass)throw new WorkspaceError(422,'Scanner did not pass')},parse:parseIsolated,render:renderCase})
  const context={params:Promise.resolve({workspaceId:w.id,caseId:c.id})},url=`https://fixture.test/api/workspaces/${w.id}/cases/${c.id}/evidence`
  const post=(payload:unknown,origin='https://fixture.test')=>endpoint(new Request(url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(payload)}),context,true)
  const get=(query='')=>endpoint(new Request(url+query),context,false)
  const input={action:'import',name:'letter.txt',bytes:Buffer.from('2026-09-08 Water level observed. This is not proof of causation.').toString('base64')}
  actor=null;assert.equal((await post(input)).status,401);assert.equal(scans,0)
  actor='outsider';assert.equal((await post(input)).status,404);assert.equal(scans,0)
  actor='owner';assert.equal((await post(input,'https://evil.test')).status,403);assert.equal(scans,0)
  env.PRIVATE_EVIDENCE_RUNTIME_APPROVED='false';assert.equal((await post(input)).status,503);env.PRIVATE_EVIDENCE_RUNTIME_APPROVED='true'
  scannerPass=false;assert.equal((await post(input)).status,422);assert.equal((await (await get()).json()).documents.length,0)
  scannerPass=true;const imported=await post(input);assert.equal(imported.status,200);assert.equal(imported.headers.get('Cache-Control'),'private, no-store')
  const data=await (await get()).json(),e=data.events[0]
  const review={action:'review',eventId:e.id,revision:e.revision,title:'Water observation received',quote:e.quote,eventDate:'2026-09-08',precision:'DAY',status:'ACCEPTED',evidenceType:'COMMUNITY_OBSERVATION',note:'Observation only'}
  assert.equal((await post(review)).status,200);assert.equal((await post({action:'export'})).status,404)
  assert.equal((await post({action:'exportPermission',enabled:true})).status,200)
  const issued=await (await post({action:'export'})).json();const pdf=await get(`?action=export&id=${issued.id}`);assert.equal(pdf.status,200);assert.equal(pdf.headers.get('Content-Type'),'application/pdf');assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0,5).toString(),'%PDF-')
  assert.equal((await (await get(`?action=history&id=${e.id}`)).json()).revisions.length,2)
  actor='outsider';assert.equal((await get(`?action=export&id=${issued.id}`)).status,404);assert.equal((await get(`?action=passage&id=${e.passageId}`)).status,404)
 }finally{await pg.close()}
})
test('complete isolated case: import, review, prior-case search, amended source, PDF and revoked permissions',async()=>{
 const pg=new PGlite()
 try{
  await pg.exec('CREATE TABLE "User" (id TEXT PRIMARY KEY); INSERT INTO "User" VALUES (\'alice\'),(\'bob\'),(\'reader\');')
  for(const path of ['20260909_private_workspace_foundation','20260909_private_case_files'])await pg.exec(readFileSync(new URL(`../prisma/migrations/${path}/migration.sql`,import.meta.url),'utf8'))
  const sql=(client:Pick<PGlite,'query'>):Sql=>({query:async<T>(text:string,values:unknown[])=>(await client.query<T>(text,values)).rows})
  const db:Database={...sql(pg),transaction:f=>pg.transaction(tx=>f(sql(tx)))}
  const a=workspaceService(db,'alice'),b=workspaceService(db,'bob'),wa=await a.createWorkspace({name:'Council'}),wb=await b.createWorkspace({name:'Broker'})
  const ca=await a.createCase(wa.id,{title:'Cambridge synthetic case',sites:[{name:'Site A'},{name:'Site B'},{name:'Site C'}]}),prior=await a.createCase(wa.id,{title:'Earlier case'}),cb=await b.createCase(wb.id,{title:'Secret client'})
  const af=caseFiles(db,'alice',key),bf=caseFiles(db,'bob',key),reader=caseFiles(db,'reader',key)
  const deny=(p:Promise<unknown>)=>assert.rejects(p,(e:unknown)=>e instanceof WorkspaceError&&e.status===404)
  const parsed=await parseFile(await samplePdf(),'inspection.pdf');const imported=await af.import(wa.id,ca.id,parsed,{sourceUrl:'https://example.test/public-record',publicationDate:'2026-09-02'})
  assert.equal((await af.import(wa.id,ca.id,parsed)).duplicate,true)
  assert.equal((await af.original(wa.id,ca.id,imported.documentId)).bytes.equals(Buffer.from(parsed.bytes,'base64')),true)
  await deny(bf.list(wa.id,ca.id));await deny(bf.original(wa.id,ca.id,imported.documentId));await deny(af.list(wb.id,cb.id));await deny(af.list(wa.id,cb.id))
  await af.import(wa.id,prior.id,await parseFile(Buffer.from('Prior case with culvert evidence.'),'earlier.txt'))
  await bf.import(wb.id,cb.id,await parseFile(Buffer.from('Secret client with culvert evidence.'),'secret.txt'))
  assert.equal((await af.search(wa.id,ca.id,'culvert')).length,0);assert.equal((await af.search(wa.id,ca.id,'culvert',true)).length,1)
  const data=await af.list(wa.id,ca.id),e=data.events[0]
  const review={revision:e.revision,title:'Visit recorded',quote:e.quote,eventDate:'2026-09',precision:'MONTH',status:'ACCEPTED',evidenceType:'SOURCE_STATEMENT',note:'Date narrowed by reviewer; does not establish a breach.'}
  await assert.rejects(af.review(wa.id,ca.id,e.id,{...review,quote:'invented quote'}))
  await af.review(wa.id,ca.id,e.id,review);await assert.rejects(af.review(wa.id,ca.id,e.id,review),(x:unknown)=>x instanceof WorkspaceError&&x.status===409)
  const amendment=await af.import(wa.id,ca.id,await parseFile(Buffer.from('2026-09-04 Corrected visit note: the earlier report was amended.'),'inspection-v2.txt'),{supersedesId:imported.documentId})
  assert.equal((await af.list(wa.id,ca.id)).events.find(x=>x.id===e.id)?.superseded,true)
  assert.notEqual(amendment.documentId,imported.documentId)
  await deny(af.export(wa.id,ca.id,renderCase))
  await af.setExport(wa.id,ca.id,true)
  const issued=await af.export(wa.id,ca.id,renderCase),download=await af.downloadExport(wa.id,ca.id,issued.id)
  assert.equal(createHash('sha256').update(download.bytes).digest('hex'),issued.hash)
  const rendered=await parseFile(download.bytes,'reviewed.pdf');assert.match(rendered.passages.map(p=>p.text).join(' '),/Visit recorded/)
  const manifest=JSON.parse((await af.downloadExport(wa.id,ca.id,issued.id,true)).bytes.toString());assert.equal(manifest.events.length,1);assert.equal(manifest.events[0].revision,2);assert.equal(manifest.events[0].precision,'MONTH');assert.equal(manifest.artifactSha256,issued.hash)
  await deny(bf.downloadExport(wa.id,ca.id,issued.id))
  await pg.query('INSERT INTO "PrivateWorkspaceMember" ("workspaceId","userId",role) VALUES ($1,\'reader\',\'VIEWER\')',[wa.id]);await pg.query('INSERT INTO "PrivateCaseMember" ("workspaceId","caseId","userId",role) VALUES ($1,$2,\'reader\',\'VIEWER\')',[wa.id,ca.id])
  assert.equal((await reader.search(wa.id,ca.id,'culvert',true)).length,0)
  await deny(reader.review(wa.id,ca.id,e.id,{...review,revision:2}));await deny(reader.setExport(wa.id,ca.id,true))
  await pg.query('UPDATE "PrivateCaseMember" SET "revokedAt"=now() WHERE "workspaceId"=$1 AND "caseId"=$2 AND "userId"=\'alice\'',[wa.id,ca.id])
  await deny(af.downloadExport(wa.id,ca.id,issued.id));await deny(af.original(wa.id,ca.id,imported.documentId));await deny(af.search(wa.id,ca.id,'visit',true))
 }finally{await pg.close()}
})
