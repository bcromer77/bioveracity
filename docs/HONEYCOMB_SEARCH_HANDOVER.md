# Honeycomb search: implementation and handover

14 September 2026. Base: `clarity/usability-release`, full SHA `c9c542f4f5c217006e4ee509d1bf9551e01f61e9`. Branch: `feat/honeycomb-search`. This is separate from seasonal ecology hubs PR #46. No production writes, migrations, merge or deployment.

## Working user journey

Open an existing private case, select an Irish town, and use **Honeycomb search** beneath the current investigation map. Select up to seven cells from the 19-cell local grid, optionally enter words and dates, then search. The panel queries NPWS SAC/SPA/NHA/proposed-NHA polygons, national planning points and eligible GBIF bat observations. Results show source links, date precision, spatial explanation, licence and coverage. Type filters separate sites, planning and bats; cards are paged 25 at a time without hiding total counts. Cells can also be selected by keyboard using checkboxes. Changing case, place, scale, cells or filters cancels/invalidates old results. Results are public-source context and are not silently added to private case evidence or reports.

## Mathematical contract

A fixed equirectangular projection defines an Ireland-only axial lattice:

`x = R cos(53.5°) (longitude + 8°)` and `y = R (latitude - 53.5°)`, with angular differences in radians and R = 6,371,000 m.

Cell centres: `x = s sqrt(3) (q + r/2)`, `y = 3sr/2`. Supported s: 500, 1000, 2000 projected metres. IDs `iehex1:s:q:r` encode grid version, scale and lattice position. Closed clockwise rings are shared by map and server. Nearest-centre membership with deterministic ties assigns each reported point once. Longitude distortion varies with latitude; these are projected search areas, not equal ground-area or surveyed boundaries. Coordinate domain: latitude 51–56, longitude -11–-5; the source adapters cover the Republic rather than establishing all-island completeness.

NPWS intersection is performed on the actual hex polygon by ArcGIS, not a site centroid. A site spanning several selected cells is deduplicated by designation and six-digit site code, retaining all matched cell IDs. Proposed NHAs retain proposed status. Planning membership describes the published application point, not a proposal boundary. Bat membership describes the published coordinate; source uncertainty remains explicit and may extend beyond a cell. Sensitive/generalised, missing-uncertainty, >=5 km uncertainty, non-PRESENT and unsupported-licence bat records are omitted and counted. The 5 km threshold preserves the existing connector's conservative generalisation policy; it is not a mathematical accuracy guarantee. No similarity or proximity score is presented as ecological certainty.

## Retrieval and scope

- Canonical cell IDs are decoded server-side. One scale, one to seven cells, local extent and 160-character word bounds are enforced.
- Every request verifies current case membership before reading input or contacting providers. Existing authentication, feature flag, same-origin body checks and private/no-store headers apply.
- Server fetch hosts and schemas are fixed. Responses are capped at 3 MB, upstream requests at 8 seconds and a whole search at 24 seconds. NPWS concurrency is four (other two sources run alongside it).
- NPWS checks each selected cell against four layers, max 100 rows per query; a limit/failure/malformed row produces partial/error coverage. Planning and bats inspect at most 200 rows from the enclosing box then filter by true cell membership. This is a bounded source search, not a complete archive search. Counts are before user word/date filters, after source validity/spatial gates.
- Word search requires each normalised token in the returned title, publisher or details. It is plain lexical matching, not question answering or automatic semantic expansion. Date filters use overlap for month/year precision and exclude unknown dates; boundary version is not an event date.
- All sources are independently reported as checked, partial or unavailable. Empty results never establish ecological absence.
- Per-process pacing permits one request per case per five seconds and at most eight concurrent searches. This is not a distributed/account-wide quota. No query text is retained by the pacing map. Monitor before expanding to multiple server instances.
- No API keys, paid search system, new dependencies or schema changes are needed. Existing `PRIVATE_WORKSPACES_ENABLED=true` and working workspace authentication/database remain prerequisites.

This release does not implement national NPWS ingestion, SAC/SPA species-summary enrichment, vector search, water/weather/objection search, cell-linked private documents, automatic evidence acceptance, or deployment. The earlier all-counties import prompt remains a separate ingestion task. It does not automatically wire species associations into this boundary search.

## Validation evidence

- Explicit full application TypeScript check passed.
- Actual Next.js 16.3.3 Turbopack production build passed. Existing `lib/workspaces/parser.ts:58` dynamic filesystem tracing warning remains; it is unrelated to this change. Build skips type errors by existing config, so the separate TypeScript check is essential.
- `npm run test:honeycomb`: 18 geometry, source retrieval/filtering, real PostgreSQL-compatible case access and React interaction tests pass. Fixtures cover canonical cells, edge ownership, bbox false positives, spanning-site deduplication, partial upstream failures, bounded pagination, unknown dates, permissions/revocation, seven-cell limit and stale-response suppression.
- Existing private-workspace, Wild Counties and Wild community checks passed.
- Dependencies were reused from an existing prepared development environment. The platform-managed root lockfile symlink was temporarily replaced with the checked-in `ci/yarn.lock` for build, then restored. No dependency updates are included.
- Browser visual check attempted through the supported browser service; local preview was blocked with `ERR_BLOCKED_BY_CLIENT`. No browser screenshot or authenticated end-to-end visual pass is claimed. The temporary preview route was removed. React tests stub the map; they do not replace Leaflet visual QA.

Live upstream checks, public town centres only, 14 September 2026:

| Search | NPWS results | Planning | GBIF bats |
|---|---|---|---|
| Kilkenny, one medium cell | River Barrow and River Nore SAC 002162; River Nore SPA 004233 | 176 cell-matching points; partial due to inspection cap | Request failed; correctly shown unavailable |
| Enniscorthy, one medium cell | Slaney River Valley proposed NHA 000781 and SAC 000781, distinct designations | 168 cell-matching points; partial due to inspection cap | Successful request; zero eligible results in this cell |

Enniscorthy full search took approximately 7.7 seconds. These are sampled checks, not whole-county coverage, ecological absence findings or evidence of production deployment. No positive live bat result was established; bat matching/sensitivity behaviour is verified with fixtures.

## Release and rollback

Before release through the confirmed Abacus application route, perform staging owner/foreign/revoked-case checks through the actual HTTP route; test cell selection, source links, map uncertainty, keyboard controls and mobile layout in a browser that can access staging. Verify outbound access to NPWS ArcGIS, the national planning layer, GBIF and Esri map tiles. Check multi-instance traffic pacing needs. Preserve existing auth, database and parser/scanner configuration.

Merge/deploy only under the applicable release authorisation and with a known previous deployment checkpoint. Rollback is code-only: revert this branch's changes to restore the prior workspace UI; no database rollback or evidence deletion is required. Do not reset the release branch or overwrite PR #46.
