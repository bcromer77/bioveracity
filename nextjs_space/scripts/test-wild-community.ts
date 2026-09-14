import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { parseWildEnquiry, wildLeadData } from '../lib/wild-counties/enquiry'
import { getWildVenue, publicWildOrigin } from '../lib/wild-counties/venues'
import { GET as redirect } from '../app/wild/q/[id]/route'
import { GET as qr } from '../app/api/wild/qr/[id]/route'
import { POST } from '../app/api/wild/enquiries/route'
import { prisma } from '../lib/prisma'

async function main(){
const input={venue:'A venue',email:'OWNER@EXAMPLE.COM',website:'https://example.com',requestId:randomUUID()}
assert.equal(parseWildEnquiry(input).email,'owner@example.com')
for(const patch of [{venue:''},{email:'bad'},{website:'javascript:alert(1)'},{website:'https://name:password@example.com'},{requestId:'bad'},{company:'spam'},{message:'x'.repeat(2001)}])assert.throws(()=>parseWildEnquiry({...input,...patch}))
assert.equal(getWildVenue('example-woodland-venue')?.status,'concept');assert.equal(getWildVenue('not-a-venue'),undefined)
process.env.WILD_PUBLIC_ORIGIN='https://wild-preview.example/path';assert.equal(publicWildOrigin(),null)
assert.equal((await qr(new Request('https://untrusted.example'),{params:Promise.resolve({id:'example-woodland-venue'})})).status,503)
process.env.WILD_PUBLIC_ORIGIN='https://wild-preview.example'
const jump=await redirect(new Request('https://untrusted.example'),{params:Promise.resolve({id:'example-woodland-venue'})})
assert.equal(jump.headers.get('location'),'/wild/places/example-woodland-venue')
assert.equal((await redirect(new Request('https://example.com'),{params:Promise.resolve({id:'unknown'})})).status,404)
const code=await qr(new Request('https://evil.example?download=1'),{params:Promise.resolve({id:'example-woodland-venue'})})
assert.equal(code.status,200);assert.match(code.headers.get('content-disposition')!,/concept-qr.svg/);assert.match(await code.text(),/<svg/)
// Isolated persistence double: no real database or notification is contacted.
const rows=new Map<string,ReturnType<typeof wildLeadData>>()
let notifications=0,offline=false
const originalFetch=globalThis.fetch
const original={findUnique:prisma.lead.findUnique,count:prisma.lead.count,create:prisma.lead.create}
Object.assign(prisma.lead,{
 findUnique:async({where}:{where:{id:string}})=>{if(offline)throw Error('offline');return rows.get(where.id)||null},
 count:async()=>rows.size,
 create:async({data}:{data:ReturnType<typeof wildLeadData>})=>{if(rows.has(data.id))throw Object.assign(Error('duplicate'),{code:'P2002'});rows.set(data.id,data);return data},
})
globalThis.fetch=async()=>{notifications++;return Response.json({success:true})}
const request=(data:unknown)=>new Request('https://example.com/api/wild/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
try{
 assert.equal((await POST(request(input))).status,201)
 assert.equal((await POST(request(input))).status,200)
 assert.equal(rows.size,1);assert.equal(notifications,1)
 assert.equal((await POST(request({...input,venue:'Different'}))).status,409)
 assert.equal((await POST(request({...input,email:'bad'}))).status,400)
 assert.equal((await POST(request({...input,message:'a'.repeat(13000)}))).status,413)
 for(let i=0;i<2;i++)assert.equal((await POST(request({...input,requestId:randomUUID()}))).status,201)
 assert.equal((await POST(request({...input,requestId:randomUUID()}))).status,429)
 offline=true;const failure=await POST(request({...input,requestId:randomUUID()}));assert.equal(failure.status,503);assert.equal((await failure.json()).received,undefined)
}finally{Object.assign(prisma.lead,original);globalThis.fetch=originalFetch;await prisma.$disconnect()}
console.log('PASS: input validation, safe QR origins, unknown IDs, download headers, durable acknowledgement, retry deduplication, conflict, throttling and storage failure; database and notification isolated.')
}
main().catch(e=>{console.error(e);process.exitCode=1})
