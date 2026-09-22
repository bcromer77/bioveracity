import { auth } from '@/auth'
import { redirect, notFound } from 'next/navigation'
import { clubEnabled, hubDb } from '@/lib/club-watch/http'
import { ownedClub } from '@/lib/billing/club-service'
import { ClubPanel } from '@/components/wild/club-panel'
export const dynamic='force-dynamic'
export const metadata={title:'Your club | BioVeracity',robots:{index:false,follow:false}}
export default async function ClubPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params,session=await auth()
  if(!session?.user?.id)redirect(`/login?callbackUrl=${encodeURIComponent(`/wild/studio/${id}/club`)}`)
  if(!clubEnabled())return <main className="p-8">Club membership is not enabled here yet.</main>
  let hub;try{hub=await ownedClub(hubDb,id,session.user.id)}catch{notFound()}
  return <ClubPanel hubId={id} name={hub.name}/>
}
