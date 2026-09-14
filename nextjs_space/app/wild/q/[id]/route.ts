import { NextResponse } from 'next/server'
import { getWildVenue } from '@/lib/wild-counties/venues'
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params
 if(!getWildVenue(id))return new NextResponse('This Wild venue is not available.',{status:404})
 // Relative internal target: no user-supplied host or external redirect destination.
 return new NextResponse(null,{status:307,headers:{Location:`/wild/places/${id}`,'Cache-Control':'no-store'}})
}
