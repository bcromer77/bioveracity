// Synthetic fixtures that exercise the shared Edition + renderer across all four
// supported business types. Every fixture is CLEARLY FICTIONAL — no real venue is
// named, and nothing here implies participation by any real business (including
// Nicholas Mosse). One fixture deliberately stresses the layout with long names,
// Irish accents and scientific names, and mixed photo proportions.
//
// The ecology cards use plausible-but-synthetic sourced records so the renderer
// can be inspected end to end; they are test data, not published claims.

import type { Edition, EditionPhoto } from './edition'

import path from 'path'
const FIX = process.env.BROCHURE_FIXTURE_DIR || path.join(process.cwd(), 'dev-assets', 'brochure-fixtures')
const img = (name: string) => `${FIX}/${name}`

const photo = (p: Partial<EditionPhoto> & { id: string; src: string; sequence: number }): EditionPhoto => ({
  caption: '',
  credit: '',
  rightsConfirmed: true,
  ...p,
})

export const potteryFixture: Edition = {
  schemaVersion: 'bv-edition/1',
  venueName: 'Blackwater Slipware Studio',
  businessType: 'pottery_craft',
  headline: 'Where river clay becomes a morning cup',
  landscapeConnection:
    'The studio sits above a bend in the Blackwater, on the same seam of soft river clay potters here have dug for generations. The water that shapes the valley also shaped the craft: slow, local and rooted in this ground.',
  story:
    'Every piece is thrown by hand and decorated with slip in the spongeware tradition, using patterns drawn from the hedgerows and water meadows just beyond the workshop windows. Glazes are mixed in small batches; each mug, bowl and jug is finished, fired and checked in the room where it was made. Visitors can watch the wheel at work on weekday mornings and see the drying racks, the kiln and the decorators’ benches.',
  workingLifeFacts: [
    'Hand-thrown and slip-decorated on site, six days a week.',
    'Small-batch glazes mixed in the workshop — no two runs are identical.',
    'Seconds and studio tours available; the wheel runs on weekday mornings.',
  ],
  photos: [
    photo({ id: 'pot-cover', src: img('landscape.jpg'), sequence: 1, isCover: true, orientation: 'landscape', caption: 'The studio above the river bend', credit: 'Studio archive', focal: { x: 0.5, y: 0.45 } }),
    photo({ id: 'pot-detail', src: img('square.jpg'), sequence: 2, orientation: 'square', caption: 'Slip decoration on a freshly thrown bowl', credit: 'Studio archive' }),
    photo({ id: 'pot-wheel', src: img('portrait.jpg'), sequence: 3, orientation: 'portrait', caption: 'At the wheel on a weekday morning', credit: 'Studio archive' }),
  ],
  ecologyCards: [
    { id: 'e1', commonName: 'Kingfisher', scientificName: 'Alcedo atthis', scope: 'wider-area', sourceIds: ['s1'], body: 'The Blackwater corridor supports breeding kingfishers, which nest in tunnels dug into soft riverbanks. Records for the wider catchment note them along slow, clear stretches with overhanging perches.' },
    { id: 'e2', commonName: 'Otter', scientificName: 'Lutra lutra', scope: 'wider-area', sourceIds: ['s2'], body: 'Otters are recorded throughout the river system. They are protected and largely nocturnal; signs such as spraints on rocks are more often seen than the animals themselves.' },
    { id: 'e3', commonName: 'Alder', scientificName: 'Alnus glutinosa', scope: 'wider-area', sourceIds: ['s3'], body: 'Alder lines much of the riverbank here, holding the soil that yields the studio’s clay. Its roots fix nitrogen and its winter catkins are an early food source along the water.' },
  ],
  guidance: {
    notice: ['A low, electric-blue dart over the water — a kingfisher on the move.', 'Alder catkins and cones along the bank in winter.'],
    wonder: ['How many generations have dug clay from this same bend?', 'Where does the river go after it leaves the valley?'],
    remember: ['Keep to the path above the bank; nesting tunnels are fragile.', 'Take litter home — clear water is why the wildlife is here.'],
  },
  visitor: {
    addressLines: ['Blackwater Slipware Studio', 'Riverside Lane', 'Co. Waterford'],
    openingInfo: 'Workshop and shop open Tuesday to Sunday, 10am–5pm. Wheel demonstrations on weekday mornings.',
    accessNotes: 'Level access to the shop and viewing gallery; the riverside path is uneven in places. Please visit quietly near the water.',
    officialUrl: 'https://example.com/blackwater-slipware',
    qrTarget: 'https://example.com/blackwater-slipware',
    qrIsOfficialUrl: true,
  },
  sources: [
    { id: 's1', title: 'National Biodiversity Data Centre — Kingfisher distribution (synthetic sample)', publisher: 'NBDC', url: 'https://example.com/nbdc/kingfisher', locator: 'Catchment summary', geographicScope: 'Munster Blackwater catchment', retrievedAt: '2026-08-30' },
    { id: 's2', title: 'NPWS — Otter conservation status (synthetic sample)', publisher: 'NPWS', url: 'https://example.com/npws/otter', locator: 'Article 17 summary', geographicScope: 'Republic of Ireland', retrievedAt: '2026-08-30' },
    { id: 's3', title: 'Riparian woodland of the Blackwater (synthetic sample)', publisher: 'Teagasc', url: 'https://example.com/teagasc/alder', geographicScope: 'Co. Waterford', retrievedAt: '2026-08-29' },
  ],
  status: 'DRAFT',
  revision: 1,
  editionDate: '2026-09-14',
}

export const hotelFixture: Edition = {
  schemaVersion: 'bv-edition/1',
  venueName: 'Cloonagh House',
  businessType: 'hotel_guesthouse',
  headline: 'A country house between the lake and the limestone',
  landscapeConnection:
    'Cloonagh House looks out over a spring-fed lake edged with limestone pavement. The same porous stone that feeds the lake gives the gardens their lime-loving flowers and the house its long, clear views.',
  story:
    'A family-run country house of twelve rooms, Cloonagh has welcomed guests for three generations. Meals use produce from the walled garden and neighbouring farms; breakfasts feature bread baked each morning. Guests are welcome to walk the grounds, borrow binoculars for the lake hide, and warm up by turf fires in the evening.',
  workingLifeFacts: ['Twelve rooms, family-run for three generations.', 'Kitchen garden and local suppliers; bread baked daily.', 'Lake hide and binoculars available to guests.'],
  photos: [
    photo({ id: 'ho-cover', src: img('pano.jpg'), sequence: 1, isCover: true, orientation: 'landscape', caption: 'The house above the spring-fed lake', credit: 'Cloonagh House', focal: { x: 0.5, y: 0.5 } }),
    photo({ id: 'ho-room', src: img('landscape.jpg'), sequence: 2, orientation: 'landscape', caption: 'A lake-view room', credit: 'Cloonagh House' }),
    photo({ id: 'ho-garden', src: img('portrait.jpg'), sequence: 3, orientation: 'portrait', caption: 'The walled kitchen garden', credit: 'Cloonagh House' }),
  ],
  ecologyCards: [
    { id: 'e1', commonName: 'Great crested grebe', scientificName: 'Podiceps cristatus', scope: 'wider-area', sourceIds: ['s1'], body: 'The lake and others like it in the area hold breeding great crested grebes, known for their spring courtship display. They favour clear, sheltered water with reedy margins.' },
    { id: 'e2', commonName: 'Mountain avens', scientificName: 'Dryas octopetala', scope: 'wider-area', sourceIds: ['s2'], body: 'On the surrounding limestone, arctic-alpine plants such as mountain avens grow at unusually low altitude — a signature of this landscape’s bare, lime-rich pavement.' },
    { id: 'e3', commonName: 'Brown trout', scientificName: 'Salmo trutta', scope: 'wider-area', sourceIds: ['s3'], body: 'Spring-fed lakes in the district support wild brown trout, which depend on cool, well-oxygenated water and clean gravel for spawning.' },
    { id: 'e4', commonName: 'Hazel', scientificName: 'Corylus avellana', scope: 'wider-area', sourceIds: ['s2'], body: 'Hazel scrub is characteristic of the limestone here, forming a low woodland that shelters a rich ground flora and supports feeding birds through autumn.' },
  ],
  guidance: {
    notice: ['A grebe carrying stripe-headed chicks on its back in early summer.', 'How flowers change as you step from garden soil onto bare limestone.'],
    wonder: ['Where does the spring that feeds the lake rise?', 'Why do mountain plants grow at lake level here?'],
    remember: ['Watch the lake from the hide so nesting birds are not disturbed.', 'Leave flowers and stone as you find them.'],
  },
  visitor: {
    addressLines: ['Cloonagh House', 'Near the lake road', 'Co. Clare'],
    openingInfo: 'Open year-round to residents. Non-resident dinner by reservation.',
    accessNotes: 'Ground-floor rooms available; garden paths are gravelled. The lake hide is a short level walk from the house.',
    officialUrl: 'https://example.com/cloonagh-house',
    qrTarget: 'https://example.com/cloonagh-house',
    qrIsOfficialUrl: true,
  },
  sources: [
    { id: 's1', title: 'BirdWatch lake survey (synthetic sample)', publisher: 'BirdWatch Ireland', url: 'https://example.com/bw/grebe', geographicScope: 'Mid-west lakes', retrievedAt: '2026-09-01' },
    { id: 's2', title: 'Limestone pavement flora (synthetic sample)', publisher: 'NPWS', url: 'https://example.com/npws/pavement', locator: 'Habitat account', geographicScope: 'Co. Clare', retrievedAt: '2026-09-01' },
    { id: 's3', title: 'Wild brown trout in spring-fed lakes (synthetic sample)', publisher: 'Inland Fisheries Ireland', url: 'https://example.com/ifi/trout', geographicScope: 'Western river basin district', retrievedAt: '2026-08-28' },
  ],
  status: 'IN_REVIEW',
  revision: 2,
  editionDate: '2026-09-14',
}

export const cafeFixture: Edition = {
  schemaVersion: 'bv-edition/1',
  venueName: 'The Weir Room',
  businessType: 'cafe_food',
  headline: 'Coffee, scones and the sound of the weir',
  landscapeConnection:
    'The café occupies a former mill house beside a weir, where the river once turned the wheel that ground local grain. The same fast water now draws dippers and wagtails to the tables by the window.',
  story:
    'A small café serving breakfast and lunch, with bread and cakes baked on the premises. Coffee is roasted regionally; eggs, leaves and honey come from within a few miles. The terrace sits directly above the weir, and the team keeps a simple list of the birds seen from it through the year.',
  workingLifeFacts: ['Baking done on site each morning.', 'Regionally roasted coffee; local eggs, leaves and honey.', 'Riverside terrace above the weir.'],
  photos: [
    photo({ id: 'ca-cover', src: img('landscape.jpg'), sequence: 1, isCover: true, orientation: 'landscape', caption: 'The terrace above the weir', credit: 'The Weir Room', focal: { x: 0.5, y: 0.55 } }),
    photo({ id: 'ca-bake', src: img('square.jpg'), sequence: 2, orientation: 'square', caption: 'Scones fresh from the oven', credit: 'The Weir Room' }),
  ],
  ecologyCards: [
    { id: 'e1', commonName: 'White-throated dipper', scientificName: 'Cinclus cinclus', scope: 'at-venue', sourceIds: ['s1'], body: 'Dippers are regularly watched from the terrace, feeding in the fast water below the weir. They walk underwater against the current to find insect larvae — one of the few songbirds to do so.' },
    { id: 'e2', commonName: 'Grey wagtail', scientificName: 'Motacilla cinerea', scope: 'wider-area', sourceIds: ['s2'], body: 'Grey wagtails favour fast, stony rivers like this one, flitting along the water’s edge after insects. Despite the name they show a bright lemon-yellow underside.' },
    { id: 'e3', commonName: 'Mayfly', scientificName: 'Ephemera danica', scope: 'wider-area', sourceIds: ['s3'], body: 'Clean river stretches in the area produce spring mayfly hatches. The adults live only briefly, and their presence is a sign of good water quality.' },
  ],
  guidance: {
    notice: ['A plump, dark bird bobbing on a midstream rock — a dipper.', 'Mayflies rising over the water on a warm spring evening.'],
    wonder: ['How does a songbird walk along a riverbed underwater?', 'What did the mill grind, and where did the grain grow?'],
    remember: ['Keep an eye on children near the weir.', 'Please don’t feed bread to river birds.'],
  },
  visitor: {
    addressLines: ['The Weir Room', 'Old Mill House', 'Co. Kilkenny'],
    openingInfo: 'Open Wednesday to Sunday, 9am–4pm.',
    accessNotes: 'Step-free entry from the car park; the terrace has a low threshold. Accessible WC on site.',
    officialUrl: 'https://example.com/the-weir-room',
    qrTarget: 'https://example.com/the-weir-room',
    qrIsOfficialUrl: true,
  },
  sources: [
    { id: 's1', title: 'Terrace bird log, verified against county records (synthetic sample)', publisher: 'BirdWatch Ireland', url: 'https://example.com/bw/dipper', geographicScope: 'Co. Kilkenny rivers', retrievedAt: '2026-09-02' },
    { id: 's2', title: 'Grey wagtail habitat account (synthetic sample)', publisher: 'BirdWatch Ireland', url: 'https://example.com/bw/wagtail', geographicScope: 'Republic of Ireland', retrievedAt: '2026-09-02' },
    { id: 's3', title: 'Mayfly as a water-quality indicator (synthetic sample)', publisher: 'EPA', url: 'https://example.com/epa/mayfly', geographicScope: 'South-eastern river basin', retrievedAt: '2026-08-27' },
  ],
  status: 'PUBLISHED',
  revision: 3,
  editionDate: '2026-09-14',
  publicationInfo: 'Published 14 September 2026',
}

// Stress fixture: long venue + person names, Irish accents, scientific names,
// mixed portrait/landscape/panoramic proportions, and long captions/sources.
export const attractionFixture: Edition = {
  schemaVersion: 'bv-edition/1',
  venueName: 'Ionad Oidhreachta na Coille Móire — Derryclose Great Wood Heritage Centre',
  businessType: 'visitor_attraction',
  headline: 'A restored oakwood, a ruined míllín, and the memory of the townland of Cnóc an Fhiaóige',
  landscapeConnection:
    'The heritage centre stands at the edge of a restored native oakwood on the slopes above the townland of Cnóc an Fhiaóige. Woodland, holy well and the ruined corn míllín share one water source, and the centre tells the story of how people and this particular wood have shaped one another over centuries.',
  story:
    'Run by a community trust, the centre interprets the natural and cultural history of the Great Wood: the charcoal hearths and the corn míllín, the folklore of the holy well, and the long project to restore native oak. Guided walks are led by Céibhfhionn Ní Dhomhnaill and Séamus Ó Muircheartaigh; the exhibition room and café look out over the canopy.',
  workingLifeFacts: ['Community-trust run; guided walks most weekends.', 'Exhibition on charcoal, milling and oak restoration.', 'Café and viewing room above the woodland canopy.'],
  photos: [
    photo({ id: 'at-cover', src: img('pano.jpg'), sequence: 1, isCover: true, orientation: 'landscape', caption: 'The restored oakwood canopy from the viewing room, looking north over the townland of Cnóc an Fhiaóige on a still autumn morning', credit: 'Céibhfhionn Ní Dhomhnaill / Derryclose Community Trust', focal: { x: 0.5, y: 0.4 } }),
    photo({ id: 'at-well', src: img('portrait.jpg'), sequence: 2, orientation: 'portrait', caption: 'The holy well below the míllín', credit: 'Séamus Ó Muircheartaigh' }),
    photo({ id: 'at-detail', src: img('phone.jpg'), sequence: 3, orientation: 'portrait', caption: 'Oak seedlings in the nursery (photographed on a phone, portrait orientation, kept true to proportion)', credit: 'Derryclose Community Trust' }),
  ],
  ecologyCards: [
    { id: 'e1', commonName: 'Sessile oak', scientificName: 'Quercus petraea', scope: 'at-venue', sourceIds: ['s1'], body: 'The restored wood is dominated by sessile oak, Ireland’s characteristic upland oak. The trust’s nursery raises seedlings from local acorns to keep the wood’s genetic stock native.' },
    { id: 'e2', commonName: 'Purple hairstreak', scientificName: 'Favonius quercus', scope: 'wider-area', sourceIds: ['s2'], body: 'This small butterfly lives high in oak canopies and is easily overlooked. Records for oakwoods in the wider area note it flying on warm afternoons in high summer.' },
    { id: 'e3', commonName: 'Wood anemone', scientificName: 'Anemonoides nemorosa', scope: 'wider-area', sourceIds: ['s3'], body: 'A spring flower of long-established woodland, wood anemone spreads only slowly, so its presence points to woods that are genuinely old — or, here, carefully restored.' },
    { id: 'e4', commonName: 'Common lizard', scientificName: 'Zootoca vivipara', scope: 'wider-area', sourceIds: ['s3'], body: 'Ireland’s only native reptile basks on warm woodland edges and clearings. It gives birth to live young rather than laying eggs, an adaptation to cooler climates.' },
    { id: 'e5', commonName: 'Barn owl', scientificName: 'Tyto alba', scope: 'wider-area', sourceIds: ['s2'], body: 'Barn owls hunt the rough grassland around the wood at dusk. County records show a fragile but recovering population that depends on undisturbed nest sites in old buildings.' },
  ],
  guidance: {
    notice: ['A carpet of white wood anemones under bare oaks in April.', 'A lizard motionless on a sun-warmed log at the woodland edge.', 'The change in sound as you step from open ground into the wood.'],
    wonder: ['How long does it take to grow a wood that feels this old?', 'Who drew water from the well, and for what?'],
    remember: ['Keep dogs on leads — ground-nesting birds and lizards are easily disturbed.', 'Stay on marked paths through the restoration plots.', 'Leave the well offerings and stonework undisturbed.'],
  },
  visitor: {
    addressLines: ['Ionad Oidhreachta na Coille Móire', 'Derryclose Great Wood', 'Cnóc an Fhiaóige', 'Co. Galway'],
    openingInfo: 'Open Thursday to Sunday, 10am–5pm (April–October); weekends only in winter. Guided walks Saturdays at 11am.',
    accessNotes: 'The exhibition, café and viewing room are step-free. Woodland trails are natural surfaces with some gradient; the shortest loop is suitable for all-terrain buggies. Please visit the restoration plots and holy well quietly and respectfully.',
    officialUrl: 'https://example.com/coille-mhor-heritage',
    qrTarget: 'https://example.com/coille-mhor-heritage',
    qrIsOfficialUrl: true,
  },
  sources: [
    { id: 's1', title: 'Native woodland restoration plan for Derryclose Great Wood, incorporating provenance guidance for locally sourced sessile oak acorns (synthetic sample)', publisher: 'Woodlands of Ireland', url: 'https://example.com/woi/derryclose-plan', locator: 'Section 4, restoration compartments', geographicScope: 'Derryclose Great Wood, Co. Galway', retrievedAt: '2026-09-03' },
    { id: 's2', title: 'County invertebrate and bird records (synthetic sample)', publisher: 'National Biodiversity Data Centre', url: 'https://example.com/nbdc/county-records', locator: 'Oakwood species list', geographicScope: 'Co. Galway', retrievedAt: '2026-09-03' },
    { id: 's3', title: 'Ancient and long-established woodland indicators (synthetic sample)', publisher: 'NPWS', url: 'https://example.com/npws/woodland-indicators', geographicScope: 'Republic of Ireland', retrievedAt: '2026-08-31' },
  ],
  status: 'APPROVED',
  revision: 4,
  editionDate: '2026-09-14',
}

export const ALL_FIXTURES: { key: string; label: string; edition: Edition }[] = [
  { key: 'pottery-craft', label: 'Pottery & craft', edition: potteryFixture },
  { key: 'hotel-guesthouse', label: 'Hotel & guesthouse', edition: hotelFixture },
  { key: 'cafe-food', label: 'Café & food', edition: cafeFixture },
  { key: 'visitor-attraction-stress', label: 'Visitor attraction (stress)', edition: attractionFixture },
]
