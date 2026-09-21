import {VenuePhotoReviews} from '@/components/admin/venue-photo-reviews'
import Link from 'next/link'
export const dynamic='force-dynamic'
export default function Page(){return <main className="mx-auto max-w-4xl space-y-6 p-8"><h1 className="text-3xl font-semibold">Venue photo review</h1><Link href="/admin/wild">Back to venue editorial review</Link><VenuePhotoReviews/></main>}
