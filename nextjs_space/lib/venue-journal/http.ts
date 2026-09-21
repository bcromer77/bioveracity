import { auth } from '@/auth'
import { enabled, hubDb, privateHeaders } from '../wild-hubs/http'
import { HubError } from '../wild-hubs/domain'
import { WorkspaceError } from '../workspaces/service'
import { ScanError } from '../workspaces/scan-file.mjs'
import { journalService } from './service'
export const journalEnabled = () => enabled() && process.env.WILD_PHOTO_JOURNAL_ENABLED === 'true'
export async function journalRequest(operation: (s: ReturnType<typeof journalService>, actorId: string | null)=>Promise<unknown>, signedIn = true) {
 try {
  if (!journalEnabled()) throw new HubError(404, 'Photo journal is not available.')
  const session = await auth()
  const actorId = session?.user?.id || null
  if (signedIn && !actorId) throw new HubError(401, 'Please sign in.')
  const result = await operation(journalService(hubDb,actorId),actorId)
  return result instanceof Response ? result : Response.json(result, {headers:privateHeaders})
 } catch(e) {
  const known = e instanceof HubError || e instanceof WorkspaceError || e instanceof ScanError
  return Response.json({error:known ? e.message : 'Photo journal unavailable. Please reload and try again.'}, {status:known ? e.status : 503,headers:privateHeaders})
 }
}
