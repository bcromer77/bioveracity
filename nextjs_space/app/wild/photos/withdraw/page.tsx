import {PublicShell} from '@/components/wild/public-shell'
import {VenuePhotoWithdraw} from '@/components/wild/venue-photo-withdraw'
export const metadata={title:'Photo receipt | BioVeracity',robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default function Page(){return <PublicShell><VenuePhotoWithdraw/></PublicShell>}
