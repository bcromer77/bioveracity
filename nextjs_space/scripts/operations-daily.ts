import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { createEmailer, resolveEmailConfig } from '../lib/email/transactional'
import { privacyNotifications, withHeartbeat } from '../lib/operations/service'
const prisma=new PrismaClient()
const db={query:<T>(q:string,v:unknown[])=>prisma.$queryRawUnsafe<T[]>(q,...v)}
async function main(){
 if(process.env.OPERATIONS_SEND_ENABLED!=='true'){console.log('Operational email disabled.');return}
 const send=createEmailer(resolveEmailConfig(process.env)).send
 await withHeartbeat(db,'privacy-notifications',async()=>{
  const results:string[]=[]
  for(const recipient of new Set([process.env.PRIVACY_OPERATOR_EMAIL||'',process.env.PRIVACY_DEPUTY_EMAIL||''])) {
   results.push(...await privacyNotifications(db,send,process.env.APP_BASE_URL||'',recipient))
  }
  if(results.includes('UNKNOWN'))throw Error('Delivery confirmation unavailable')
  console.log(JSON.stringify({processed:results.length}))
 })
 // Bounded housekeeping; no user content is removed.
 await db.query('DELETE FROM "AuthRateLimit" WHERE "windowStart"<now()-interval \'7 days\'',[])
 await db.query('DELETE FROM "IdentityChallenge" WHERE "expiresAt"<now()-interval \'7 days\'',[])
}
main().catch(()=>{console.error('operations_daily_failed: inspect private delivery status before retrying.');process.exitCode=1}).finally(()=>prisma.$disconnect())
