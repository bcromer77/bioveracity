import { CountyNature } from '@/components/wild/county-nature'
import { EvidenceLink } from '@/components/evidence-link'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PublicShell } from '@/components/wild/public-shell'
import { getWildVenue, publicWildOrigin } from '@/lib/wild-counties/venues'
import { getPublishedHub } from '@/lib/wild-hubs/public'
import { hubDb } from '@/lib/wild-hubs/http'
import { PublishedHub } from '@/components/wild/published-hub'
import type { Photo } from '@/lib/wild-hubs/service'
export const dynamic='force-dynamic'
export const metadata={title:'Ecology hub | BioVeracity Wild',robots:{index:false,follow:false}}
export default async function VenuePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const venue=getWildVenue(id)
 if(!venue){
  const snapshot=await getPublishedHub(id);if(!snapshot)notFound()
  const photos=snapshot.photoIds.length?await hubDb.query<Photo>('SELECT "id","caption","credit" FROM "WildHubPhoto" WHERE "hubId"=$1 AND "id"=ANY($2::text[]) ORDER BY "createdAt","id"',[id,snapshot.photoIds]):[]
  return <PublishedHub id={id} snapshot={snapshot} photos={photos}/>
 }
 const origin=publicWildOrigin()
 return <PublicShell><div className="bv-demo">Fictional example · Not a real venue or a signed-up partner</div>
 <section className="bv-hero bv-split"><div><Link className="bv-eyebrow" href={`/wild/${venue.county}`}>{venue.countyData.brandName}</Link><p className="bv-small">{venue.locality}</p><h1>{venue.name}</h1><p className="bv-intro">{venue.heading}</p><Link className="bv-button" href="/wild/studio">Create your ecology hub ↗</Link></div><div className="bv-story-panel"><p className="bv-eyebrow">Your own story</p><h2>People.<br />Place.<br /><em>Possibility.</em></h2><p>{venue.content}</p><p className="bv-small">This text demonstrates the layout. It is not a statement supplied by the venue.</p></div></section>
 <section className="bv-section"><CountyNature county={venue.county}/></section>
 <section className="bv-section bv-tinted bv-split"><div><p className="bv-eyebrow">One code. Your own starting point.</p><h2>Scan here.<br /><em>Start discovering.</em></h2><p>A venue-specific QR code connects the sign to this page. The address stays stable while approved content changes.</p><p className="bv-small">Example code only. Confirm the published destination before printing signage.</p></div><div className="bv-qr">{origin?<><img src={`/api/wild/qr/${venue.id}`} alt={`QR code opening the ${venue.name} concept page`} width="256" height="256"/><EvidenceLink className="bv-button bv-green" download={`${venue.id}-concept-qr.svg`} href={`/api/wild/qr/${venue.id}?download=1`}>Download example QR</EvidenceLink><p className="bv-small">{origin}/wild/q/{venue.id}</p></>:<p>Your downloadable example QR will appear when the public site address is configured.</p>}</div></section>
 <section className="bv-section"><h2>Make this experience yours.</h2><p>Your content. Your place. Your Wild County.</p><Link className="bv-button bv-green" href="/wild/partners#enquire">Contact us for pricing</Link></section>
 </PublicShell>
}
