# Cambridge / River Cam demo handoff

Reviewed 8 September 2026 against integration commit f687be14aeb956df5d69a8b79bc23d78a1d2a07d and BioVeracity ZIP 22. Application files in that ZIP match the commit. This is a code review and isolated test run, not a live-site acceptance test.

## Included fixes

- Shared SQL eligibility gate for keyword results, hybrid results, vector indexing and backlog. Newest source version is chosen before eligibility. Requires PUBLIC, PERMITTED, VERIFIED, non-catalogue, no unresolved incoming warning and a source register granting the relevant use.
- Source-register permittedUses now has an explicit machine contract: comma-separated tokens `display,embedding,export,acquisition`. Prose does not authorise an operation. This patch consumes display and embedding only. Review existing register entries; do not bulk approve them.
- Licence and required attribution travel with returned passages and are visible in search results.
- Organisation filter on /evidence uses the dedicated evidence client and the same display gate (this was missed by the preceding routing fix).
- Identical-content retries apply new restrictions and no longer move old versions ahead of newer corrections.
- Map filter labels describe local topic/time filtering and link to real reviewed-source search. Whole-place verification inferred from status wording removed. Reference basemap, optional imagery, attribution and hover names added.
- River Cam reference links and year-specific EA classification context. Separate correction script is dry-run by default; no database data changed here.

## Demo sequence

1. Open `/regions/cambridgeshire-peterborough` and identify Cam water body GB105033042750.
2. Follow Place and timeline, then Explore the map. River point is indicative; connection lines are not river geometry or a dispersion model.
3. Select River Cam and follow Search reviewed sources. Log in as an ordinary registered account. Query River Cam, ecological classification and phosphate. Explain keyword fallback if the vector backend is unavailable.
4. Open each supporting source passage and show classification year, event precision, retrieval date, licence and review definition.
5. Explain the unresolved local question: what separately reviewed evidence establishes conditions around the Milton discharge? Do not attribute waterbody status to that facility from proximity.

EA source checked: https://environment.data.gov.uk/catchment-planning/WaterBody/GB105033042750 . Ecological status Moderate in 2019/2022; chemical Fail in 2019 and Does not require assessment in 2022. This does not establish chemical improvement or current sensor conditions.

## Small Abacus tasks, in order

### 1. Integrate and verify
Integrate this PR into integrate/evidence-search. Run prisma generate, explicit typecheck and test:evidence. Do not deploy yet. Show the resulting SHA and results. Confirm the actual Abacus preview/production deployment and rollback route.

### 2. Finish source authorisation
Build the authenticated source-register and document-classification workflow. Resolve acquisition permission server-side from the approved dataset, not the incoming acquisition_permitted boolean. Preserve restrictive warnings and record authorised resolution; never silently clear them. Scanner matches require contextual review, and scanner non-matches do not grant permission. Catalogue metadata must itself be safe. Verify both original and reviewer-authored text. No public-data bulk approval.

### 3. Configure isolated storage
Configure the pgvector-capable evidence database through secure settings. Prepare and verify an evidence-only migration path for 0001/0002/0003 in isolation; do not run the entire application migration history against either shared production or the new evidence database. Current deployment documentation does not establish this isolation. Verify runtime and worker credentials point to the intended database. No credentials in GitHub or chat.

### 4. Prepare actual Cam evidence
Acquire and review a small permitted collection using real source passages, year-specific dates and source-register grants. Existing Asset/Event records are NOT automatically EvidenceDocument/EvidenceReview records and will not automatically become semantic search hits. Establish their place identifiers without assuming that every Cam reach is the same water body. Review the correction script dry-run on preview data: `node --import tsx scripts/correct-cam-classification.ts`. Apply only after checking its proposed changes and rollback. Do not run broad seed scripts.

### 5. Finish lifecycle and prove the demo
Implement required text/excerpt/vector/cache purge separately from status-only withdrawal. Test with synthetic restricted records. Backfill approved public records; wire the scheduled indexer and show backlog/last-success. Demonstrate real embeddings and ordinary-account results. Record whether map and evidence search show the same intended case, failures and missing coverage. Measure actual preparation time; no invented savings.

### 6. Visual acceptance and release
Check the rendered map at desktop and mobile sizes, tile-provider attribution including imagery contributor requirements, search links, login return path, map layers and timeline. Source inspection here could not establish the live site's appearance or populated database state. Capture the complete preview journey before requesting deployment approval.

## Deliberate limits

The new gate will hide previously visible records until authorised classification/source registration is completed. That is intended, not a reason to relax it for a demo. Source acquisition, admin classification, purge, database provisioning, scheduled collection and real embedding quality are not completed by this PR. Public legacy Asset/Event pages are a separate dataset and need their own publication review; this gate does not retrofit those pages.
