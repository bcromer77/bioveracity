// Presentation-layer lenses for the Irish Ports demonstration.
//
// These are entry points into ONE source-backed evidence graph. Nothing here
// fabricates data: a lens is matched by keyword against record text that already
// exists in the public record (event titles/descriptions/types, project names,
// authorisation types, and the asset's own source-derived summary). A lens that
// matches no record simply reports "No verified records connected yet."

export interface Lens {
  id: string
  label: string
  description: string
  keywords: string[]
  cleanMaritime: boolean
  domainLabel?: string // short label used for a port's "connected evidence domains"
}

export const IRISH_PORT_LENSES: Lens[] = [
  {
    id: 'clean-maritime-projects',
    label: 'Clean maritime projects',
    description: 'Zero- and low-emission vessel projects, decarbonisation of port operations and clean-maritime demonstrations.',
    keywords: ['clean maritime', 'zero-emission', 'zero emission', 'electric vessel', 'electric ferry', 'decarbon', 'low-carbon', 'low carbon vessel'],
    cleanMaritime: true,
  },
  {
    id: 'shore-power',
    label: 'Shore power & electrification',
    description: 'Shoreside electricity, cold-ironing and electrification of berths and port operations.',
    keywords: ['shore power', 'shoreside', 'cold ironing', 'cold-ironing', 'onshore power', 'electrification', 'shore-side'],
    cleanMaritime: true,
  },
  {
    id: 'alt-fuels',
    label: 'Alternative fuels',
    description: 'Hydrogen, ammonia, methanol, LNG and biofuel infrastructure at or serving the port.',
    keywords: ['hydrogen', 'ammonia', 'methanol', 'lng', 'biofuel', 'alternative fuel', 'e-fuel'],
    cleanMaritime: true,
  },
  {
    id: 'energy-infra',
    label: 'Energy infrastructure',
    description: 'Offshore renewable energy, port energy systems and the marine infrastructure that supports them.',
    keywords: ['offshore renewable', 'offshore-renewable', ' ore ', 'ore hub', 'ore-capable', 'renewable energy', 'wind', 'energy hub', 'grid', 'substation'],
    cleanMaritime: true,
    domainLabel: 'Energy infrastructure',
  },
  {
    id: 'air-emissions',
    label: 'Air & emissions',
    description: 'Air quality, vessel and port emissions, and greenhouse-gas evidence.',
    keywords: ['air quality', 'emission', 'nox', 'particulate', 'greenhouse', 'co2', 'carbon dioxide'],
    cleanMaritime: true,
    domainLabel: 'Air & emissions',
  },
  {
    id: 'water-discharges',
    label: 'Water & discharges',
    description: 'Water quality, discharges, dumping at sea and dredge-disposal evidence.',
    keywords: ['water quality', 'discharge', 'dumping at sea', 'dumping-at-sea', 'effluent', 'disposal', 'outfall'],
    cleanMaritime: false,
    domainLabel: 'Water & discharges',
  },
  {
    id: 'noise-vibration',
    label: 'Noise & vibration',
    description: 'Noise and vibration assessment and monitoring around port works and operations.',
    keywords: ['noise', 'vibration'],
    cleanMaritime: false,
    domainLabel: 'Noise & vibration',
  },
  {
    id: 'dredging-ecology',
    label: 'Dredging & marine ecology',
    description: 'Dredging, reclamation and the marine-ecology, benthic and ornithology evidence connected to them.',
    keywords: ['dredg', 'reclamation', 'benthic', 'ecology', 'ornithology', 'habitat', 'marine ecology', 'seabed'],
    cleanMaritime: false,
    domainLabel: 'Dredging & marine ecology',
  },
  {
    id: 'projects-permits',
    label: 'Projects & permits',
    description: 'Capital projects, planning applications, consents and maritime area authorisations.',
    keywords: ['planning', 'permission', 'consent', 'application', 'permit', 'maritime area', 'mac', 'sid', 'berth', 'terminal', 'wharf', 'strategic infrastructure', 'redevelopment'],
    cleanMaritime: false,
    domainLabel: 'Projects & permits',
  },
  {
    id: 'regulatory',
    label: 'Regulatory activity',
    description: 'Regulatory records, licences and the oversight of port works by statutory bodies.',
    keywords: ['regulator', 'epa', 'licence', 'license', 'compliance', 'enforcement', 'statutory', 'coimisi'],
    cleanMaritime: false,
    domainLabel: 'Regulatory activity',
  },
]
