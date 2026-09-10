/**
 * Workspace geocoder. Turns a free-text place query (any Irish town or county)
 * into map navigation data. It tries the curated local gazetteer first (instant,
 * keyless, reliable) and falls back to the public OpenStreetMap Nominatim service
 * for anything not in the list. Coordinates are approximate centres for map
 * navigation only — they are not asserted survey coordinates for any record.
 * Kept free of React/DOM imports so it can be shared by the client and by tests.
 */

import { searchGazetteer, resolveCounty } from './ireland-gazetteer.mjs';

/** Which agency data feeds are wired for a given county, described honestly. */
const SOUTH_EAST = new Set(['Carlow', 'Kilkenny', 'Waterford', 'Wexford', 'Wicklow']);

/**
 * Return the live-data feed status for a county. We only claim a feed is
 * "available" where a validated connector actually exists; everywhere else we say
 * so plainly rather than implying coverage we cannot deliver.
 */
export function dataFeedsForCounty(county) {
  const resolved = resolveCounty(county) || county || null;
  const inSE = resolved ? SOUTH_EAST.has(resolved) : false;
  return {
    county: resolved,
    feeds: [
      {
        id: 'species',
        agency: 'NBDC / GBIF',
        label: 'Species occurrence records',
        status: inSE ? 'available' : 'not-wired',
        note: inSE
          ? 'Live species occurrences load for this county via GBIF using validated boundaries.'
          : 'A validated boundary connector is wired for the South-East counties only; other counties show the map without live species pins.',
      },
      {
        id: 'planning',
        agency: 'MyPlan.ie',
        label: 'Planning history',
        status: inSE ? 'available' : 'not-wired',
        note: inSE
          ? 'Planning applications load for this county via the national planning feature service.'
          : 'The planning connector is wired for the South-East counties only.',
      },
      {
        id: 'water',
        agency: 'EPA (WFD)',
        label: 'River water-quality status',
        status: 'unverified',
        note: 'The EPA catalogue is located but the queryable river layer is not yet verified, so water status is never auto-filled — add it from a reviewed source instead.',
      },
    ],
  };
}

function fromGazetteer(query) {
  const matches = searchGazetteer(query, 1);
  if (!matches.length) return null;
  const place = matches[0];
  return {
    name: place.name,
    county: place.county,
    lat: place.lat,
    lng: place.lng,
    zoom: place.zoom,
    bbox: null,
    source: 'gazetteer',
  };
}

async function fromNominatim(query, signal) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=ie&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    signal,
    headers: { 'Accept': 'application/json' },
  });
  if (!response.ok) throw new Error('Location lookup is unavailable right now.');
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows.length) return null;
  const row = rows[0];
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const address = row.address || {};
  const countyRaw = address.county || address.state_district || address.state || '';
  const county = resolveCounty(countyRaw) || (countyRaw ? String(countyRaw).replace(/^County\s+/i, '') : null);
  let bbox = null;
  if (Array.isArray(row.boundingbox) && row.boundingbox.length === 4) {
    const [south, north, west, east] = row.boundingbox.map(Number);
    if ([south, north, west, east].every(Number.isFinite)) bbox = { south, north, west, east };
  }
  return {
    name: (row.display_name || query).split(',')[0].trim() || query,
    county,
    lat,
    lng,
    zoom: 13,
    bbox,
    source: 'nominatim',
  };
}

/**
 * Resolve a free-text query to a place. Gazetteer first; Nominatim fallback.
 * Never throws for "not found" — returns null. Throws only if the query is empty.
 */
export async function geocode(query, { signal } = {}) {
  const q = String(query ?? '').trim();
  if (!q) throw new Error('Enter a town or county to search.');
  const local = fromGazetteer(q);
  if (local) return local;
  try {
    return await fromNominatim(q, signal);
  } catch (error) {
    if (error && error.name === 'AbortError') throw error;
    // Network/service failure: degrade gracefully rather than breaking the canvas.
    return null;
  }
}
