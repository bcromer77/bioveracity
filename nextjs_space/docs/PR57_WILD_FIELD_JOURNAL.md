# PR57 — Wild Counties Living Field Journal (first implementation: Fodder in the Woods, County Down)

## Purpose

Build the first Wild Counties **Living Field Journal** experience — a place-led, editorial
digital record of a landscape through the year — extending the existing **WildHub**
architecture (owner studio, photos, publish/editorial-review workflow, public renderer, QR).

Fodder in the Woods (Finnebrogue Woods, County Down) is the **first venue we design against**,
but this PR ships **reusable Wild Counties capabilities**, not Fodder-specific code. Everything
here must work equally for a Kilkenny craft venue, a Cambridgeshire hotel, a farm or an estate.
We prefer configuration and content over venue-specific branching.

**This PR ships dark.** `WILD_HUBS_ENABLED` stays absent/not `'true'`, so nothing here renders
publicly and no owner setup API responds. Fodder is not seeded, not published, not described as a
partner. No emails, no deploy, no merge, no production data change. Laura is not provisioned.

## What we reuse (do NOT duplicate)

- `WildHub` / `WildHubPhoto` / `WildHubPublication` / `WildHubReview` models and their migrations.
- `hubService` (owner-scoped, transactional, `HubError`) and `reviewService` (admin editorial review).
- Photo pipeline `photoInput` + `preparePhoto` (virus scan, sharp re-encode, **EXIF/GPS strip**).
- `hubRequest` / `reviewRequest` HTTP wrappers (flag gate + auth + same-origin `body()`), `privateHeaders`.
- Public rendering chain: `getPublishedHub` → `app/wild/places/[id]/page.tsx` → `PublishedHub`.
- Design language (`bv-*` CSS classes, forest/gold/cream palette, Europe/Dublin dates, DejaVu fonts).
- The evidence-class precedent (`CommunityReport.evidenceClass`, `ObservationCandidate` lifecycle):
  provenance is kept **separate from** editorial publication status and is never silently upgraded.

## New capabilities in this PR

### 1. Visitor contributions (the key reusable capability)
Scan plaque/QR → explore → **"What did you notice?"** A visitor may submit: one photo, a broad
category, an optional date/time, an optional approximate location (free text — never coordinates),
"what do you think you saw?", an optional private note, and explicit permission to publish.

Broad categories: **Bird, Mammal, Insect, Plant, Fungi, Farm animal, Water, Sky, Other, I don't
know** — "I don't know" is intentional; we never force an identification.

- A submission is a **community observation** (`evidenceClass = 'community-observation'`), NOT
  ecological verification. It never enters the evidence pipeline (`CommunityReport` /
  `ObservationCandidate`) and never becomes "verified wildlife".
- **Nothing auto-publishes.** Every contribution is stored `PENDING`.
- Public submission API is flag-gated, same-origin, virus-scanned, EXIF/GPS-stripped, size-limited,
  rate-limited per hub, and only accepted for a **published** hub.

### 2. Owner curation (Laura)
A beautiful, extremely simple moderation surface: view the contribution, its photo and context, then
**approve for publication** or **reject**. Approving sets publication status only — it **never**
changes the evidence class, and never creates ecological evidence. The owner can mark a contribution's
location as **sensitive** (nest/roost) so it is never publicly exposed even if a location was typed.
The private note is shown to the owner for context but is **never rendered publicly** (reduces the
risk of exposing a child's name or other identifiable detail). The submission form collects **no name
field** by design.

### 3. Public Field Journal — "A Year in the Woods"
An editorial January→December record of the place. Each item keeps its provenance and status badge:
- **The place** — the venue's own story and approved photos (venue-supplied).
- **Source-linked** — authoritative county/regional records (existing `CountyNature`, source cited).
- **Visitor observation** — community-contributed, not verified.
- **Unidentified** — "Nobody has identified this yet."
Months with nothing recorded show a quiet, deliberate empty state ("Nothing recorded here yet — what
will you notice?"), never a species counter or a fabricated sighting.

### 4. Panoramas as a first-class WildHub media capability
Implemented **without a second media system**: a `WildHubPhoto` gains `kind` (`photo` | `panorama`)
and `meta` (JSON) holding restrained editorial points (Look closer / Listen / What's living here? /
What changes after dark? / Seen something?). Mobile-first, lazy-loaded, with an elegant static-image
fallback (the image itself renders with no JS; points are progressive enhancement).

## Data model (additive migration `20260918_wild_field_journal`)

- `WildHubPhoto`: add `kind TEXT NOT NULL DEFAULT 'photo'`, `meta JSONB` (nullable). Additive-safe.
- `WildHub`: add `contribCount INT NOT NULL DEFAULT 0`, `contribWindow TIMESTAMP(3) NOT NULL DEFAULT now()`
  (per-hub public-submission rate window). Additive-safe.
- New table `WildContribution` (visitor community observation):
  `id, hubId(FK→WildHub cascade), photoBytes BYTEA, photoHash TEXT, broadCategory TEXT,
   whatYouThink TEXT, note TEXT (private), observedAt TIMESTAMP?, coarseLocation TEXT,
   permissionToPublish BOOL, evidenceClass TEXT DEFAULT 'community-observation' (immutable),
   publicationStatus TEXT DEFAULT 'PENDING' CHECK IN (PENDING,PUBLISHED,REJECTED),
   sensitiveHidden BOOL DEFAULT false, moderatorId TEXT?, moderatorNote TEXT, createdAt, moderatedAt?`.

All changes are new tables / nullable-or-defaulted columns — no destructive change, no data loss.
Migration dated `20260918` so it sorts **after** the base WildHub tables it references.

## Files

- `prisma/schema.prisma` — additive model/columns (above).
- `prisma/migrations/20260918_wild_field_journal/migration.sql` — additive SQL.
- `lib/wild-hubs/contributions.ts` — categories, validation, contribution service (public submit +
  owner list/photo/moderate + published read), public redaction, journal month mapping.
- `lib/wild-hubs/journal.ts` — assembles the "A Year in the Woods" view from published snapshot +
  published contributions, with provenance classes and empty states.
- `lib/wild-hubs/contribution-http.ts` — `contributeRequest` (public) + `ownerContribRequest` (owner).
- `app/api/wild/contributions/route.ts` — public POST (flag-gated, scanned, PENDING).
- `app/api/wild/hubs/[id]/contributions/route.ts` — owner GET list + POST moderate.
- `app/api/wild/hubs/[id]/contributions/[cid]/photo/route.ts` — owner-only photo bytes.
- `components/wild/field-journal.tsx` — public Field Journal renderer.
- `components/wild/panorama.tsx` — panorama with editorial points + static fallback.
- `components/wild/contribute-form.tsx` — visitor "What did you notice?" capture form.
- `components/wild/contribution-curator.tsx` — owner curation surface.
- `app/wild/studio/curate/page.tsx` — owner curate route (flag + auth gated).
- `components/wild/published-hub.tsx` — integrate journal, panorama and contribute section.
- `app/wild/studio/page.tsx` — add a link to the curate route (minimal).
- `tests/wild-field-journal.test.ts` — PGlite integration tests.

## Testing intent

Against an isolated in-memory PostgreSQL, mirroring `tests/wild-hubs.test.ts`:
contribution → persistence (PENDING) → owner moderation → publication → appears in the public journal;
rejecting keeps it out of the journal; **approving does not change `evidenceClass`**; a non-owner
cannot list, view or moderate another owner's contributions; contributions to an unpublished hub are
refused; unpublished/PENDING contributions are never publicly readable; sensitive-flagged locations are
redacted from public output; the private note is never in public output; category validation incl.
"I don't know"; per-hub rate limiting; same-origin enforcement.

Then `tsc --noEmit`, a production build, and the new test file. Wild Hubs flag stays OFF throughout.

## Explicitly out of scope / gated to Bazil

Merge to main, deployment, enabling `WILD_HUBS_ENABLED`, production migration, provisioning Laura's
account, any email, seeding Fodder as a live/public venue, Stripe, redesigning the main site, any
social-network features.
