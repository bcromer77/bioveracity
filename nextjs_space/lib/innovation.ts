// Innovation layer for the Cambridgeshire & Peterborough showcase ONLY.
//
// This maps a REAL, source-backed evidence gap to the CAPABILITY that would be
// needed to close it, and to the kind of regional innovation base that could,
// potentially, be relevant. It never recommends a "best" supplier, never asserts
// that any company is engaged, and never claims an effect has been achieved.
// The problem always comes first; innovation is framed as "potentially relevant".

export interface Capability {
  id: string
  // The capability a gap implies
  capability: string
  // Why this capability is relevant to the gap (cautious wording)
  why: string
  // The kind of regional innovation base that could be relevant (generic, no endorsement)
  regionalBase: string
  // What proof of effect would look like (never "the technology worked")
  proof: string
}

const CAPABILITIES: Record<string, Capability> = {
  odour: {
    id: 'odour',
    capability: 'Continuous odour / hydrogen-sulphide (H2S) measurement',
    why: 'A verified odour-concentration series aligned to process state, vehicle movements and wind would let human experience be reconciled with the operational record.',
    regionalBase:
      'The Cambridgeshire & Peterborough area hosts an environmental-sensing and air-quality research base that works on this class of measurement.',
    proof:
      'Proof of effect would be a measured change in odour concentration before, during and after an intervention (for example the 2025 lime-treatment pause) — not the installation of a sensor.',
  },
  water: {
    id: 'water',
    capability: 'Continuous water-quality / nutrient monitoring',
    why: 'Paired flow and concentration data adjacent to a discharge would let the effect of a wastewater asset on its receiving water be established.',
    regionalBase:
      'The region has a concentration of water-technology and freshwater-science research relevant to continuous nutrient and water-quality monitoring.',
    proof:
      'Proof of effect would be a rainfall-normalised change in nutrient or water-quality measurements downstream after an intervention, with the raw series preserved.',
  },
  overflow: {
    id: 'overflow',
    capability: 'Storm-overflow event-duration monitoring and flow telemetry',
    why: 'Event-duration and flow data would show whether a storm-capacity project changes overflow frequency or duration in practice.',
    regionalBase:
      'The regional instrumentation and data-analytics base works on flow sensing and event-duration monitoring of this kind.',
    proof:
      'Proof of effect would be a rainfall-normalised reduction in overflow activation or duration after commissioning — investment completion alone is not an environmental outcome.',
  },
  flooding: {
    id: 'flooding',
    capability: 'Flood and groundwater sensing',
    why: 'Recorded surface-water and groundwater behaviour would test the flood-susceptibility modelling that constrains redevelopment.',
    regionalBase:
      'The region has flood-risk and Fenland drainage research capacity relevant to this measurement.',
    proof:
      'Proof of effect would be observed water-level behaviour compared against the modelled susceptibility, over time.',
  },
  attribution: {
    id: 'attribution',
    capability: 'Source apportionment (remote sensing and dispersion modelling)',
    why: 'Separating one operator’s contribution from agricultural, poultry and external-fire sources requires apportionment rather than single-source attribution.',
    regionalBase:
      'The region hosts remote-sensing and environmental-modelling research relevant to source apportionment.',
    proof:
      'Proof of effect would be an apportionment series that distinguishes candidate sources under known meteorological conditions.',
  },
  capacity: {
    id: 'capacity',
    capability: 'Real-time process and capacity telemetry',
    why: 'Influent, treatment-performance and permit-headroom data would show whether a reported capacity constraint is current, seasonal or upgrade-dependent.',
    regionalBase:
      'The regional data-analytics and process-engineering base works on asset telemetry of this kind.',
    proof:
      'Proof of effect would be measured headroom and treatment performance tracked against consented development, over time.',
  },
  general: {
    id: 'general',
    capability: 'Independent environmental measurement',
    why: 'An independent, preserved measurement series would let this open question be answered rather than left to competing accounts.',
    regionalBase:
      'The Cambridgeshire & Peterborough innovation ecosystem includes environmental measurement and data capabilities that could be relevant.',
    proof:
      'Proof of effect would be a measured change in the environmental evidence after any intervention, with provenance retained.',
  },
}

export function capabilityForGap(text: string): Capability {
  const h = (text ?? '').toLowerCase()
  if (/odour|odor|smell|h2s|hydrogen sulphide/.test(h)) return CAPABILITIES.odour
  if (/apportion|attribut/.test(h)) return CAPABILITIES.attribution
  if (/overflow|storm|edm|event-duration/.test(h)) return CAPABILITIES.overflow
  if (/flood|groundwater/.test(h)) return CAPABILITIES.flooding
  if (/classification|water-quality|water quality|monitoring series|nutrient|phosphorus|discharge/.test(h))
    return CAPABILITIES.water
  if (/capacity|influent|treatment-performance|headroom/.test(h)) return CAPABILITIES.capacity
  return CAPABILITIES.general
}
