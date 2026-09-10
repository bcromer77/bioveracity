/**
 * A curated gazetteer of Irish counties and towns for the workspace geocoder.
 * Used to navigate the map to ANY named place quickly and reliably without a key.
 * For queries not in this list, the geocoder falls back to the public OSM Nominatim
 * service (see geocode.mjs). Coordinates are approximate town/county centres, adequate
 * for map navigation — they are not asserted survey coordinates for any record.
 * Kept free of React/DOM imports so it can be shared by the client and by tests.
 */

// [name, county, lat, lng, zoom]
const COUNTY_ROWS = [
  ['Carlow', 'Carlow', 52.7269, -6.8155, 11],
  ['Cavan', 'Cavan', 53.9908, -7.3606, 10],
  ['Clare', 'Clare', 52.9045, -8.9811, 10],
  ['Cork', 'Cork', 51.8985, -8.4756, 10],
  ['Donegal', 'Donegal', 54.9558, -7.7342, 9],
  ['Dublin', 'Dublin', 53.3498, -6.2603, 11],
  ['Galway', 'Galway', 53.2707, -9.0568, 10],
  ['Kerry', 'Kerry', 52.1545, -9.5669, 10],
  ['Kildare', 'Kildare', 53.1580, -6.9091, 11],
  ['Kilkenny', 'Kilkenny', 52.6541, -7.2448, 11],
  ['Laois', 'Laois', 53.0324, -7.3009, 11],
  ['Leitrim', 'Leitrim', 54.1247, -8.0027, 10],
  ['Limerick', 'Limerick', 52.6638, -8.6267, 11],
  ['Longford', 'Longford', 53.7276, -7.7994, 11],
  ['Louth', 'Louth', 53.9508, -6.5406, 11],
  ['Mayo', 'Mayo', 53.8006, -9.3810, 9],
  ['Meath', 'Meath', 53.6055, -6.6564, 10],
  ['Monaghan', 'Monaghan', 54.2492, -6.9683, 10],
  ['Offaly', 'Offaly', 53.2357, -7.7122, 10],
  ['Roscommon', 'Roscommon', 53.7574, -8.2686, 10],
  ['Sligo', 'Sligo', 54.2766, -8.4761, 10],
  ['Tipperary', 'Tipperary', 52.4738, -8.1619, 10],
  ['Waterford', 'Waterford', 52.2593, -7.1101, 11],
  ['Westmeath', 'Westmeath', 53.5345, -7.4653, 10],
  ['Wexford', 'Wexford', 52.3369, -6.4633, 10],
  ['Wicklow', 'Wicklow', 52.9808, -6.0446, 10],
];

// [town, county, lat, lng, zoom]
const TOWN_ROWS = [
  ['Enniscorthy', 'Wexford', 52.5017, -6.5658, 13],
  ['Wexford Town', 'Wexford', 52.3342, -6.4575, 13],
  ['Gorey', 'Wexford', 52.6745, -6.2939, 13],
  ['New Ross', 'Wexford', 52.3960, -6.9450, 13],
  ['Bunclody', 'Wexford', 52.6524, -6.6549, 13],
  ['Carlow Town', 'Carlow', 52.8408, -6.9261, 13],
  ['Tullow', 'Carlow', 52.8010, -6.7370, 13],
  ['Bagenalstown', 'Carlow', 52.7011, -6.9600, 13],
  ['Kilkenny City', 'Kilkenny', 52.6541, -7.2448, 13],
  ['Callan', 'Kilkenny', 52.5449, -7.3900, 13],
  ['Thomastown', 'Kilkenny', 52.5270, -7.1370, 13],
  ['Waterford City', 'Waterford', 52.2593, -7.1101, 13],
  ['Dungarvan', 'Waterford', 52.0895, -7.6236, 13],
  ['Tramore', 'Waterford', 52.1590, -7.1490, 13],
  ['Dublin City', 'Dublin', 53.3498, -6.2603, 12],
  ['Dun Laoghaire', 'Dublin', 53.2946, -6.1344, 13],
  ['Swords', 'Dublin', 53.4597, -6.2181, 13],
  ['Cork City', 'Cork', 51.8985, -8.4756, 12],
  ['Mallow', 'Cork', 52.1389, -8.6394, 13],
  ['Midleton', 'Cork', 51.9150, -8.1740, 13],
  ['Galway City', 'Galway', 53.2707, -9.0568, 12],
  ['Tuam', 'Galway', 53.5147, -8.8555, 13],
  ['Limerick City', 'Limerick', 52.6638, -8.6267, 12],
  ['Killarney', 'Kerry', 52.0599, -9.5044, 13],
  ['Tralee', 'Kerry', 52.2713, -9.7016, 13],
  ['Sligo Town', 'Sligo', 54.2766, -8.4761, 13],
  ['Letterkenny', 'Donegal', 54.9503, -7.7342, 13],
  ['Athlone', 'Westmeath', 53.4239, -7.9407, 13],
  ['Mullingar', 'Westmeath', 53.5236, -7.3402, 13],
  ['Naas', 'Kildare', 53.2158, -6.6669, 13],
  ['Newbridge', 'Kildare', 53.1810, -6.7990, 13],
  ['Portlaoise', 'Laois', 53.0324, -7.3009, 13],
  ['Navan', 'Meath', 53.6528, -6.6812, 13],
  ['Drogheda', 'Louth', 53.7189, -6.3478, 13],
  ['Dundalk', 'Louth', 54.0019, -6.4058, 13],
  ['Ennis', 'Clare', 52.8436, -8.9864, 13],
  ['Nenagh', 'Tipperary', 52.8626, -8.1969, 13],
  ['Clonmel', 'Tipperary', 52.3550, -7.7038, 13],
  ['Wicklow Town', 'Wicklow', 52.9808, -6.0446, 13],
  ['Bray', 'Wicklow', 53.2028, -6.0983, 13],
  ['Arklow', 'Wicklow', 52.7931, -6.1417, 13],
];

/** Every gazetteer place, county rows first then towns. */
export const GAZETTEER = [
  ...COUNTY_ROWS.map(([name, county, lat, lng, zoom]) => ({ name, county, lat, lng, zoom, kind: 'county' })),
  ...TOWN_ROWS.map(([name, county, lat, lng, zoom]) => ({ name, county, lat, lng, zoom, kind: 'town' })),
];

function normalise(value) {
  return String(value ?? '').toLowerCase().replace(/^(county|co\.?)\s+/, '').replace(/\s+(city|town)$/, '').trim();
}

/**
 * Look up matching places in the gazetteer. Returns best matches first: exact,
 * then prefix, then substring. Never throws; returns [] for an empty query.
 */
export function searchGazetteer(query, limit = 6) {
  const q = normalise(query);
  if (!q) return [];
  const scored = [];
  for (const place of GAZETTEER) {
    const name = normalise(place.name);
    const county = normalise(place.county);
    let score = -1;
    if (name === q || county === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q) || county.includes(q)) score = 2;
    if (score >= 0) scored.push({ place, score });
  }
  scored.sort((a, b) => a.score - b.score || (a.place.kind === 'county' ? -1 : 1));
  return scored.slice(0, limit).map(entry => entry.place);
}

/** Resolve a free-text county name (e.g. "Co. Wexford") to a canonical county, or null. */
export function resolveCounty(value) {
  const q = normalise(value);
  if (!q) return null;
  const county = COUNTY_ROWS.find(([name]) => normalise(name) === q);
  return county ? county[0] : null;
}
