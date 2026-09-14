import { hasPublicVenue } from '@/lib/wild-hubs/public'
export const dynamic='force-dynamic'
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params
 try{
  if(!await hasPublicVenue(id))return new Response('Venue not found',{status:404,headers:{'Cache-Control':'no-store'}})
  return new Response(null,{status:307,headers:{Location:`/wild/places/${id}`,'Cache-Control':'no-store'}})
 }catch{return new Response('Ecology hub temporarily unavailable',{status:503,headers:{'Cache-Control':'no-store'}})}
}
