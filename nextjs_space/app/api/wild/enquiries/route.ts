import { prisma } from '@/lib/prisma'
import { notifyFounder } from '@/lib/lead-notification'
import { parseWildEnquiry, wildLeadData } from '@/lib/wild-counties/enquiry'
export const dynamic='force-dynamic'
export async function POST(request:Request){
 let data:ReturnType<typeof wildLeadData>
 try{
   if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'Please send a JSON enquiry.'},{status:415})
   const reader=request.body?.getReader();let text='',size=0;const decoder=new TextDecoder()
   if(reader){while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();return Response.json({error:'Enquiry too large.'},{status:413})}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}
   data=wildLeadData(parseWildEnquiry(JSON.parse(text)))
 }catch(e){return Response.json({error:e instanceof SyntaxError?'Please check the enquiry details.':e instanceof Error?e.message:'Please check the enquiry details.'},{status:400})}
 try{
   // The client reuses a UUID on retry. Primary-key uniqueness handles concurrent submissions.
   const existing=await prisma.lead.findUnique({where:{id:data.id}})
   if(existing){if(existing.email!==data.email||existing.issue!==data.issue||existing.name!==data.name)return Response.json({error:'Please refresh the page before sending a different enquiry.'},{status:409});return Response.json({received:true})}
   const count=await prisma.lead.count({where:{email:data.email,role:'Wild community enquiry',createdAt:{gte:new Date(Date.now()-3600000)}}})
   if(count>=3)return Response.json({error:'Please wait before sending another enquiry.'},{status:429,headers:{'Retry-After':'3600'}})
   try{await prisma.lead.create({data})}catch(e){
     if((e as {code?:string}).code!=='P2002')throw e
     const saved=await prisma.lead.findUnique({where:{id:data.id}})
     if(saved?.email===data.email&&saved.issue===data.issue&&saved.name===data.name)return Response.json({received:true})
     return Response.json({error:'Please refresh the page and try again.'},{status:409})
   }
   await notifyFounder(data)
   return Response.json({received:true},{status:201})
 }catch{return Response.json({error:'We could not save your enquiry. Your details are still in the form; please try again.'},{status:503})}
}
