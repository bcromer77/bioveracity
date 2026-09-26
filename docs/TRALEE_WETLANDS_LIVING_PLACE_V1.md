# Tralee Bay Wetlands — Living Place V1

Status: implementation brief
Owner: BioVeracity
Depends on: Developer Platform V1 / PR #81 reaching deployed acceptance

## Objective

Create the first complete Irish BioVeracity public Living Place for Tralee Bay Wetlands.

The permanent public entry point should be:

`https://bioveracity.com/p/tralee-wetlands`

A physical QR code will encode only that stable BioVeracity URL. The QR/plaque must never encode a temporary preview URL, vendor redirect, API endpoint, or third-party dynamic-QR service.

## Visitor experience

The public page should answer one simple question:

**What's changing here?**

V1 should present four clear doors:

1. **Today** — current source-linked environmental context where available.
2. **Through time** — chronology/timeline of dated evidence.
3. **Wildlife** — source-linked biodiversity observations relevant to the defined place.
4. **Evidence** — provenance/source drawer showing exactly where statements came from.

Every displayed claim must remain traceable to its source. Do not turn missing evidence into absence and do not silently change geographic precision.

## Place identity

Treat the visitor attraction, surrounding protected areas, hydrological monitoring locations, administrative areas, catchments and other geographic entities as distinct objects unless a reviewed source explicitly establishes their relationship.

Do not label county-level or wider Tralee Bay evidence as a measurement at the Wetlands itself.

## Data path

All new source adapters must use the Developer Platform V1 contract:

`SOURCE -> ADAPTER -> @bioveracity/sdk -> /api/v1/evidence -> RAW -> EVIDENCE -> PLACE/TIME -> PUBLIC VIEW`

Do not create a parallel ingestion architecture.

Initial source families to evaluate after V1 is GREEN:
- CSO / PxStat
- EPA
- Met Eireann
- OPW hydrometry
- NPWS protected-site/conservation evidence
- biodiversity records where licensing permits
- Kerry County Council / national planning data
- Wetlands-owned observations only with explicit provenance and evidence class

Discovery does not mean ingestion. Each source must retain source identity, native geography, relevant dates/time precision, retrieval time, and provenance.

## QR requirement

Generate a standards-compliant QR for the permanent canonical URL only after the route exists in the target environment.

Required deliverables:
- SVG master
- print-quality PDF artwork
- PNG preview
- human-readable canonical URL printed beneath/beside the code
- sufficient quiet zone and contrast
- no dependency on a paid QR redirect service

Before physical printing, test the final artwork at intended plaque size on multiple phones and from realistic viewing distances. The permanent URL should redirect/serve safely even if the page implementation changes later.

## V1 page acceptance

A first release is complete only when:

1. `/p/tralee-wetlands` resolves on the deployed BioVeracity domain.
2. Mobile-first page renders without authentication.
3. At least one real evidence object has travelled through the canonical V1 SDK/API path and appears in the page with correct provenance.
4. A second source family can be shown without changing the public page contract.
5. Timeline distinguishes observation/reference date, publication date and retrieval date where available.
6. Evidence drawer links back to the authoritative source.
7. Geographic scope/precision is visible and honest.
8. Missing/unavailable evidence is labelled as such rather than inferred.
9. QR resolves to the canonical URL and has been physically scan-tested.
10. Existing private workspaces/customer journeys are unaffected.

## Explicit non-goals for the first release

- No causal claims from correlation.
- No opaque environmental score.
- No claim that BioVeracity is measuring conditions live unless the underlying source truly supports that wording.
- No user-generated observations mixed with official records without evidence-class labelling.
- No Ireland-wide connector expansion as part of this page.
- No promotional claims that exceed what the source-linked record supports.

## Build order

1. Finish/deploy Developer Platform V1 acceptance.
2. Implement permanent Living Place route and Tralee place identity.
3. Send one reviewed Irish fixture through V1 into the deployed environment.
4. Bind that evidence to the Tralee page.
5. Add the timeline/evidence drawer.
6. Add one additional source family.
7. Generate and test permanent QR artwork.
8. Only then prepare plaque/venue demonstration.

## Definition of success

A person standing at Tralee Bay Wetlands can scan one permanent BioVeracity QR code and immediately see a simple, beautiful, source-linked account of what BioVeracity currently knows about the place, what has changed through time, and where the evidence comes from — while the underlying developer platform remains reusable for every future Living Place.
