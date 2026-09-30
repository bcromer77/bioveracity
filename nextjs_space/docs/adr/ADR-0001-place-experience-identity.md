# ADR-0001: Place Experience V1: identity, boundaries, read model, replication, Ask, performance and migration gates

- Status: **Accepted**. Approved by Bazil Cromer; recorded with Place Experience PR E (opaque Place Access Points, gate G-ACCESS).
- Date: 2026-09-28
- Scope: Place Experience V1, Phase 1 (universal Place foundation and first real-evidence Place).
- Base: release line `origin/gate3c/deployed-b776a6c` at `66f6be1`. **Not** `main`.
- Supersedes: nothing. It conflicts with draft PR #82 (`/p/{slug}` inside the QR code); that PR is to be superseded by decision, and PR A does not touch it. PR #78 (brand mark) is out of scope and PR A does not touch it.
- Related: `docs/KERRY_PLACE_MEMORY_V1.md` (Asset reused as the Place; no Place Memory HTTP endpoint in V1). PR #84 principles are adopted by reference: a venue is data, not a deployment; spatial truth is kept separate from disclosure.

## 1. Context

KERRY-001 created the first production Place Memory. It is keyed to the Asset whose id is the Place ID. Place Experience V1 must present that memory publicly. It must also let a second Place, and later Fodder or a river Place, be created as **data and configuration, not a fork**.

Today:
- the Place ID pattern was duplicated in two modules with different bounds;
- nothing guarantees `Asset.id` immutability;
- there is no public-safe read model;
- the only public rendering of the Place is the legacy `/asset/[slug]` page, whose payload includes the internal id (reconciliation finding F-1, not addressed in PR A).

## 2. Decision: three distinct identifiers

| Identifier | Example form | Role | Mutability | May encode |
|---|---|---|---|---|
| **Place ID** | `bv_place_<suffix>` (`PLACE_ID_RE`, suffix 1..120 of `[a-z0-9_]`) | **Identity.** Evidence, configuration, permissions, relationships and access points are all keyed to it. Stored on `Asset.id`. | **Immutable.** Never reassigned, reused, renamed or derived. | Nothing secret. Not a credential. |
| **Slug** | `tralee-bay` | **Locator only.** Human-readable public routing: `/place/{slug}`. | Mutable through a history table. Retired slugs 308 to the canonical slug. | Nothing beyond a readable name. |
| **QR access ID** | opaque, at least 128 bits, base62 | **Locator only.** A physical entry point: `/p/{id}` → Place ID → canonical slug → `/place/{slug}`. | Status lifecycle (active, withdrawn or revoked). Never reused. | Nothing: not DB identity, tenant, permission or geography. |

Rules:
1. Resolution always runs **locator → Place ID → content**. Content is never selected by slug or access ID directly. A Place ID is never computed from a slug or access ID.
2. A Place has zero or more slugs (exactly one canonical) and zero or more access points.
3. Installation geography (where a sign stands) is separate from Place geography (the designated area) and is never used to infer it.
4. `Asset.id` is immutable for Place Assets:
   - **PR A (application level, no schema change):** a `assertPlaceIdentityUnchanged` guard, plus a permanent static test proving that no app, lib or script write path (Prisma `asset.update`/`updateMany`/`upsert` update payloads, raw `UPDATE "Asset" SET`, raw `ON CONFLICT DO UPDATE`) writes `Asset.id`. The only Place-creating path, the projector, uses `ON CONFLICT (id) DO NOTHING`.
   - **Deferred:** a database trigger, only behind the migration gate (§8).
5. No subdomains, custom domains or Place Networks in Phase 1.

## 3. Decision: security worlds

| World | Who | Reach | Must never reach |
|---|---|---|---|
| Public visitor | anonymous | Public-safe Place read model only (§4), through `/place/*` and `/p/*` | admin, operator, ingestion, API keys, raw or private evidence, restricted existence, internal ids beyond what is necessary |
| Authenticated customer or custodian | signed-in account with a scoped relationship | Phase 1 adds nothing to this world | other customers' Places or private evidence |
| BioVeracity operator | `operatorAccess` (admin role) | Operator views, and (PR E) issuing QR SVGs for an access point | production database tooling |
| Production administrator | admin plus email step-up | Existing `/admin` surfaces | — |

- Public Place UI has **zero navigational paths** into admin, database tooling, operator controls, ingestion, key management, or raw or private evidence controls.
- Absence of links is not enforcement. Every route and API enforces its boundary server-side. The tests cover: direct access, id manipulation, cross-Place access, unauthenticated requests, QR enumeration, malformed identifiers, and API responses independent of the UI.
- Everything fails closed.
- Unknown, withdrawn and revoked access IDs, unknown slugs and non-Place Assets all return a **uniform 404**, so there is no existence oracle.

## 4. Decision: public-safe read model contract (implemented in PR C)

A single server-only module (`lib/place/public-read-model.ts`, planned) is the **only** source of public Place data. Permission filtering happens **before** rendering, search construction, semantic processing, LLM exposure or API response.

**Admission predicate:** evidence is live mode, `visibility = PUBLIC`, rights `CLEARED_FOR_INGEST`, and belongs to the resolved Place ID. Test-mode, private, restricted or uncleared items are excluded, and their existence is not disclosed.

**May contain:**
- Place display name and canonical slug;
- the statement as recorded;
- evidence class;
- the entity label and role (for example "qualifying interest");
- publisher, dataset name, licence, attribution, source URL and retrieval date;
- geography version label and retrieval date;
- truthful time states.

**Must never contain:**
- raw evidence bodies or raw ids;
- request ids and platform evidence ids;
- fingerprints or hashes;
- embeddings and internal snippets;
- workspace, tenant or operator data;
- ingestion controls;
- API credentials or hashes;
- environment and internal paths;
- moderation internals and operator notes;
- private contributor details;
- stack traces;
- database ids where not needed. The Place ID itself is not exposed to the public UI unless a later decision requires it.

**Truthful states** are an enumerated vocabulary, never free text: `NOT RECORDED`, `NOT SURVEYED`, `NOT LOCATED`, `UNKNOWN`, `NOT YET INGESTED`, `RESTRICTED` (public wording only where disclosure is allowed), `NOT COMPARABLE`.

**Time** is carried as separate fields that are never merged: observation, publication, retrieval, source datasheet date "as stated by the source", and geography version.

**Current-presence trap:** designation or qualifying-interest evidence is never rendered as presence, sighting or record. The DTO carries the source's current-presence-not-established flag through to the UI.

**Payload size:** raw geometry is never included (§7).

## 5. Decision: replication (non-negotiable, permanent)

- A Place is **data and configuration**. The route resolver, shell, navigation, mobile experience, map, chronology, species or entity views, evidence and source traversal, permissions and QR resolver are single generic implementations.
- Generic code under `lib/place/` and `components/place/` may not contain Place-specific literals. `tests/place-generic-literals.test.ts` enforces this permanently (`tralee`, `kerry`, `004188`). The full Place ID is caught by the same patterns.
- Place-specific source adapters stay in `lib/place-memory/` (for example `kerry-001.ts`). Only the source-neutral registry connects them.
- A synthetic, test-only second Place (`bv_place_zz_…`) exists **only** as in-memory PGlite fixtures (PR G). It is never written to the shared database. It never enters production routing, sitemap, indexing, public search or production registries, and tests assert each of those exclusions.
- The target test for future Places is: create Place → establish geography → ingest authorised evidence → configure presentation → issue QR → live, **without** building another website.

## 6. Decision: Ask This Place contract

The pipeline is: query → Place resolution → entity resolution → time window → authorised retrieval → evidence relationships → permission filter → deduplication → comparability → answer → source.

- Identifiers, dates, numbers, ordering, status and calculations are **deterministic**. Semantic retrieval may only help **find** admitted evidence; it never creates evidence. An LLM may only explain admitted evidence; it is not the evidence store.
- Phase 1 ships the **typed interface contract and a truthful disabled state** only. There is no generic chat box, no LLM call, and no semantic provider.
- The existing current-presence guard in retrieval is kept.

## 7. Decision: performance budget

- **300 KB or less** of initial application and data transfer on mobile, excluding intentionally loaded hero media. This is an engineering budget, not permission to degrade imagery.
- Nothing is loaded before the user asks for it. Maps, full species lists and evidence detail are lazy.
- The current Place geometry (a single source version) is about 258 KB of JSON by itself. It is **never inlined**. It is served simplified or reprojected server-side, on demand.
- Measured in PR H: initial mobile load, interaction readiness, route transitions, evidence expansion, map load, and weak-network behaviour.

## 8. Decision: deferred migration gates

The development and production databases are the **same** database, so any schema change is a production write. PR A makes **no** schema change.

| Gate | Artefact | Needed by |
|---|---|---|
| G-SLUG | Additive `PlaceSlug` (Place ID FK, slug unique, canonical flag, retiredAt) | PR B |
| G-ACCESS | Additive `PlaceAccessPoint` (opaque id, Place ID FK, status, timestamps; no geography, tenant or permission encoding) | PR E |
| G-IMMUTABLE | Optional trigger refusing `UPDATE` of `Asset.id` where the old id has the Place prefix | PR B, bundled |

Each gate requires, in this order:
1. PGlite rehearsal in tests;
2. rehearsal on a restored copy of the latest verified production dump;
3. a written migration plan with a rollback;
4. **explicit approval from Bazil**;
5. application via the guarded `db:release` route only (never `migrate dev`, never `db push`).

KERRY-001 and Train #001 rows must remain unchanged, verified by before and after snapshots.

## 9. Known divergence (recorded, not changed in PR A)

- The retrieval validator bounds the suffix at 120 characters (`PLACE_ID_RE`).
- The QR draft contract historically accepted any `[a-z0-9_]+` suffix, with the whole value capped at 160 characters (`PLACE_ID_SHAPE_RE`, 151-character suffix maximum).
- PR A preserves both behaviours exactly, proved by a parity test against the former literals.
- Converging the QR contract on `PLACE_ID_RE` is a deliberate behaviour change for a later reviewed slice. No stored Place ID exceeds 120 characters today.

## 10. Delivery sequence (each PR ships dark behind a server-only `PLACE_EXPERIENCE_ENABLED`, absent by default)

1. A: this ADR, the shared identity validator, the immutability guard and the generic-literal guard.
2. C: public-safe read model.
3. D: universal `/place/[slug]` shell and `BioVeracityPlaceMark`. The mark is blocked on the approved small four-petal reference and mock-up; it is not approximated.
4. F: traversal (designation, entity, evidence, source, lazy map, truthful timeline, Ask disabled state).
5. G: synthetic replication.
6. H1: hardening.
7. B: slug history and the legacy `/asset` redirect (G-SLUG).
8. E: QR access points and `/p/[id]` (G-ACCESS).
9. H2: acceptance journeys A–G.

Each PR is reported separately as IMPLEMENTED / TESTED / MERGED / DEPLOYED / ENABLED.

## 11. Consequences

- **Positive:**
  - one identity rule;
  - Places can be created from data;
  - public safety is enforced at one choke point;
  - migrations are isolated behind explicit gates.
- **Negative or accepted:**
  - the legacy `/asset/{slug}` surface stays as it is until PR B;
  - database-level immutability waits for G-IMMUTABLE;
  - the application guard is a function plus a static proof, not a database constraint.
