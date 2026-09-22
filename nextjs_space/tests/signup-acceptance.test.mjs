import {test,after} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp,rm} from 'node:fs/promises'
import path from 'node:path'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
const dir=await mkdtemp(path.join(process.cwd(),'.signup-api-'))
const previous=process.env.DATA_RIGHTS_ENABLED
after(async()=>{await rm(dir,{recursive:true,force:true});if(previous===undefined)delete process.env.DATA_RIGHTS_ENABLED;else process.env.DATA_RIGHTS_ENABLED=previous;delete globalThis.__signupDb})
await build({entryPoints:['app/api/signup/route.ts'],outfile:path.join(dir,'route.mjs'),bundle:true,platform:'node',format:'esm',packages:'external',plugins:[{name:'isolated-signup',setup(b){
 b.onResolve({filter:/^next\/server$/},()=>({path:'next/server.js',external:true}))
 b.onResolve({filter:/^@\/lib\/(prisma|workspaces\/http|account-recovery\/security-http|account-recovery\/security)$/},a=>({path:a.path,namespace:'isolated'}))
 b.onLoad({filter:/.*/,namespace:'isolated'},a=>({loader:'js',contents:a.path.endsWith('/prisma')?'export const prisma={user:{findUnique:async()=>null},$transaction:async fn=>fn(globalThis.__signupDb)}':a.path.endsWith('/http')?'export const adapter=tx=>tx':a.path.endsWith('/security-http')?'export const securityDb={};export const identities=()=>({issue:async()=>{}})':'export const requireLimit=async()=>{};export const securityIp=()=>"synthetic"'}))
}}]})
const {POST}=await import(pathToFileURL(path.join(dir,'route.mjs')))
test('signup API requires current acceptance even when data-rights controls are disabled, and records it in the account transaction',async()=>{
 process.env.DATA_RIGHTS_ENABLED='false';let accounts=0,acceptances=0
 globalThis.__signupDb={user:{create:async({data})=>{accounts++;return {id:'synthetic',...data}}},query:async(q)=>{assert.match(q,/TermsAcceptance/);acceptances++;return []}}
 const payload={name:'Synthetic owner',email:'owner@example.test',password:'Synthetic-password-2026',termsVersion:'2026-09-22.1',privacyVersion:'2026-09-22.1'}
 const request=input=>new Request('https://qa.example.test/api/signup',{method:'POST',headers:{origin:'https://qa.example.test','content-type':'application/json'},body:JSON.stringify(input)})
 assert.equal((await POST(request(payload))).status,400);assert.equal(accounts,0)
 assert.equal((await POST(request({...payload,acceptTerms:true,termsVersion:'old'}))).status,400);assert.equal(accounts,0)
 assert.equal((await POST(request({...payload,acceptTerms:true}))).status,200);assert.equal(accounts,1);assert.equal(acceptances,1)
})
