# Scottish and ecology source ingestion

Regional extension: docs/regional-population.md supersedes the external route request and environment settings below. Scottish adapter behaviour remains as documented.

Implemented 10 September 2026 on a review branch based on packaging/self-contained-worker at 35ac0821de4c59b712b4f4b27bcaf3db735ed806. No deployment, migration, secret installation, feature activation or nightly scheduling performed.

## What differs from the supplied draft

The supplied connectors.ts, external route and db.evidence model were absent on the inspected branch. Existing ingestion uses receiveEvidence, EvidenceDocument, source/version identities, sensitivity handling and a PENDING_REVIEW queue. This new external route calls that same service; it does not replace the existing /api/ingest/evidence route or invent England/Ireland connector imports.

Missing coordinates remain absent. No Edinburgh/Glasgow fallback point is inserted. Unknown event/publication dates remain null. HabMoS year-only dates stay year-only. NatureScot UPDATED is a dataset field, not a designation date. SEPA exact timestamps and quality codes remain in retained source JSON; date-only indexing uses the source observation's day. Latest SEPA values can be old or revised. No reading is labelled a pollution finding or certified truth.

## Sources

- SEPA: documented KiWIS getTimeseriesValueLayer, group 41804. Official documentation https://timeseriesdoc.sepa.org.uk/api-documentation/api-endpoint-examples/time-series-data-queries/ . Group includes river and tidal series: adapter selects SG river paths, sorts by series path, and exposes bounded paging. One bounded response is downloaded; paging is local over a changing latest-values view. Not a historical backfill or national snapshot. No unit is invented; raw value and q_code are preserved. SEPA reuse reference: https://timeseriesdoc.sepa.org.uk/ .
- NatureScot SSSI: https://services1.arcgis.com/LM9GyVFsughzHdbO/arcgis/rest/services/Sites_of_Special_Scientific_Interest/FeatureServer/0 . Published fields are NAME, PA_CODE, SITE_HA, UPDATED, not the draft's SITE_NAME/HECTARES/STATUS_DATE. Query filters by EPSG:4326 envelope; requests attributes only. No polygon is misread as a point. Official catalogue https://opendata.nature.scot/datasets/sites-of-special-scientific-interest/explore .
- NatureScot HabMoS: WFS capabilities at https://ogc.nature.scot/geoserver/habitatsandspecies/wfs?service=WFS&version=2.0.0&request=GetCapabilities advertise habitatsandspecies:habmos. This replaces the unverified habitats_and_species type. A live feature returned HABITAT_NAME, SURVEY_DATE=2003 and MultiPolygon geometry. Polygon geometry stays in raw feature JSON using CRS:84; no centroid fabricated. This is habitat mapping, NOT a species sightings feed. Oversized features fail explicitly. Pagination sorts by polygon/component fields but is not a transactional snapshot.
- Glasgow: official weekly-list app https://experience.arcgis.com/experience/1c6a148f30af413ba30b71b9afd34ba0 resolves to an ArcGIS utility backing service that returned HTTP 403. fetchScottishPlanningData explicitly returns blocked and makes no bypass attempt. See https://www.glasgow.gov.uk/onlineplanning . This does not cover all 32 Scottish councils. Public weekly PDF reports may support a separate reviewed adapter later.

The draft's SEPA legacy URL and other guessed service URLs could not be verified. Working replacements above were researched rather than treating a failed request as no records.

## Endpoint contract

POST /api/ingest/external with Authorization: Bearer <secret>. The secret must be a newly generated 64-character hex value; the publicly pasted phrase is rejected. Install it using the hosting secret manager; no real secret or .env was committed.

Request JSON: {"dryRun":true,"offset":0,"limit":20,"bbox":"-4.5,55.8,-3.0,56.0"}. Empty body defaults to dry run. Limit 1..50, offset 0..100000, validated geographic bbox. Same page settings are sent to each active source; each result reports its own nextOffset. Follow per-source cursors rather than claiming full coverage from one call. Default bbox covers a limited central-Scotland area; SEPA scope is separately paged national river readings.

SCOTLAND_INGEST_ENABLED=true permits authenticated dry runs. Writes require dryRun=false, SCOTLAND_INGEST_WRITE_ENABLED=true AND the existing BIOVERACITY_EVIDENCE_ENABLED=true. SCOTLAND_ACQUISITION_APPROVED is a server-managed comma-separated list (sepa,naturescot-sssi,naturescot-habitats) set only after acquisition/reuse review. Unapproved sources produce catalogue-only records through the existing intake. Even approved sources stay PENDING_REVIEW and are not automatically public/searchable. Source-register association and reviewer publication/licence decisions remain necessary under existing eligibility rules.

Max 4 MiB per upstream response, 15-second deadline, no redirects, 4 KiB request body, at most 150 candidate records per invocation. No LLM or embedding calls, no arbitrary user-supplied endpoints. This is not an account-level spend cap: frequent authorised invocations and database writes can still incur hosting costs. No schedule has been activated.

Responses report per-source status, fetched/rejected counts, nextOffset, created/duplicate/catalogue-only counts and failed writes. HTTP 207 means incomplete (including blocked Glasgow), not complete success; schedulers must inspect success and source statuses. No upstream bodies, database errors or credentials are returned. A bad source does not discard good-source results. Retries use existing transactional version-hash deduplication; no findFirst/create race is introduced.

## Validation and remaining gates

Scoped strict TypeScript compilation includes both implementation modules and the real evidence contract. Nine tests cover zero readings, missing timestamps, stable identity/version hashes, unknown SSSI dates, HabMoS year precision/polygons, bbox validation, upstream failures, blocked Glasgow, auth and write gates, dry run and partial write errors. The thin route wrapper imports the actual existing receiveEvidence service; full app typecheck/build and database integration tests must run in the deployment-equivalent environment before merge. No full Next.js build or production DB acceptance is claimed here.

Activation requires hosting configuration and reviewed acquisition permissions; test a dry run, then an isolated database write/retry, review status and cross-user access before production. Rollback: disable SCOTLAND_INGEST_ENABLED; preserve existing evidence versions. Keep Abacus's login and parser work intact.

Live read-only check, 10 September 2026: the exact generated requests (limit=1, default bbox) returned HTTP 200 for all three active sources. Their captured responses were run through the adapters and the real validateEvidence contract: one record each, zero rejected, explicit nextOffset=1; event precision day/unknown/year respectively. This checks actual source payload mapping without production writes. The Node fetch transport itself was fixture-tested; live requests used Python HTTPS transport in this environment. No raw live data was committed.
