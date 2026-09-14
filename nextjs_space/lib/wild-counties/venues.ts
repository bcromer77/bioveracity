import { getWildCounty } from './counties'
import type { WildTopic } from './types'

// Stable IDs are never reused. These two records are FICTIONAL EXAMPLES — illustrative
// venues used to demonstrate the guest experience. They are not real businesses, and
// naming, story text and marketing captions are placeholders written by BioVeracity to
// show the layout, never statements supplied by a real venue.
type VenueImage = { src: string; alt: string; caption: string; credit: string }
type SeasonalFeature = { title: string; body: string }
type VenueSeed = {
  id: string
  county: string
  name: string
  locality: string
  heading: string
  content: string
  story: string
  /** Slugs of the county's reviewed topics shown as "nearby discoveries" (each keeps its own source). */
  discoverySlugs: readonly string[]
  seasonalFeature: SeasonalFeature
  guestPrompt: string
  /** Editable marketing-caption EXAMPLES — illustrative wording a partner could adapt, clearly labelled. */
  captions: readonly string[]
  image: VenueImage
}

const VENUES: readonly VenueSeed[] = [
  {
    id: 'example-woodland-venue',
    county: 'down',
    name: 'The Drumlin Byre',
    locality: 'Near Downpatrick, County Down · Fictional example',
    heading: 'A restored stone byre where a country stay opens onto Strangford, Lecale and the Mournes.',
    content: 'Imagine your stay, food, people or visitor experience here, told through photographs and words you have approved.',
    story: 'Picture a converted farm byre set among the drumlins between the fens of Lecale and the shores of Strangford Lough. Guests wake to birdsong over the wetlands, walk the AONB coast by day and watch the light change on the Mourne skyline at dusk. Every nature note a guest reads here is checked against a named public source — so the sense of place is real, even when the venue is an illustration.',
    discoverySlugs: ['strangford-lecale-aonb', 'murlough', 'mourne-aonb'],
    seasonalFeature: {
      title: 'This season: brent geese arrive on the Lough',
      body: 'From autumn, thousands of pale-bellied brent geese arrive on Strangford Lough from the Arctic — one of the great wildlife spectacles on the doorstep. It is the season to point guests towards the shoreline at high tide.',
    },
    guestPrompt: 'What did you notice on the shore or the hills today? Tell us at the desk — the best guest observations help shape next season’s discovery guide.',
    captions: [
      'Wake between the Lough and the Mournes. Nature notes you can trust, checked against public sources.',
      'Autumn on the doorstep: brent geese on Strangford, quiet shore walks at Murlough, long views to the Mournes.',
      'A country stay in the heart of the Strangford & Lecale AONB — with a discovery guide to the places around us.',
    ],
    image: {
      src: '/example-down.jpg',
      alt: 'The wide sandy beach and dunes at Murlough, County Down, a Special Area of Conservation, with the Mourne Mountains beyond.',
      caption: 'Murlough National Nature Reserve, County Down — a representative landscape near this example venue, not a photograph of the venue itself.',
      credit: 'Photograph: Conall (CC BY 2.0), via Wikimedia Commons',
    },
  },
  {
    id: 'example-craft-venue',
    county: 'kilkenny',
    name: 'The Riverside Kiln',
    locality: 'Kilkenny city · Fictional example',
    heading: 'A working pottery and café beside the Nore, where craft and river meet.',
    content: 'Imagine your pottery, designs and visitor experience here, told through photographs and words you have approved.',
    story: 'Picture a working studio and café on the banks of the River Nore, a short walk from Kilkenny Castle. Visitors watch the wheel turn, then follow the riverside path where otters move at dawn and dusk and the castle parklands turn gold in autumn. The making and the river share one story — and every wildlife note is tied to its public source.',
    discoverySlugs: ['river-nore', 'castle-parklands', 'otters'],
    seasonalFeature: {
      title: 'This season: autumn colour in the castle parklands',
      body: 'Autumn lights up the mature trees of the Kilkenny Castle parklands and the arboretum at Woodstock. It is the season to send visitors out along the Nore with a flask and a reason to look up.',
    },
    guestPrompt: 'Seen an otter, a kingfisher or a heron along the Nore? Add your sighting at the counter — verified guest notes help us keep the discovery guide current.',
    captions: [
      'Watch the wheel turn, then walk the Nore. A pottery and café where craft and river meet.',
      'Otters at dawn, castle parklands in autumn colour — the river is part of the experience here.',
      'By the River Nore in Kilkenny city: handmade work, good coffee and a source-checked guide to the wildlife next door.',
    ],
    image: {
      src: '/hero-otter.jpg',
      alt: 'A Eurasian otter at the water’s edge — a qualifying species of the River Barrow and River Nore Special Area of Conservation.',
      caption: 'Eurasian otter — a qualifying species of the River Nore SAC, near this example venue. Not a photograph of the venue itself.',
      credit: 'Photograph: Byrdyak (CC BY-SA 4.0), via Wikimedia Commons',
    },
  },
]

export function getWildVenue(id: string) {
  const venue = VENUES.find((v) => v.id === id)
  if (!venue) return undefined
  const countyData = getWildCounty(venue.county)!
  const bySlug = new Map(countyData.topics.map((t) => [t.slug, t]))
  const discoveries = venue.discoverySlugs
    .map((slug) => bySlug.get(slug))
    .filter((t): t is WildTopic => Boolean(t))
  return { ...venue, countyData, discoveries, status: 'concept' as const }
}

export function venueIdForCounty(county: string) {
  return VENUES.find((v) => v.county === county)?.id
}

export function publicWildOrigin() {
  const value = process.env.WILD_PUBLIC_ORIGIN
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null
    return url.origin
  } catch {
    return null
  }
}
