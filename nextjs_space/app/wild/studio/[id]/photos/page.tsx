import {auth} from '@/auth'
import {notFound,redirect} from 'next/navigation'
import {PublicShell} from '@/components/wild/public-shell'
import {VenuePhotoJournal} from '@/components/wild/venue-photo-journal'
import {journalEnabled} from '@/lib/venue-journal/http'
import {hubDb} from '@/lib/wild-hubs/http'
import {journalService} from '@/lib/venue-journal/service'
export const dynamic='force-dynamic'
export const metadata={title:'Your photo journal | BioVeracity',robots:{index:false,follow:false}}
export default async function Page({params}:{params:Promise<{id:string}>}){
 if(!journalEnabled())notFound()
 const {id}=await params,session=await auth()
 if(!session?.user?.id)redirect(`/login?callbackUrl=${encodeURIComponent(`/wild/studio/${id}/photos`)}`)
 await journalService(hubDb,session.user.id).settings(id)
 return <PublicShell><VenuePhotoJournal hubId={id}/></PublicShell>
}
