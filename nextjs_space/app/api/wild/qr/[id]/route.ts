import QRCode from 'qrcode'
import { getWildVenue, publicWildOrigin } from '@/lib/wild-counties/venues'
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!getWildVenue(id))return new Response('Venue not found',{status:404})
 const origin=publicWildOrigin()
 if(!origin)return new Response('Public site address is not configured',{status:503})
 const svg=await QRCode.toString(`${origin}/wild/q/${id}`,{type:'svg',errorCorrectionLevel:'M',margin:4,width:512,color:{dark:'#173d35',light:'#ffffff'}})
 const headers:Record<string,string>={'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
 if(new URL(request.url).searchParams.get('download')==='1')headers['Content-Disposition']=`attachment; filename="${id}-concept-qr.svg"`
 return new Response(svg,{headers})
}
