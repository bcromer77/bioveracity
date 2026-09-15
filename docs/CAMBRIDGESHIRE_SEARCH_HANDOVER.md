# Cambridgeshire–Peterborough ecology search

15 September 2026. Implementation owner: Codex. Hosting/release route: the existing Abacus app, subject to identifying its actual checkout and rollback. This change does not deploy, migrate, contact partners or alter private case data.

## Integration base

Stack on `feat/wild-cambridgeshire-seed` / PR49, remote parent `2e21cfcbcb7b0bb7a2872214cda25019e34fbe03`. That branch depends on PR47. Preserve the separate PR48 marketing request. The local baseline commit only reconstructs the same PR49 files; GitHub publication uses the real remote parent. Do not retarget onto older main without the dependencies.

## What users can do

At `/wild/cambridgeshire`, search the six-district regional collection using badgers, snowdrops, dragonflies, orchids, bitterns, bluebells, woodland, wetlands and seasons. Common names and selected scientific names resolve to explicit concepts. Unknown modifiers are not silently discarded. Area filters include Cambridge, East Cambridgeshire, Fenland, Huntingdonshire, South Cambridgeshire and Peterborough.

Thirteen sourced visitor accounts are connected to their existing page anchors and editorial related places. Overhall Grove is the new, source-reviewed badger account. It does not expose sett locations or guarantee sightings. Anglesey Abbey is explicitly a cultivated snowdrop display. Manager accounts are separate from dated occurrence metadata. No claim of a business partnership is introduced.

LNRS woodland, grassland and wetland themes organise interpretation. Gardens are not automatically assigned a recovery action. The source and public map references are retained. This is **thematic organisation only**: official action polygons, funded actions, delivery receipts and verified improvements are not imported. Do not present the theme tags as a geographic LNRS action match. The council page reports December 2025 publication; the different reported registration date remains unresolved rather than overwritten.

## Countywide ingestion

`npm run ingest:cambridgeshire` queries official ONS May 2024 district polygons for all six codes, uses each bounding box to obtain GBIF pages, and applies polygon membership before acceptance. This uses a regional polygon query path rather than the separate Ireland-only seven-cell private-case search. Irish grid IDs and private-case APIs are unchanged.

The script retrieves all taxa, not just bats. It accepts present GB records with supported CC0/CC-BY licences, a known species, dataset identity, observation year and coordinate uncertainty up to 1 km. It rejects withheld/generalised records, geospatial issues, unsupported licences and out-of-polygon points. Missing precision is excluded, not invented. These gates deliberately reduce coverage.

Raw locations and record identifiers stay in memory. The output groups records by district, species, dataset and licence, retaining year range and dataset attribution. Publication is coarse regional context, not a precise occurrence search or proof of presence at a visitor attraction. District assignment uses the reported point; uncertainty may overlap a neighbouring district. Group counts are records, not unique animals or independent observations. Deduplication uses GBIF record key; independently republished records with different keys may remain.

This is a bounded **full refresh**, not an incremental cursor/backfill service. Default: 20 pages × 300 records per district, at most 36,000 inspected rows before filtering. The configurable maximum is 300 pages per district, still below the API's large-offset constraints. A cap yields `partial`, never `complete`. Full source enumeration at a larger scale may require GBIF's download workflow; that is not implemented here. Even `complete` means the bounded source query was exhausted, not complete biological knowledge.

Each district has counts for inspected, accepted, rejected and duplicate rows, last checked time, next inspected offset and state. Source failure is not an absence result. A failed refresh cannot replace an existing valid snapshot; inspect the `.attempt.json` receipt. The process returns 2 for partial/unavailable coverage and 1 for failure. The index remains usable when deliberately partial, provided the limitations are shown.

## Running and hosting

From `nextjs_space` with the repository's dependencies installed:

```sh
npm run test:cambridgeshire
npm run test:wild-counties
CAMBRIDGESHIRE_SNAPSHOT_PATH=/absolute/controlled/path/cambridgeshire.json CAMBRIDGESHIRE_MAX_PAGES=20 npm run ingest:cambridgeshire
```

Use a writable controlled directory for the acquisition job and make the resulting public projection readable by the app. The default local output is `.cache/cambridgeshire/snapshot.json`. Do not commit raw occurrence responses, source extracts, precise coordinates, study exports or private evidence. The publication script uses temporary-file rename for atomic replacement and writes an attempt receipt. Run only one refresh job at a time.

Configure the **same** `CAMBRIDGESHIRE_SNAPSHOT_PATH` in the host app. The page revalidates at five-minute intervals; it does not query external providers for each visitor. Snapshot schema/size failures show an explicit unavailable message while retaining the place accounts. The parser strips unrecognised fields and checks count totals. No URL or path comes from the public user. No new database or AI calls are required.

The snapshot is currently passed to the client for local filtering, with a 10 MiB safety limit and 50,000-group validator limit. Measure payload size before expanding; move group filtering/pagination to a public server endpoint if it becomes large. Do not treat these safety maxima as recommended payload sizes. The public region page cannot access private cases or their evidence.

Do not claim scheduled refreshing until a job is configured on the actual host with a durable shared path, appropriate retention, observed successful runs and an owner. No scheduler or production environment was changed in this PR.

## Measuring outcomes

The optional pilot panel records two jobs:

1. Guest starts a timer, finds a place, and explicitly records whether it was useful and previously known. Count new useful discoveries and total completed tasks.
2. Professional/facilitator enters total manual and assisted time for matched tasks, assessed correctness and task order. Include checking and corrections in each time. Alternate task order to reduce learning bias. Calculate median paired percentage time saving; retain negative savings.

Results remain in memory in that browser tab. A user may download an anonymised JSON export or clear it; refreshing clears it. There are no tracking cookies, network submissions, participant identifiers, query logs or private document fields. This is a facilitated pilot instrument, not centralised production analytics or unique-user counting. Browser-required fields and a shared validator check inputs; export includes the results and derived summary.

Suggested initial gate: at least three professional comparisons, at least 30% median time saving and no reduction in assessed accuracy. This is a proposed early signal, not a statistically validated commercial threshold. Zero observations means “not measured”. Synthetic tests must never be included in participant results.

## Verification and release gates

Run the new behavioural tests, existing Wild County checks, strict TypeScript and the actual host production build. Tests cover natural language/scientific synonyms; cultivated versus wild evidence; all six districts; unknown species/places; seasonal mismatch; link resolution; LNRS limitations; boundary holes; licences; absence/generalisation; duplicates; pagination; unavailable sources; malformed snapshots; privacy projection; and measurement arithmetic/accuracy.

Before release, verify desktop/mobile layout and a complete guest task/export; run a reviewed professional comparison; validate a real snapshot through the deployed page; ensure privacy and source references remain readable; and confirm the deployed SHA. No numerical user benefit can be claimed from automated tests.

Further scope remains: exact LNRS action-layer matching and rights, regional habitat/measurement/planning ingestion, record-to-site relations with uncertainty, CPERC agreement, scheduled backfill/refresh, central study collection if commissioned, and statistically credible user evaluation. These are not quietly represented as completed by the new search.

## Sources reviewed for this implementation

- Wildlife Trust BCN, Overhall Grove, introduction/Species/Know before you go: https://www.wildlifebcn.org/nature-reserves/overhall-grove
- National Trust, Anglesey Abbey snowdrops, collection/When to see: https://www.nationaltrust.org.uk/visit/cambridgeshire/anglesey-abbey-gardens-and-lode-mill/snowdrops-at-anglesey-abbey
- County Council LNRS page, published strategy and live habitat map sections: https://www.cambridgeshire.gov.uk/residents/climate-change-energy-and-environment/improving-the-natural-environment/cambridgeshire-and-peterborough-local-nature-recovery-strategy
- ONS May 2024 BGC district service: https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/Local_Authority_Districts_May_2024_Boundaries_UK_BGC/FeatureServer
- GBIF API reference: https://techdocs.gbif.org/en/openapi/

All other visitor source references remain attached to the original PR49 place accounts. BGC is a generalised administrative boundary, not a definitive land parcel or ecological boundary.


## Recorded verification: 15 September 2026

- `npm run test:cambridgeshire`: **16 passed**, including actual React component interactions. React's test renderer emits its deprecation notice; this is not a browser visual test.
- `tsc --noEmit -p tsconfig.cambridgeshire.json`: **passed**, including the new components, core modules, importer and tests against actual React/Next type packages.
- Existing Wild County registry/discovery checks: **passed**. Modified county page: esbuild transpilation **passed**. Full app typecheck, actual host build, desktop/mobile browser QA and production deployment were not completed in this environment.
- Real capped import: **7,800 inspected rows, 1,321 eligible records, 499 district/species/dataset groups**, 160,030-byte public snapshot. These are acquisition results, not user benefit measurements.

| District | Inspected | Eligible | Coverage |
|---|---:|---:|---|
| Cambridge | 1,500 | 794 | Partial: sample cap |
| East Cambridgeshire | 300 | 4 | Partial: later retrieval/validation failure |
| Fenland | 1,500 | 87 | Partial: sample cap |
| Huntingdonshire | 1,500 | 66 | Partial: sample cap |
| South Cambridgeshire | 1,500 | 131 | Partial: sample cap |
| Peterborough | 1,500 | 239 | Partial: sample cap |

The saved real snapshot passes `loadSnapshot` and `parseSnapshot` and was searched through the implemented engine:

| Query | Place accounts | Occurrence groups | Eligible records in those groups |
|---|---:|---:|---:|
| badgers | 1 | 0 | 0 |
| snowdrops | 1 | 6 | 15 |
| Galanthus nivalis | 1 | 5 | 11 |
| orchids | 2 | 5 | 8 |
| Lepidoptera | 1 | 22 | 28 |
| wider ecology | 13 | 499 | 1,321 |

Badger proof is the reviewed Overhall Grove manager account; no eligible GBIF badger record was present in this sample. Snowdrop occurrences are not automatically classified as wild rather than cultivated. Lepidoptera includes moths as well as butterflies; the narrowed query logic does not label all order-level records as butterflies. The first saved snapshot predates the added family-based narrow tags, so such groups stay unclassified for narrow queries until a fresh import. No taxa are inferred from habitat suitability.

The public projection is a separate controlled acquisition artifact, not committed occurrence data. To use it in the hosted demonstration, place the delivered snapshot at the configured path or rerun ingestion in the host environment, then verify it through the page after revalidation. **There are no guest or professional participant results yet.**
