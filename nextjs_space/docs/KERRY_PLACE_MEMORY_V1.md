# Kerry Place Memory V1

Status: implementation candidate only. Not merged, deployed, migrated or populated.

Authoritative place identity: `bv_place_ie_kerry_tralee_bay`

Authorised manifest SHA-256: `330ee5f6f6bae640ed2e8361441cd3f7fd14b3e577836d402c8c45c7e6241c43`

Proposed cargo: `docs/kerry-001.proposed.json`

Proposed cargo SHA-256: `3ed8d59ec262a13bf4d163f65d2194579cbd6354044afd9b95443616a444ccd6`

## Operating invariants

- `Asset` is reused as the logical Place. It has no manufactured master geometry.
- `Area` is reused for each independent spatial object. SPA, SAC, catchment, water-body,
  monitoring and census geographies remain separate records.
- `PlaceSpatialVersion` preserves an immutable source geometry version, source CRS,
  source scale/precision, effective-date precision, retrieval time, rights and provenance.
- Platform raw and canonical evidence remain the source records. Place Memory is an
  additive, traceable projection; it never rewrites the raw body or canonical evidence.
- Original statements, source assertions, curated search vocabulary, machine
  interpretations and verified identifications are separate representations.
- A qualifying interest is not a current observation, prediction or abundance claim.
- Test-mode Platform evidence cannot project into or be retrieved from Place Memory.
- Access control is applied in SQL before text is supplied to a semantic reranker.
- No public submission or Place Memory HTTP endpoint is introduced in V1.

## Implementation map

| Capability | State before Kerry V1 | Decision |
|---|---|---|
| Logical place identity | `Asset`, identifiers and aliases exist | `SHOULD_REUSE`: one `Asset` with stable ID; do not create a second Place table |
| Independent geography | `Area` and `AssetArea` exist; geometry is optional WKT | `SHOULD_REUSE` plus immutable source JSON geometry versions; do not create a synthetic Tralee Bay polygon |
| PostGIS | Not established by repository migrations; explicitly deferred in the existing schema | `SHOULD_NOT_ASSUME`: retain source geometry/CRS in JSONB for V1 |
| Platform raw/evidence | Five-table V1 raw-first contract exists | `SHOULD_REUSE`: source containers and public evidence IDs remain authoritative |
| Observation semantics | Event/finding/source/revision records exist | `PARTIAL`: extend the immutable event contract for future QR-originated data; no intake route |
| Source/provenance | Platform provenance and older `SourceDocument` primitives exist | `SHOULD_REUSE` Platform lineage for KERRY-001; do not duplicate the raw document |
| Evidence classes | Several older free-form class fields exist | `PARTIAL`: Place Memory adds a bounded descriptive class vocabulary without ranking classes universally |
| Honeycomb | Existing private-case live external-source search exists | `SHOULD_NOT_REUSE` as the persistent Place Memory store; it is transient and case-scoped |
| Lexical search | PostgreSQL available; separate evidence database has full-text/pgvector work | `SHOULD_REUSE` PostgreSQL full text in the primary store; keep its search representation rebuildable |
| Semantic search | `EvidenceEmbedding`/pgvector exists for a separately configured evidence database | `PARTIAL`: an authorised-candidate reranker interface exists, but no embedding provider/index is enabled for Kerry V1 |
| Taxonomy/concepts | No durable cross-source concept layer for Platform evidence | `MISSING` before V1; add entity and separately attributable term records |
| Public/private access | User roles and private workspace membership exist | `SHOULD_REUSE`; gate candidates before lexical/semantic result construction |
| Venue/QR | WildHub owns venue QR paths and moderated community submissions | `SHOULD_REUSE` later as an origin; do not couple Kerry V1 to WildHub or add a second submission product |

## Durable model

### Reused

- `Asset`: logical Place identity.
- `Area`: independently identifiable spatial object.
- `AssetArea`: source-backed Place/spatial relationship.
- `PlatformRawEvidence`: untouched submitted source container.
- `PlatformEvidence`: canonical bounded evidence with `ev_*` identity.
- `ObservationEventRecord`: future human observation event (not used by KERRY-001).
- `PrivateWorkspace` and membership: organisation-private scope.

### Added

- `PlaceSpatialVersion`: immutable version of one source spatial object.
- `PlaceMemoryItem`: bounded designation, observation, measurement, event, claim,
  intervention, model output or analysis.
- `PlaceMemorySourceLink`: primary, same-underlying-record or superseding source link.
- `PlaceMemoryEntity`: source-controlled entity/concept identity.
- `PlaceMemoryTerm`: source, curated, machine or verified terminology, with provenance.
- `PlaceMemoryItemEntity`: relationship plus assertion state and original source assertion.
- `PlaceMemoryRelation`: explicit source/uncertainty-bearing item-to-item relationship.
- `PlaceMemorySearchDocument`: rebuildable search representation, separate from evidence.

Together these support `PLACE × TIME × ENTITY × EVENT × SOURCE × EVIDENCE` without
making a PDF or search vector the knowledge object.

## Evidence classes

The V1 vocabulary is:

1. `AUTHORITATIVE_STATUTORY`
2. `AUTHORITATIVE_MONITORING`
3. `PROFESSIONAL_OBSERVATION`
4. `STRUCTURED_CITIZEN_OBSERVATION`
5. `UNVERIFIED_PUBLIC_SUBMISSION`
6. `MODEL_DERIVED_OUTPUT`
7. `BIOVERACITY_DERIVED_ANALYSIS`

These are provenance/fitness descriptors, not a universal rank. Fitness remains dependent
on the question. Original evidence is immutable; interpretations are separate records or
relationships and remain attributable/versionable.

## Retrieval

### Deterministic

SQL filters cover Place ID, time bounds, evidence class, entity ID, publisher and source
external ID. Time filters cannot manufacture a date: undated evidence is not silently
placed in a dated interval.

### Lexical

PostgreSQL `to_tsvector`/`websearch_to_tsquery` indexes cover both English stemming and
the simple tokenizer. Identifiers, source terminology and curated concept terms are held
in a separate, rebuildable search document.

### Semantic/concept

`AuthorisedSemanticReranker` is a narrow interface. SQL access control produces the
candidate set first; only authorised `itemId/content` pairs may reach a provider. No
external provider, vector column or extension is enabled in this candidate. The existing
separate evidence-store pgvector implementation should only be adapted later if it can
preserve this pre-retrieval boundary.

Embedding similarity can reorder authorised candidates. It cannot edit evidence,
relationships, dates, geometry, classification or certainty.

## Security boundary

Public candidates require:

- `visibility = PUBLIC`;
- `rightsState = CLEARED_FOR_INGEST`;
- live-mode source evidence (or an explicitly derived item with no Platform source).

Workspace-private candidates require an unrevoked workspace membership. Restricted
candidates require the existing administrator role/access state. Test-mode evidence is
excluded across every visibility class. The same predicate is applied again when tracing
provenance so an item ID cannot become a private-record existence oracle.

Search results contain neither geometry nor raw bodies, credential material, secret
hashes or private snippets. Spatial disclosure is represented by a policy label only.

## KERRY-001 projection

Only a live Platform record matching the strict KERRY-001 adapter contract projects:

- provider `npws`;
- external ID `SPA:004188:datasheet:2023-10-17:boundary:3.03`;
- exact manifest SHA-256;
- SPA `004188` / `IE0004188` identity;
- reviewed CC BY 4.0 rights state;
- source boundary version `3.03`, CRS EPSG:2157 and 1:5000 source scale;
- 22 exact bird SCI codes plus the wetland/waterbirds interest.

The projection creates one logical Place, one separately versioned SPA spatial object,
one statutory designation item and 23 qualifying-interest entity relationships. Dates
remain unknown because the source fields are not asserted as observation/publication
semantics. A retry is idempotent; a second publication of the same underlying source can
be linked without counting it as independent evidence.

`docs/kerry-001.proposed.json` was generated from the reviewed NPWS structured datasheet
snapshot and official boundary service. It contains no token, SDK call, POST operation,
schedule or backlog reference.

## Human-language qualification

The fixed judgement set covers:

| Audience | Query | Required interpretation |
|---|---|---|
| Scientific | What are the qualifying interests for SPA 004188? | designation and 23 source assertions |
| Council | Which birds is Tralee Bay protected for? | designation, not an abundance claim |
| General public | What important birds are associated with Tralee Bay? | qualifying-interest relationship |
| Child/descriptive | Are there black and white birds with orange beaks here? | curated candidate term for A130, not a new identification |
| Incorrect assumption | Which of these birds can I definitely see here today? | return context plus explicit current-presence warning |

The test logs the selected memory item, match mechanism, matched entities and warning for
each query. It measures retrieval; it does not generate persuasive prose.

## Provenance traversal

`ANSWER → memory item → entity relationship → PlatformEvidence → PlatformRawEvidence
fingerprint → request ID → publisher → source external ID/URL → retrieval time →
licence/rights/attribution`.

The trace exposes the raw fingerprint and identifiers, never the raw body.

## QR/citizen-science readiness

The data contract can preserve Place ID, original language/text, temporal precision,
source geometry/CRS/spatial uncertainty, media reference/hash, anonymous or attributed
state, claimed observation, separate machine candidates, verification state,
licence/consent and sensitive-location disclosure. The migration adds conservative
fields to the existing immutable observation event record.

No public submission endpoint, media pipeline, moderation UI or publication flow is
created. WildHub remains the likely reusable origin rather than a new parallel product.

## Migration and rollback

The migration is additive. It adds seven knowledge/spatial tables plus the rebuildable
search table, nullable provenance fields to `AssetArea`, and conservative future-QR
fields to `ObservationEventRecord`. It installs no extension, inserts no data, changes
no V1 route and performs no geometry union.

Before any future production authorisation:

1. verify the exact reviewed source SHA/tree and migration hash;
2. take and verify a restorable database backup;
3. confirm no `20261003_kerry_place_memory_v1` partial state exists;
4. rehearse against a restored production-equivalent database;
5. apply only the reviewed migration and verify the schema delta;
6. deploy with no credential and no cargo;
7. run legacy and V1 regressions;
8. create a single temporary, appropriately scoped live credential only under a
   separate controlled-train approval;
9. send KERRY-001 once and verify every relationship/provenance link;
10. revoke the credential and stop.

Before cargo, rollback is application rollback plus reversal of only the empty added
objects/columns from the verified backup or reviewed inverse migration. After cargo,
rollback means reverting the projector/retrieval application while retaining evidence
and Place Memory records; do not destroy evidence to simulate rollback.

## Explicit technical debt

- No PostGIS validation/containment; source geometry is preserved but not spatially queried.
- No production semantic provider, embedding model or multilingual vocabulary.
- No recovery worker for a processor interrupted while `PROCESSING` (existing railway debt).
- No public/operator Place Memory HTTP/UI surface; retrieval is a library boundary only.
- No automated refresh/version-diff for NPWS source changes.
- No general projector registry beyond strict KERRY-001 dispatch.
- No deletion/withdrawal workflow for rights changes.
- Curated English common/descriptive bird terms require a governed taxonomy source before scale.
- QR fields are data-contract readiness only; rights, moderation, image safety and legal review remain separate work.
- The original manifest is bound by hash but is not duplicated into this repository.
