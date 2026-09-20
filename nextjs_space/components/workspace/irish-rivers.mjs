/**
 * Canonical searchable identities for the five target Irish rivers (PR55).
 *
 * Each river is given a canonical name, conservative human aliases and one or
 * more on-river navigation anchors. The anchors are approximate town/on-river
 * centres — adequate to derive Honeycomb geography for map navigation — not
 * asserted survey coordinates for any record (identical convention to the
 * ireland gazetteer these rows extend). Selecting a river in the workspace
 * navigates to its anchor, from which the EXISTING Honeycomb geometry
 * (cellAt + neighbours) derives the cells searched against the live NPWS,
 * planning and GBIF providers. No river-specific evidence is fabricated or
 * stored; the evidence returned is whatever real, source-linked public record
 * geographically overlaps the corridor.
 *
 * Geography notes:
 *  - Blackwater is explicitly the Munster (Cork/Waterford) Blackwater, scoped
 *    by name, county and Cork-region coordinates so it can never silently
 *    resolve to the Ulster/other Irish Blackwater.
 *  - Shannon is handled as a bounded corridor: it is represented by named
 *    stretches (Athlone, Limerick), not one point pretending to be the whole
 *    river, because Honeycomb searches one local area at a time.
 *
 * Kept free of React/DOM imports so it can be shared by the client, the live
 * verification script and tests.
 */

// river key -> { name, aliases[], anchors[{ label, county, lat, lng, zoom }] }
export const RIVER_ANCHORS = [
  {
    river: 'nore',
    name: 'River Nore',
    aliases: ['nore', 'river nore', 'the nore'],
    anchors: [{ label: 'Thomastown', county: 'Kilkenny', lat: 52.5270, lng: -7.1370, zoom: 13 }],
  },
  {
    river: 'blackwater-munster',
    name: 'River Blackwater (Munster)',
    aliases: [
      'blackwater',
      'river blackwater',
      'munster blackwater',
      'blackwater munster',
      'blackwater river cork',
      'blackwater cork',
      'the blackwater',
    ],
    anchors: [{ label: 'Mallow', county: 'Cork', lat: 52.1389, lng: -8.6394, zoom: 13 }],
  },
  {
    river: 'slaney',
    name: 'River Slaney',
    aliases: ['slaney', 'river slaney', 'the slaney'],
    anchors: [{ label: 'Enniscorthy', county: 'Wexford', lat: 52.5017, lng: -6.5658, zoom: 13 }],
  },
  {
    river: 'shannon',
    name: 'River Shannon',
    aliases: ['shannon', 'river shannon', 'the shannon'],
    anchors: [
      { label: 'Athlone', county: 'Westmeath', lat: 53.4239, lng: -7.9407, zoom: 12 },
      { label: 'Limerick', county: 'Limerick', lat: 52.6638, lng: -8.6267, zoom: 12 },
    ],
  },
  {
    river: 'dodder',
    name: 'River Dodder',
    aliases: ['dodder', 'river dodder', 'dodder dublin', 'the dodder'],
    anchors: [{ label: 'Dublin', county: 'Dublin', lat: 53.3080, lng: -6.2460, zoom: 14 }],
  },
]

/**
 * Flat gazetteer rows for the five rivers, one per on-river anchor. A river
 * with several stretches (the Shannon) yields one row per stretch, each named
 * for its stretch but sharing the river's aliases so an ordinary "River
 * Shannon" search surfaces every stretch (bounded corridor handling).
 */
export const RIVER_GAZETTEER = RIVER_ANCHORS.flatMap((river) =>
  river.anchors.map((anchor) => ({
    name: river.anchors.length > 1 ? `${river.name} at ${anchor.label}` : river.name,
    county: anchor.county,
    lat: anchor.lat,
    lng: anchor.lng,
    zoom: anchor.zoom,
    kind: 'river',
    river: river.river,
    aliases: river.aliases,
  })),
)
