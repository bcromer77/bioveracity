import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import type { Database, Sql } from '../lib/workspaces/service'
import { withHeartbeat } from '../lib/operations/service'
import { refreshWatch, type Watch } from '../lib/club-watch/service'
import { reconcileRevolut } from '../lib/billing/club-service'
import { revolutApi, revolutConfig } from '../lib/billing/revolut'

async function main(){
  const operation=process.argv[2]
  if(operation!=='sources'&&operation!=='billing')throw Error('Use sources or billing')
  const gate=operation==='sources'?'CLUB_SOURCE_REFRESH_ENABLED':'REVOLUT_RECONCILE_ENABLED'
  if(process.env.CLUB_LAUNCH_ENABLED!=='true'||process.env.WILD_HUBS_ENABLED!=='true'||process.env[gate]!=='true'){console.log('Club operation disabled.');return}
  const config=revolutConfig(),prisma=new PrismaClient()
  const sql=(client:Pick<PrismaClient,'$queryRawUnsafe'>):Sql=>({query:<T>(q:string,v:unknown[])=>client.$queryRawUnsafe<T[]>(q,...v)})
  const db:Database={...sql(prisma),transaction:run=>prisma.$transaction(tx=>run(sql(tx)),{isolationLevel:'Serializable',timeout:30000})}
  try{
    const result=await withHeartbeat(db,operation==='billing'?'revolut-reconcile':'club-sources',async()=>{
      if(operation==='billing'){
        const out=await reconcileRevolut(db,revolutApi(config),config)
        if(out.failed||out.unresolved)throw Error('Billing reconciliation needs attention')
        return out
      }
      const watches=await db.query<Watch>('SELECT w.* FROM "ClubWatch" w JOIN "ClubSubscription" b ON b."hubId"=w."hubId" JOIN "WildHub" h ON h.id=w."hubId" WHERE w.enabled=true AND b."paidUntil">now() AND b.mode=$1 AND b."ownerId"=h."ownerId" ORDER BY w."hubId" LIMIT 100',[config.mode])
      let failed=0,checked=0
      for(const watch of watches){const results=await refreshWatch(db,watch);checked+=results.length;failed+=results.filter(r=>r.status!=='OK').length}
      if(failed)throw Error('Some source retrievals were incomplete')
      return {checked,failed}
    })
    console.log(JSON.stringify(result))
  }finally{await prisma.$disconnect()}
}
main().catch(()=>{console.error('Club operation needs attention. Inspect heartbeat and private source/billing status; do not retry uncertain payment creation.');process.exitCode=1})
