import { getWildCounty } from './counties'
// Stable IDs are never reused. These two records are fictional examples, not real businesses or members.
const VENUES = [
  { id:'example-woodland-venue',county:'down',name:'Your ecology hub',locality:'County Down · Fictional example',heading:'A place to pause. A world to discover.',content:'Imagine your stay, food, people or visitor experience here, told through photographs and words you have approved.' },
  { id:'example-craft-venue',county:'kilkenny',name:'Your craft ecology hub',locality:'Kilkenny · Fictional example',heading:'Start with the making. Discover the place.',content:'Imagine your pottery, designs and visitor experience here, told through photographs and words you have approved.' },
] as const
export function getWildVenue(id:string){const venue=VENUES.find(v=>v.id===id);return venue?{...venue,countyData:getWildCounty(venue.county)!,status:'concept' as const}:undefined}
export function publicWildOrigin(){
  const value=process.env.WILD_PUBLIC_ORIGIN
  if(!value) return null
  try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)return null;return url.origin}catch{return null}
}
