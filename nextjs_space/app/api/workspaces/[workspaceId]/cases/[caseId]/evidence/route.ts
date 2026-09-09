import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { adapter } from '@/lib/workspaces/http'
import { createCaseEndpoint } from '@/lib/workspaces/case-endpoint'
import { scanFile, parseIsolated } from '@/lib/workspaces/parser'
import { renderCase } from '@/lib/workspaces/render-case'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export const maxDuration=60
const handle=createCaseEndpoint({
  getActor:async()=>{const s=await auth();return s?.user?.id??null},
  db:{...adapter(prisma),transaction:operation=>prisma.$transaction(tx=>operation(adapter(tx)),{isolationLevel:'Serializable',timeout:30000})},
  env:process.env,scan:scanFile,parse:parseIsolated,render:renderCase,
})
type Context={params:Promise<{workspaceId:string;caseId:string}>}
export async function GET(request:Request,context:Context){return handle(request,context,false)}
export async function POST(request:Request,context:Context){return handle(request,context,true)}
