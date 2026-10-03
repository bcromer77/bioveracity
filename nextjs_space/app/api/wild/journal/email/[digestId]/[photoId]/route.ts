import sharp from 'sharp'
import { journalEnabled } from '@/lib/venue-journal/http'
import { hubDb, privateHeaders } from '@/lib/wild-hubs/http'
import { emailPhoto } from '@/lib/venue-journal/digest'
export const dynamic='force-dynamic'
export const runtime='nodejs'
export async function GET(request:Request,{params}:{params:Promise<{digestId:string;photoId:string}>}) {
 try {
  if(!journalEnabled()) return new Response('Not found',{status:404,headers:privateHeaders})
  const {digestId,photoId}=await params
  const bytes=await emailPhoto(hubDb,digestId,photoId,new URL(request.url).searchParams.get('token') || '')
  if(!bytes) return new Response('Preview expired or unavailable',{status:404,headers:privateHeaders})
  const thumbnail=await sharp(Buffer.from(bytes)).resize({width:480,withoutEnlargement:true}).jpeg({quality:70}).toBuffer()
  return new Response(new Uint8Array(thumbnail),{headers:{...privateHeaders,'Content-Type':'image/jpeg','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'}})
 } catch {return new Response('Preview unavailable',{status:503,headers:privateHeaders})}
}
