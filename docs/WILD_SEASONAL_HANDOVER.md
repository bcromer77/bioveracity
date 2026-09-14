# Seasonal ecology hubs — review and release handover

> Integration amendment: see ONSITE_API_INTEGRATION.md. PR #47 now incorporates the seasonal work, keeps references on-site and replaces Wild webpage cards with a bounded county biodiversity API feed. Earlier test passes below describe the earlier individual feature head, not the combined amendment. Check the new CI result before release.

Prepared 14 September 2026. Built on `clarity/usability-release` at `c9c542f4f5c217006e4ee509d1bf9551e01f61e9`. This extends the integrated Wild Counties/community work; it does not replace it with the older `main` branch.

## Outcome

The landing page leads with a hotel/venue benefit: “Give guests a reason to explore. In every season.” It shows an interactive seasonal example, a guest guide, a content plan and a QR journey. Professional evidence tools remain reachable. Display copy now says “Your ecology hub”; the existing example URL keeps its identifier so previous QR links are not broken.

An authenticated venue owner can create a private draft, describe the venue, upload photographs, optionally import Google Trends, generate twelve monthly entries, edit/review them, and explicitly publish an immutable approved edition. The public hub selects that edition's current month in Europe/Dublin on each request. No background scheduler is needed. An expired or future plan does not display a misleading current monthly entry; the venue story remains available.

## What is automated, and what is still an owner decision

- Automated: draft persistence, twelve-month editorial generation, county reading-link selection, optional historical Trends summarisation and suggested lead month, image scanning/resizing/metadata removal, approved publication snapshot, stable QR generation, calendar-based monthly feature selection.
- Owner decisions: accurate venue information, rights/representation attestation, upload selection, review of all twelve entries and publication. Saving new drafts never changes the public version. Publication is not business-identity verification or environmental certification.
- Not implemented: live Trends ingestion, generative-model calls, booking forecasts, automatic social posting, paid billing, sign manufacture, review of rights claims, automatic business verification or county-directory placement. Public hubs are reachable through their owner-shared link/QR and remain noindex in this release. No paid membership starts on publication.
- Trends: only a single-series English Interest over time CSV is supported (Day/Week/Month). Preserve series label, supplied search term/geography/explore link, import time, observation date precision, missing/censored values. Monthly means include only exact values in the imported series; mixed years and incomplete months are historical planning clues, not predictions. No source is fetched automatically from supplied URLs.
- Wider-area links reuse the existing county catalogue. Unknown publication/event dates stay unknown. No regional species is asserted to occur at a venue. There is no new regulator endorsement, customer or partnership claim.

Google's official API is an alpha with limited access: https://developers.google.com/search/apis/trends . CSV export guidance: https://support.google.com/trends/answer/4365538?hl=en-CA . These are implementation research references, not proof that a live integration exists.

## Abacus release prerequisites

This handover supersedes the earlier “one new setting / no schema change” statement for this new feature only. No production environment was changed, database migrated, main branch merged or deployment triggered during implementation.

1. In an isolated staging database, apply `nextjs_space/prisma/migrations/20260914_wild_hubs/migration.sql` using the project's controlled migration process. It adds `WildHub`, `WildHubPhoto`, `WildHubPublication` and indexes/FKs to the existing User model; it does not seed businesses. Confirm Prisma migration history before deploying migrations; do not blindly replay the full migration directory against an existing database.
2. Generate the Prisma client using the existing project output configuration. Preserve the deployment's existing database/auth configuration.
3. Set `WILD_PUBLIC_ORIGIN=https://bioveracity.com` for the intended live environment; verify the deployment environment, not merely a local file. The QR API returns 503 when missing/malformed.
4. Set `WILD_HUBS_ENABLED=true` only after staging checks and database readiness. Default false keeps the new API disabled and studio in a contact-for-pricing state. The new landing/example copy can deploy with the feature off.
5. Existing `CLOUDMERSIVE_API_KEY` must work for photo uploads. The owner explicitly consents to external security scanning; missing credentials/scanner errors reject the upload. Never bypass scanning. No new third-party service is introduced.
6. Install with the committed Yarn dependency graph (`ci/yarn.lock`); this adds direct sharp and restores the qrcode/type entries missing from the imported CI lock. The deployment's externally managed root Yarn lock must match this graph through its normal setup. Do not use an npm lock file.
7. In staging: sign in through both supported flows, return to `/wild/studio`, create a draft; another account cannot read/change it. Import a CSV, generate/edit all months, upload a permitted test photo, explicitly approve and publish. Anonymous page/QR must show only the approved edition. Change a draft without changing the public page. Unpublish and confirm public page/QR/photo access disappears. Validate 390px and 1440px layouts, production QR destination and printed proof before fulfilment.

Rollback: first set `WILD_HUBS_ENABLED=false` to stop new hub/API/public access. Revert code to the previously approved release if necessary, leaving the additive tables and records intact. Do not drop customer data to roll back the UI. Old fictional example routes continue to work.

## Bounded operations and evidence integrity

Three hubs per account; twelve photos per hub; six scan attempts per hub per hour, consumed before external scanning. Originals up to 3 MB, JPEG/PNG only; max 20 million decoded pixels; output at most 1600×1600 and 1.5 MB. Re-encoding removes EXIF/GPS and originals are not stored. Upper bound for image bytes is 18 MB per hub / 54 MB per account, excluding database overhead/backups. Global signup abuse protection, measured storage/scan charges and production traffic limits need operational review before unrestricted public promotion.

Private storage is durable Postgres with owner checks and parameterised queries. Transactions use serializable isolation, row locks and revision conflicts. Retried identical creation requests reuse the same hub; duplicate photo content reuses the same photo (conflicting credit/description returns 409). Publication/unpublication is audited with actor and content hash. Only selected published photos are public; private and public image responses are no-store, and unpublishing revokes anonymous reads. Identifiable child material and sensitive locations are prohibited in the upload attestation; the scanner checks malware, not content appropriateness or ownership.

## Verification record

Automated: explicit TypeScript check; production build; Wild Counties and Wild community regression suites; new PGlite database tests for ownership, retries, revisions, publication, quota, selected photos and revocation; real sharp metadata removal and fail-closed scan tests; React component tests for seasonal controls, creation retry, draft edits and approval gating; private-workspace regression tests. Test content is synthetic and scanner/database paths isolated. No real notification emails or production records created.

The live pre-change site had an authenticated session during review. The new local preview could not be opened by the browser service (ERR_BLOCKED_BY_CLIENT); therefore the new UI has component/build validation, not a claimed visual or authenticated staging end-to-end pass. Staging browser, scanner-credential and live-domain QR checks remain release gates. Existing non-blocking parser.ts:58 build warning is unrelated.
