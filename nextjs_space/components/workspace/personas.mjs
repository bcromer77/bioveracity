/**
 * Workspace persona presets. Presentation-only: a persona changes the default
 * map-layer toggles, the report export title and the suggested prompt chips.
 * It never changes how a workspace, case or evidence is stored or accessed —
 * every persona opens the same universal "Drop Anything" canvas.
 * Shared by the client and by tests, so keep this free of React/DOM imports.
 */

/** The single catalogue every persona toggles from, so layers stay consistent. */
export const layerCatalog = [
  { id: 'species', label: 'Species records (NBDC / GBIF)' },
  { id: 'rivers', label: 'EPA WFD river status' },
  { id: 'habitats', label: 'Habitats & designations' },
  { id: 'planningHistory', label: 'Planning history (MyPlan.ie)' },
  { id: 'objections', label: 'Resident objections' },
  { id: 'floodRisk', label: 'Flood risk buffers' },
  { id: 'foreshore', label: 'Foreshore licences' },
  { id: 'ports', label: 'Port lenses' },
];

function withDefaults(onIds) {
  const on = new Set(onIds);
  return layerCatalog.map(layer => ({ ...layer, default: on.has(layer.id) }));
}

// The unfiltered fallback canvas: every layer available and on by default. Kept
// as a named const so getPersona() always resolves to a defined preset.
const customPersona = {
  key: 'custom',
  title: 'Custom / You Choose',
  tagline: 'Unfiltered blank canvas with all layers togglable',
  description: 'An unfiltered canvas with every layer available. Toggle only what you need.',
  layers: withDefaults(layerCatalog.map(layer => layer.id)),
  exportTitle: 'BioVeracity Evidence Report',
  prompts: [
    'What decision am I building evidence towards?',
    'Which sources still need review?',
    'What is missing before I can rely on this timeline?',
  ],
  template: 'GENERAL',
};

export const personas = [
  {
    key: 'ecology',
    title: 'Ecology & Biodiversity',
    tagline: 'NBDC/GBIF species + EPA WFD rivers',
    description: 'Start with species occurrence and river water-quality context for habitat and biodiversity reviews.',
    layers: withDefaults(['species', 'rivers', 'habitats']),
    exportTitle: 'Ecology & Biodiversity Evidence Report',
    prompts: [
      'Which protected species records fall inside this site boundary?',
      'What is the WFD status of the nearest river water body?',
      'Summarise the habitats and designations affecting this decision.',
    ],
    template: 'PLANNING',
  },
  {
    key: 'planning',
    title: 'Planning & Enforcement',
    tagline: 'MyPlan.ie + Resident Objections',
    description: 'Bring planning history and community objections together to build an enforcement or decision file.',
    layers: withDefaults(['planningHistory', 'objections']),
    exportTitle: 'Planning & Enforcement Case File',
    prompts: [
      'What is the planning history for this address?',
      'Which resident objections reference this application?',
      'What conditions were attached to previous permissions here?',
    ],
    template: 'PLANNING',
  },
  {
    key: 'architecture',
    title: 'Architecture & Site Design',
    tagline: 'Planning history + Flood risk buffers',
    description: 'Combine planning precedent with flood-risk constraints to inform site design and feasibility.',
    layers: withDefaults(['planningHistory', 'floodRisk']),
    exportTitle: 'Architecture & Site Design Report',
    prompts: [
      'What flood-risk zones intersect this site?',
      'What was previously approved or refused on this parcel?',
      'Which setbacks or buffers constrain the developable area?',
    ],
    template: 'PLANNING',
  },
  {
    key: 'maritime',
    title: 'Maritime & Coastal',
    tagline: 'Foreshore licenses + Port lenses',
    description: 'Review foreshore licensing and port context for coastal and marine decisions.',
    layers: withDefaults(['foreshore', 'ports']),
    exportTitle: 'Maritime & Coastal Evidence Report',
    prompts: [
      'Which foreshore licences apply to this stretch of coast?',
      'What port infrastructure is within range of this site?',
      'What consents are needed for works below the high-water mark?',
    ],
    template: 'PLANNING',
  },
  customPersona,
];

/** Resolve a persona key to its preset, falling back to the unfiltered custom canvas. */
export function getPersona(key) {
  return personas.find(persona => persona.key === key) || customPersona;
}
