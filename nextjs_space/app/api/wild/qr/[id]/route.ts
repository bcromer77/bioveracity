import QRCode from 'qrcode'
import { publicWildOrigin } from '@/lib/wild-counties/venues'
import { hasPublicVenue } from '@/lib/wild-hubs/public'
export const dynamic='force-dynamic'
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params
 try{if(!await hasPublicVenue(id))return new Response('Venue not found',{status:404,headers:{'Cache-Control':'no-store'}})}catch{return new Response('Ecology hub temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
 const origin=publicWildOrigin()
 if(!origin)return new Response('Public site address is not configured',{status:503})
 const svg=await QRCode.toString(`${origin}/wild/q/${id}`,{type:'svg',errorCorrectionLevel:'M',margin:4,width:512,color:{dark:'#173d35',light:'#ffffff'}})
 const headers:Record<string,string>={'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 if(new URL(request.url).searchParams.get('download')==='1')headers['Content-Disposition']=`attachment; filename="${id}${id.startsWith('example-')?'-concept':''}-qr.svg"`
 return new Response(svg,{headers})
}
