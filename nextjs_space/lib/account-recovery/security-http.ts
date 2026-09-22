import bcrypt from 'bcryptjs'
import { authReturnPath } from '../auth-return-path'
import { prisma } from '../prisma'
import type { Database, Sql } from '../workspaces/service'
import { identityService } from './security'
import { createEmailer, resolveEmailConfig } from '../email/transactional'
import { resolveAppBaseUrl } from './base-url'
const adapter = (client: Pick<typeof prisma,'$queryRawUnsafe'>): Sql => ({query:<T>(q:string,v:unknown[])=>client.$queryRawUnsafe<T[]>(q,...v)})
export const securityDb: Database = {...adapter(prisma),transaction:fn=>prisma.$transaction(tx=>fn(adapter(tx)),{isolationLevel:'Serializable'})}
export const identities = () => identityService(securityDb,{
  compare:bcrypt.compare,
  send:async(to,token,purpose,returnTo)=>{
    const emailer=createEmailer(resolveEmailConfig(process.env))
    const base=resolveAppBaseUrl(process.env)
    const text=purpose==='ADMIN_LOGIN'
      ? `Your BioVeracity administrator sign-in code is ${token}. It expires in 10 minutes. Do not share this code.`
      : `Confirm your BioVeracity email address: ${base}/verify-email#token=${token}&returnTo=${encodeURIComponent(authReturnPath(returnTo || null))} . This link expires in one hour. If you did not request it, ignore this email.`
    await emailer.send({to,subject:purpose==='ADMIN_LOGIN'?'BioVeracity administrator sign-in':'Confirm your BioVeracity email',text,html:`<p>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>`})
  },
})
