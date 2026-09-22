import 'dotenv/config'
import { withHeartbeat } from '../lib/operations/service'
import { PrismaClient } from '@prisma/client'
import type { Database, Sql } from '../lib/workspaces/service'
import { createEmailer, resolveEmailConfig } from '../lib/email/transactional'
import { sendWeeklyDigests } from '../lib/venue-journal/digest'
async function main(){
 if(process.env.WILD_HUBS_ENABLED!=='true'||process.env.WILD_PHOTO_JOURNAL_ENABLED!=='true'||process.env.WILD_PHOTO_DIGEST_SEND_ENABLED!=='true'){
  console.log('Weekly photo delivery disabled.');return
 }
 // Fail before claiming any messages when provider configuration is missing.
 const config=resolveEmailConfig(process.env)
 if(config.provider!=='resend')throw Error('Venue photo digests require the Resend provider; Abacus notification-disabled responses are not delivery confirmation.')
 const emailer=createEmailer(config)
 const origin=process.env.APP_BASE_URL||''
 const prisma=new PrismaClient()
 const adapter=(client:Pick<PrismaClient,'$queryRawUnsafe'>):Sql=>({query:<T>(q:string,v:unknown[])=>client.$queryRawUnsafe<T[]>(q,...v)})
 const db:Database={...adapter(prisma),transaction:fn=>prisma.$transaction(tx=>fn(adapter(tx)),{isolationLevel:'Serializable'})}
 try{
  const results=await withHeartbeat(db,'venue-photo-digest',async()=>{
   const out=await sendWeeklyDigests(db,emailer.send,origin)
   if(out.some(r=>r.status==='UNKNOWN'))throw Error('Digest delivery ambiguous')
   return out
  })
  const counts=results.reduce<Record<string,number>>((acc,r)=>({...acc,[r.status]:(acc[r.status]||0)+1}),{})
  console.log(JSON.stringify(counts))
  if(results.some(r=>r.status==='UNKNOWN'))process.exitCode=1
 }finally{await prisma.$disconnect()}
}
main().catch(()=>{console.error('Weekly photo delivery failed. Inspect delivery status before any retry; no recipients or tokens are logged.');process.exitCode=1})
