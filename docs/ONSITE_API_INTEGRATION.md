# Combined seasonal hubs and honeycomb review

Prepared 14 September 2026. PR #47 now incorporates PR #46 using a merge commit with both feature heads as parents. It targets clarity/usability-release. Merge #46 then #47 if keeping the two release steps; #47 contains both and can also be reviewed as the combined change. No main merge, production migration or deployment is performed.

## Requested behaviour

Environmental content is read inside BioVeracity. Source and venue reference URIs are retained as expandable text rather than outgoing links. All application JSX anchors use the shared EvidenceLink component, which allows internal navigation and expands external references inline. It never fetches user-supplied URLs, redirects to them or implies their full contents were retrieved. Map attribution links point to an on-site credits page; Leaflet's default outgoing prefix is replaced with on-site attribution. Credits are preserved. Authentication providers still perform their required sign-in redirects. Internal original-file viewing and local downloads remain functional.

The existing environmental record, source, licence, dates and uncertainty fields are not removed. Private imported documents, venue photographs and historical evidence remain valid inputs; “API-only” describes external environmental discovery, not a deletion of those records.

## API discovery

- Honeycomb: the existing NPWS polygon intersections, national planning API and eligible GBIF bat retrieval remain in the private case. Source data comes from fixed API hosts with existing request, membership, response-size and time limits.
- Wild Counties, example hubs and published hubs: hard-coded webpage summaries are no longer rendered as live nature content. A new bounded first-party endpoint retrieves NBDC-published biodiversity records from GBIF using the existing validated GADM county mapping for all 26 Republic of Ireland counties.
- County feed: at most 50 upstream records inspected and 12 displayed; exact publisher/country/administrative assignment, PRESENT status, supported CC BY 4.0/CC0 licence and withheld/generalised exclusions are enforced. County-scale display omits personal names and precise coordinates. Dates retain source precision. This is a sample of historical records, not species completeness, current presence or venue sightings.
- Full responses (including actual check time) are cached per process for 15 minutes, with one in-flight request per county. Failures cache for 30 seconds. There are at most 32 accepted county keys; failures never substitute a webpage or invented record.
- County Down and other Northern Ireland counties explicitly report that their county API is not connected. NPWS is an Irish authority, not a DAERA substitute. The County Down material remains in the source archive, not represented as an API feed.
- NPWS national county population remains separate. Current NPWS live access is in the cell-based private honeycomb. The new public county feed is GBIF/NBDC, not NPWS qualifying interests or full source reports.
- Google Trends still has no live integration. Optional owner CSV imports in #46 are historical supplied material, not API retrieval. No live Trends claim has been added.

Owner-approved venue text/photos/monthly plans stay separate from the live county feed, which can update independently. Legacy source references in stored plans are retained, but new plans do not copy static webpage-summary cards. Public publication is still not business identity verification, environmental certification or payment.

## Validation and release

The local execution environment failed to initialise during this amendment. Do not reuse the earlier 18-test or #46 build passes as proof of this combined commit. A dedicated read-only GitHub Actions workflow runs the combined honeycomb, seasonal hub, new source/link policy, existing workspace and Wild regression tests, full TypeScript check and production build. It uses fixture sources and PGlite, no production secrets or migration. Review its actual result on the exact head before release. Static source inspection and direct execution of the routing helper were possible during preparation.

Staging browser/mobile, authenticated case/hub, scanner and QR checks are still required; none is claimed complete here. Preserve #46's additive migration and default-off WILD_HUBS_ENABLED release process. The public county feed needs no database migration or API secret. It performs read-only public API requests when a county is viewed. No production ingestion, county evidence acceptance, email, social posting or deployment is triggered by this PR.

Rollback: disable self-service hubs as described in WILD_SEASONAL_HANDOVER and revert the code if required; retain existing customer tables, uploaded files and publication audit history.
