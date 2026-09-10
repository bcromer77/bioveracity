# Regional automatic intake: implementation and activation

10 September 2026. Stacked on Scottish connector PR #34 (2f01608c26dabc5a817fc8c7e19ddf0d007c6320). This is code for automatic REVIEW-QUEUE intake, not a claim that production has been populated. No database connection, endpoint secret installation, default-branch merge or hosted deployment was available in this session. Never publish imports as VERIFIED_SOURCE solely because a government API supplied them.

## Coverage and evidence of readiness

| Requested feed | Implementation | Remaining limitation |
| --- | --- | --- |
| NatureScot SSSIs, SEPA river readings, HabMoS | Reuses PR34 adapters; regional caller uses Scotland discovery envelope for NatureScot | Prior small live samples passed; broad query is bounded and may exceed geometry size limits. No full national coverage claimed. |
| Natural England habitats | Priority Habitats Inventory attributes in East Anglia discovery envelope | Different dataset from existing Natural England SSSI PR; schema checked in official REST directory; new adapter fixture-tested, not live-validated here. Not habitat condition. |
| Environment Agency gauges | Station/measure catalogue within 75 km of Cambridge, retains latest readings only if supplied | Spatial discovery, not all England or all East Anglia; no measurement date inferred from retrieval. New adapter fixture-tested, live payload not obtained here. |
| NBDC species: Wexford, Waterford, Wicklow, Carlow, Kilkenny | Five separately paged GBIF queries scoped to NBDC publisher and explicit county; strict returned publisher/country/county check | New adapter fixture-tested; live county response/filter behaviour unverified. Incomplete or withheld records are rejected, not silently accepted as complete coverage. |
| Irish planning: same five counties | Five separately paged official NPAD queries matching PlanningAuthority | Catalogue metadata only: reference, authority, status, type. No applicant names, address, free-text proposal, geometry or comments. Live county enum/query results remain unverified; reported errors or empty results are not comprehensive coverage. |
| EPA Ireland WFD | Explicit blocked status | Official 2019–2024 river status catalogue found; exact queryable layer/schema not verified. WFD assessment period must not become today's event date or be confused with hydrometric readings/risk. |
| Scottish planning | Explicit blocked status from PR34 | Official Glasgow app backing endpoint returned 403; no bypass. Does not cover 32 councils. |
| East Anglia objections | Explicit blocked status | Supplied CPCA portal unverified; no scraper/anonymisation pipeline exists. Contextual re-identification review and source acquisition approval required. No fabricated anonymised records. |

Species projection keeps key, dataset/publisher, scientific name, taxon, basis, licence, country/county and year. It excludes coordinates, locality, observer, media, precise date and free-text fields. Records with informationWithheld/dataGeneralizations are rejected for separate review. This reduction does NOT establish full anonymisation or universal safe species disclosure; records still enter existing sensitivity and publication review. Dataset attribution/licence and GBIF occurrence reference are retained.

Authority labels in NPAD are explicitly constrained to each named county/council (including Waterford city/county legacy labels), never guessed from a rectangular bbox. The attached sample bbox also clips parts of the requested region; it is not used as a county substitute.

## Sources inspected

- Irish NPAD catalogue: https://data.gov.ie/dataset/national-planning-applications . Service: https://services.arcgis.com/NzlPQPKn5QF9v2US/arcgis/rest/services/IrishPlanningApplications/FeatureServer . Fields inspected in /layers: PlanningAuthority, ApplicationNumber, ApplicationStatus, ApplicationType; no invented AppNumber.
- NBDC publisher: https://www.gbif.org/publisher/d2b97690-bfd6-11de-b279-d52977ace833 . API: https://techdocs.gbif.org/en/openapi/ . The guessed records.biodiversityireland.ie endpoint was not treated as verified.
- Natural England priority habitats: https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/Priority_Habitats_Inventory_England/FeatureServer/0 . Uses MainHabs, HabCodes, FeatDesc and stable GlobalID.
- EA reference: https://environment.data.gov.uk/flood-monitoring/doc/reference . This API describes observations/catalogue; it is not EPA Ireland WFD.
- EPA catalogue: https://data.gov.ie/dataset/wfd-river-waterbody-status-2019-2024 . Discovery/read failures were not taken as absence of data.
- Planning comments official route: https://www.greatercambridgeplanning.org/planning-applications/view-and-comment-on-planning-applications/ . No collection or third-party message was sent.

## Request and schedule

POST /api/ingest/external now requires ONE source ID, for example {"source":"irish-planning-wexford","offset":0,"limit":5,"dryRun":true}. Arbitrary URLs are rejected. See REGIONAL_SOURCES for all 18 IDs. Existing Scottish helper remains tested; this explicit-source contract replaces the previous all-Scottish-at-once body.

A scheduled runner posts one page (five records) for each source daily at nominal 03:47 UTC. It saves each source's nextOffset ONLY after acknowledged successful writes, with zero failed writes and source status ok. Dry runs, partial failures and blocked feeds retain the cursor. End-of-results resets to zero for another scan. This is a rolling bounded scan, not guaranteed immediate detection of every new item: API edits can shift offsets, a long backfill can delay refresh, and rejected records pause that source for review. Idempotent server intake prevents exact duplicates. High-watermark/change-feed integration is a later source-specific improvement.

The 12-minute job cap bounds runner time. No LLMs, embeddings or paid data keys. This does not guarantee zero spend: Actions minutes/storage and app/database usage require account-level budget checks. At most 90 fetched candidates per daily cycle (18 x 5; blocked sources return zero). No automatic public index promotion; only the existing reviewed-evidence indexing path may publish eligible evidence.

GitHub cache contains cursors only, never records or secrets. Eviction restarts from zero; the server's review queue is the durable deduplication authority. Reports retain 3 days and contain only counts and statuses. Partial failure exits nonzero and does not wipe the last successful cursor. Workflow is dormant until the default-branch integration and enable variable are in place.

## Concrete hosting handover

1. Review the stacked PRs, run full application typecheck/build and isolated database route/retry tests. Deploy to the approved preview first; preserve parser/login work.
2. Set REGIONAL_INGEST_ENABLED=true for the preview; keep REGIONAL_INGEST_WRITE_ENABLED=false initially. Install a NEW 64-hex INGEST_CRON_SECRET through secret settings. Do not use the exposed phrase.
3. Live-test one page from each enabled source and verify actual returned counties, source fields and licence/acquisition permissions. Confirm blocked sources remain visibly blocked. Do not bypass 403 or treat zero results as no environmental activity.
4. For approved intake set REGIONAL_INGEST_WRITE_ENABLED=true and existing BIOVERACITY_EVIDENCE_ENABLED=true. Set REGIONAL_ACQUISITION_APPROVED to reviewed source IDs only. Otherwise receiveEvidence stores catalogue references. Existing source-register association, licence review and sensitivity/publication eligibility still apply.
5. In GitHub configure secrets REGIONAL_INGEST_ENDPOINT (canonical HTTPS URL ending /api/ingest/external) and INGEST_CRON_SECRET to match the preview. Set REGIONAL_REFRESH_ENABLED=true after confirming included Actions capacity; REGIONAL_DRY_RUN defaults true unless explicitly false. Merge through the approved default-branch route to make schedule/dispatch available. Run dry mode, inspect reports, then enable write mode only after the isolated write checks.
6. To stop: REGIONAL_REFRESH_ENABLED=false and/or REGIONAL_INGEST_ENABLED=false. No deletion of existing evidence.

No hosting secrets, deployment rights, billing budget or live ingestion success are assumed. This session could not populate the hosted database.

## Validation

Scoped strict TypeScript compile passes. Fifteen tests (nine inherited Scottish tests, four regional connector tests, two nightly client tests) pass. They cover county/publisher mismatches, withheld species, excluded personal/location fields, zero readings, stable hashes, source errors, access control, write gates and cursor retry behaviour. No full Next build or new live-source acceptance claimed. Public HTTPS attempts for the new APIs were blocked/cancelled by this environment; no access-control workaround was attempted.
