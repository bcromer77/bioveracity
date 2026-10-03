import { journalRequest } from '@/lib/venue-journal/http'
import { body } from '@/lib/workspaces/request-body'
import { record, text } from '@/lib/wild-hubs/domain'
export const dynamic='force-dynamic'
export async function GET(){return journalRequest(s=>s.releaseQueue())}
export async function POST(request:Request){return journalRequest(async s=>{const v=record(await body(request));if(v.action==='verify')return s.verifyRelease(text(v.photoId,100),text(v.note,2000));return s.publicationRelease(text(v.photoId,100),v.use==='venue'?'venue':'bioveracity')})}
