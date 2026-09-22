import { auth } from '@/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { clubEnabled, hubDb } from '@/lib/club-watch/http'
import { admin } from '@/lib/club-watch/service'
import { ClubPanel } from '@/components/wild/club-panel'
export const dynamic='force-dynamic'
export const metadata={title:'Club source review | BioVeracity',robots:{index:false,follow:false}}
export default async function ClubAdminPage({searchParams}:{searchParams:Promise<{hub?:string}>}){
  const session=await auth()
  if(!session?.user?.id)redirect('/login?callbackUrl=%2Fadmin%2Fwild%2Fclubs')
  await admin(hubDb,session.user.id)
  if(!clubEnabled())return <main className="p-8">Club launch is disabled.</main>
  const hubs=await hubDb.query<{id:string;name:string}>('SELECT id,profile->>\'name\' AS name FROM "WildHub" ORDER BY "createdAt" DESC LIMIT 200',[])
  const {hub}=await searchParams,chosen=hubs.find(h=>h.id===hub)
  return <><nav className="p-4"><Link className="underline" href="/admin/wild/launch">Venue launch desk</Link><ul>{hubs.map(h=><li key={h.id}><Link className="underline" href={`/admin/wild/clubs?hub=${encodeURIComponent(h.id)}`}>{h.name}</Link></li>)}</ul></nav>{chosen&&<ClubPanel key={chosen.id} hubId={chosen.id} name={chosen.name} admin/>}</>
}
