export type DatePrecision = 'day' | 'month' | 'year' | 'unknown'

export type DaeraEvidenceRecord = {
  recordId: string
  placeSlug: string
  placeName: string
  designation: 'SAC' | 'SPA' | 'Ramsar'
  publisher: 'Department of Agriculture, Environment and Rural Affairs'
  jurisdiction: 'Northern Ireland'
  sourceUrl: string
  publicationDate: string | null
  publicationDatePrecision: DatePrecision
  evidenceType: 'official protected-area profile'
  supportingPassage: string
  passageKind: 'source-linked paraphrase'
  claim: string
}

/**
 * Review fixture for the first DAERA-backed place page.
 *
 * These are protected-area records about Strangford Lough, not records about
 * Fodder and not evidence that DAERA has approved or endorsed any business.
 * DAERA does not display publication dates on the three source pages, so the
 * date remains null and its precision remains unknown.
 */
export const STRANGFORD_LOUGH_DAERA_RECORDS: readonly DaeraEvidenceRecord[] = [
  {
    recordId: 'daera:strangford-lough:sac',
    placeSlug: 'strangford-lough',
    placeName: 'Strangford Lough',
    designation: 'SAC',
    publisher: 'Department of Agriculture, Environment and Rural Affairs',
    jurisdiction: 'Northern Ireland',
    sourceUrl: 'https://www.daera-ni.gov.uk/protected-areas/strangford-lough-sac',
    publicationDate: null,
    publicationDatePrecision: 'unknown',
    evidenceType: 'official protected-area profile',
    supportingPassage:
      'The profile describes a 150 km² marine inlet, about 50 km² of intertidal habitat, Killyleagh on its edge and more than 2,000 recorded species.',
    passageKind: 'source-linked paraphrase',
    claim:
      'DAERA identifies Strangford Lough as a Special Area of Conservation with extensive marine and intertidal habitats and high recorded species diversity.',
  },
  {
    recordId: 'daera:strangford-lough:spa',
    placeSlug: 'strangford-lough',
    placeName: 'Strangford Lough',
    designation: 'SPA',
    publisher: 'Department of Agriculture, Environment and Rural Affairs',
    jurisdiction: 'Northern Ireland',
    sourceUrl: 'https://www.daera-ni.gov.uk/protected-areas/strangford-lough-spa',
    publicationDate: null,
    publicationDatePrecision: 'unknown',
    evidenceType: 'official protected-area profile',
    supportingPassage:
      'The profile describes mudflats, sandflats, saltmarsh and rocky coastline, breeding terns and a wintering waterfowl population exceeding 20,000 birds.',
    passageKind: 'source-linked paraphrase',
    claim:
      'DAERA identifies Strangford Lough as a Special Protection Area of major importance for wintering waterfowl and breeding terns.',
  },
  {
    recordId: 'daera:strangford-lough:ramsar',
    placeSlug: 'strangford-lough',
    placeName: 'Strangford Lough',
    designation: 'Ramsar',
    publisher: 'Department of Agriculture, Environment and Rural Affairs',
    jurisdiction: 'Northern Ireland',
    sourceUrl: 'https://www.daera-ni.gov.uk/protected-areas/strangford-lough-ramsar',
    publicationDate: null,
    publicationDatePrecision: 'unknown',
    evidenceType: 'official protected-area profile',
    supportingPassage:
      'The profile records eelgrass and saltmarsh habitat, common and grey seals, otter and more than 20,000 wintering waterfowl.',
    passageKind: 'source-linked paraphrase',
    claim:
      'DAERA identifies Strangford Lough as a Ramsar wetland supporting diverse coastal habitats, marine mammals and internationally important bird populations.',
  },
] as const

