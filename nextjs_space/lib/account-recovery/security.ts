import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { Database, Sql } from '../workspaces/service'
import { WorkspaceError } from '../workspaces/service'
import { normaliseEmail } from './email'
import { consumeRateLimit, RATE_LIMITS, type RateLimitBucket } from './rate-limit'

// Only enable after the host confirms it strips and replaces client-supplied headers.
// Without that assurance all requests share a conservative bucket (fail closed).
export function securityIp(request: Request, env: Record<string,string|undefined> = process.env): string {
  if (env.AUTH_TRUST_PROXY_IP !== 'true') return 'untrusted-proxy'
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0,100) || 'unknown'
}
export async function requireLimit(db: Sql, bucket: RateLimitBucket, key: string, at = new Date()) {
  if (!(await consumeRateLimit(db, bucket, key, RATE_LIMITS[bucket], at)).allowed)
    throw new WorkspaceError(429, 'Too many attempts. Please try again later.')
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export const adminAccount = (user: {role?: string; accessState?: string}) => user.role === 'admin' || user.accessState === 'ADMIN'
export function identityService(db: Database, deps: {
  send: (to: string, token: string, purpose: string) => Promise<void>
  compare: (password: string, hash: string) => Promise<boolean>
  now?: () => Date
}) {
  const now = () => deps.now?.() ?? new Date()
  async function issue(input: {email: unknown; password?: unknown; ip: string; purpose: 'VERIFY_EMAIL' | 'ADMIN_LOGIN'}) {
    await requireLimit(db, 'verificationIp', input.ip, now())
    const email = normaliseEmail(input.email)
    if (!email) return {ok:true}
    await requireLimit(db, 'verificationEmail', email, now())
    const [user] = await db.query<{id:string;password:string;emailVerified:Date|null;authVersion:number;role:string;accessState:string}>(
      'SELECT id,password,"emailVerified","authVersion",role,"accessState" FROM "User" WHERE email=$1',[email])
    if (!user || (input.purpose === 'VERIFY_EMAIL' && user.emailVerified)) return {ok:true}
    if (input.purpose === 'ADMIN_LOGIN' && (!adminAccount(user) || typeof input.password !== 'string' || input.password.length > 256 || !user.password || !await deps.compare(input.password,user.password))) return {ok:true}
    const raw = randomBytes(24).toString('hex'), at = now()
    await db.transaction(async sql => {
      await sql.query('SELECT id FROM "User" WHERE id=$1 FOR UPDATE',[user.id])
      await sql.query('UPDATE "IdentityChallenge" SET "consumedAt"=$3 WHERE "userId"=$1 AND purpose=$2 AND "consumedAt" IS NULL',[user.id,input.purpose,at])
      await sql.query('INSERT INTO "IdentityChallenge" (id,"userId",purpose,"tokenHash","authVersion","expiresAt",email) VALUES ($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),user.id,input.purpose,hash(raw),user.authVersion,new Date(at.getTime()+(input.purpose==='ADMIN_LOGIN'?10:60)*60000),email])
    })
    const deliveryKey = `identity:${hash(raw)}`
    await db.query('INSERT INTO "OperationalDelivery" (key,status) VALUES ($1,\'SENDING\')',[deliveryKey])
    try {
      await deps.send(email,raw,input.purpose)
      await db.query('UPDATE "OperationalDelivery" SET status=\'SENT\',"finishedAt"=$2 WHERE key=$1',[deliveryKey,now()])
    }
    catch {
      await db.query('UPDATE "OperationalDelivery" SET status=\'UNKNOWN\',"finishedAt"=$2 WHERE key=$1',[deliveryKey,now()])
      await db.query('UPDATE "IdentityChallenge" SET "consumedAt"=$2 WHERE "tokenHash"=$1',[hash(raw),now()])
      console.error('identity_email_delivery_failed') // No addresses, tokens or provider payloads.
    }
    return {ok:true}
  }
  async function consume(sql: Sql, token: unknown, purpose: string, userId?: string) {
    if(typeof token!=='string'|| !/^[a-f0-9]{48}$/.test(token)) return null
    const [row] = await sql.query<{userId:string}>(`UPDATE "IdentityChallenge" c SET "consumedAt"=$2 FROM "User" u
      WHERE c."userId"=u.id AND c.email=u.email AND c."tokenHash"=$1 AND c.purpose=$3 AND c."consumedAt" IS NULL
      AND c."expiresAt">$2 AND c."authVersion"=u."authVersion" AND ($4::text IS NULL OR u.id=$4)
      RETURNING c."userId"`,[hash(token),now(),purpose,userId??null])
    return row?.userId ?? null
  }
  return {
    issue,
    async verify(token: unknown, ip: string) {
      await requireLimit(db,'verificationSubmit',ip,now())
      return db.transaction(async sql => {
        const id = await consume(sql,token,'VERIFY_EMAIL')
        if(!id) throw new WorkspaceError(400,'This link is invalid or has expired. Request a new email.')
        await sql.query('UPDATE "User" SET "emailVerified"=$2,"updatedAt"=$2 WHERE id=$1',[id,now()])
        return {ok:true}
      })
    },
    async adminCode(token: unknown, userId: string) { return Boolean(await consume(db,token,'ADMIN_LOGIN',userId)) },
  }
}
