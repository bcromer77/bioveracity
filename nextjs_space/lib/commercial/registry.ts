import type { Lens } from './principles'

export type SignalDefinition = {
  id: string
  family: string
  name: string
  source: string
  operational: boolean
  permitted: string
  prohibited: string
  personas: Lens[]
  freshness: string
}

const priority: SignalDefinition[] = [
  ['epa-licence-status', 'ENVIRONMENT', 'EPA licence status', 'EPA', true, 'Quote the register number, date and what the document says it did.', 'Do not call the site compliant or non-compliant.'],
  ['epa-licence-application', 'ENVIRONMENT', 'EPA licence application', 'EPA', true, 'Quote the application receipt and the register number as printed.', 'Do not treat an application as a granted licence.'],
  ['planning-decision-reported', 'PLANNING', 'Planning decision as reported', 'News report of a planning authority', true, 'Say which publisher reported the decision and that the decision document was not the source.', 'Do not treat a news report as the planning order.'],
  ['planning-zoning-statement', 'PLANNING', 'Zoning statement', 'Selling agent or plan', true, 'Say who stated the zoning and whether the plan document was retrieved.', 'Do not treat an agent’s statement as the adopted plan.'],
  ['published-capital-plan', 'PUBLIC_MONEY', 'Published capital plan', 'Asset operator', true, 'Quote the figure as planned, funded or delivered using the page’s own verb.', 'Do not turn planned into delivered.'],
  ['construction-stated', 'INFRASTRUCTURE', 'Construction stated by the promoter', 'Asset operator', true, 'Limit the statement to the project the page names.', 'Do not spread a commencement onto every other project.'],
  ['design-stage-rating', 'ENVIRONMENT', 'Design-stage building rating', 'Building owner', true, 'Keep the words “design stage” if that is what was published.', 'Do not upgrade a design-stage rating to an operational certificate.'],
  ['official-site-identity', 'ASSET', 'Official site identity', 'Site operator', true, 'Use the published address and no coordinate that was not published.', 'Do not invent a latitude.'],
  ['flood-study', 'WATER', 'Flood study', 'OPW or council, via a news report', true, 'Name the place the study is about.', 'Do not attach it to a different town.'],
  ['river-level', 'WATER', 'River level', 'OPW or council gauge', false, 'Quote station, date and unit.', 'Do not compare different stations or datums.'],
  ['flood-extent', 'WATER', 'Mapped flood extent', 'OPW', false, 'State the map edition.', 'Do not say the building will flood.'],
  ['flood-scheme', 'WATER', 'Flood scheme stage', 'OPW', false, 'State the published stage.', 'Do not treat a scheme as built.'],
  ['wastewater-capacity', 'WATER', 'Wastewater capacity', 'Uisce Éireann', false, 'Quote the published capacity statement.', 'Do not infer a connection to this unit.'],
  ['water-supply', 'WATER', 'Water supply evidence', 'Uisce Éireann', false, 'Quote the published supply statement.', 'Do not infer dependency from a county boundary.'],
  ['water-body-status', 'WATER', 'Water-body status', 'EPA', false, 'Name the water body.', 'Do not assign a national status to one site.'],
  ['sac-relationship', 'ENVIRONMENT', 'Protected-site relationship', 'NPWS', false, 'State intersect, adjacent or not established.', 'Do not infer harm.'],
  ['rainfall', 'CLIMATE', 'Rainfall observation', 'Met Éireann', false, 'Name the station and the period.', 'Do not compare a day with a month.'],
  ['maritime-application', 'MARITIME', 'Maritime application', 'MARA', false, 'Quote the application status.', 'Do not treat an application as a consent.'],
  ['transport-project', 'INFRASTRUCTURE', 'Transport project', 'TII or NTA', false, 'Name the project and stage.', 'Do not infer access impact.'],
  ['grid-project', 'INFRASTRUCTURE', 'Grid project', 'EirGrid', false, 'Name the project and stage.', 'Do not infer a connection.'],
  ['budget-line', 'PUBLIC_MONEY', 'Budget allocation', 'Government', false, 'Keep the allocation at its published geography.', 'Do not assign a national line to one building.'],
  ['ndp-project', 'PUBLIC_MONEY', 'NDP project', 'Government', false, 'Quote the project name and stage.', 'Do not confirm a local delivery that is not named.'],
  ['tender', 'PUBLIC_MONEY', 'Tender', 'Contracting authority', false, 'Quote the tender notice.', 'Do not treat a tender as a contract.'],
  ['contract-award', 'PUBLIC_MONEY', 'Contract award', 'Contracting authority', false, 'Quote the award notice.', 'Do not treat a contract as completion.'],
].map(([id, family, name, source, operational, permitted, prohibited]) => ({
  id: id as string,
  family: family as string,
  name: name as string,
  source: source as string,
  operational: operational as boolean,
  permitted: permitted as string,
  prohibited: prohibited as string,
  personas: ['FINANCE', 'LEGAL', 'ASSET', 'SUSTAINABILITY', 'INVESTMENT'] as Lens[],
  freshness: operational ? 'Retrieved for this demonstration' : 'NOT_CHECKED',
}))

const extraFamilies = [
  ['WATER', 'historical flood evidence'],
  ['WATER', 'water or wastewater infrastructure project'],
  ['ENVIRONMENT', 'EPA monitoring record'],
  ['ENVIRONMENT', 'conservation-objective update'],
  ['ENVIRONMENT', 'biodiversity or restoration programme'],
  ['ENVIRONMENT', 'published enforcement notice'],
  ['CLIMATE', 'temperature observation'],
  ['CLIMATE', 'extreme rainfall note'],
  ['MARITIME', 'maritime project boundary'],
  ['INFRASTRUCTURE', 'traffic or HGV count'],
  ['PUBLIC_MONEY', 'grant award'],
  ['PUBLIC_MONEY', 'construction progress notice'],
  ['PUBLIC_MONEY', 'delay, cancellation or completion notice'],
  ['PLANNING', 'consultation'],
  ['PLANNING', 'local-authority decision'],
  ['REGULATION', 'licence condition'],
]

const extras: SignalDefinition[] = extraFamilies.map(([family, name], index) => ({
  id: `registry-${index + 1}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
  family,
  name,
  source: 'Registry only',
  operational: false,
  permitted: 'No customer sentence until a source passage is retrieved.',
  prohibited: 'Do not describe this as a live feed.',
  personas: ['FINANCE', 'LEGAL', 'ASSET', 'SUSTAINABILITY', 'INVESTMENT'],
  freshness: 'NOT_CHECKED',
}))

export const SIGNALS: SignalDefinition[] = [...priority, ...extras]

export function signalById(id: string) {
  const found = SIGNALS.find(signal => signal.id === id)
  if (!found) throw new Error(`Unknown signal ${id}`)
  return found
}

export const operationalSignals = () => SIGNALS.filter(signal => signal.operational)
