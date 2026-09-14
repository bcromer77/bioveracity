# Kilkenny and Down: business demonstration and landing-page completion

Status: implementation request for Abacus; documentation only. No application changes, new tests, merge, migration, flag enablement or deployment are included in this draft PR.

## Outcome and ownership

Deliver two complete, source-backed county experiences and a clear homepage for both visitor businesses and professional teams. Bazil intends to demonstrate the offer to businesses and begin marketing. Abacus is the requested implementation recipient for this bounded task; do not run competing implementations.

Use the existing green, gold and cream identity, British English, and "Contact us for pricing". Signage is upfront and membership monthly. Do not invent prices, signed partners, booking outcomes or certification.

## Integration base and existing work

This request is stacked on PR #47, feat/honeycomb-search at 47dcbf50cc07ead2fc42ad075f3631a9ad5982b3. That PR targets clarity/usability-release and incorporates #46. PRs #43–45 contain earlier protected-place, county and community work.

Read AGENTS.md and docs/WILD_MVP_RELEASE.md. The workflow/handover in chore/chief-of-staff-workflow is dated 9 September; refresh its status rather than treating it as current implementation evidence.

Before coding, reconcile the latest Abacus checkout, full SHA, dirty changes, unpushed commits and current PR heads. Preserve the live otter-image update and all unrelated work. Do not overwrite newer Abacus changes with this branch or assume this branch is the deployed version. Incorporate changes on one agreed integration branch and update this draft's status as implementation is added.

PR #47 already implements private hub creation, photos, twelve-month plans, separate editorial review, publication and stable QR addresses. Its documentation records two additive migrations and a default-off WILD_HUBS_ENABLED flag. Missing live setup is not proof that these features need rebuilding. Inspect configuration and migration readiness; never flip a flag merely to bypass release gates.

## Live baseline: 14 September 2026

Browser observations, not a deployment-SHA receipt:

| Page | Observed state |
| --- | --- |
| / | Credited otter photo is live. Headline is "The nature around you is changing. Help people notice." Hero text and CTA are guest/venue focused; professional section is near the bottom. |
| /wild/studio | Even while signed in, "Online setup is being prepared. Contact us to discuss your venue and seasonal plan." |
| /wild/kilkenny | Zero eligible records, 50 inspected and 50 excluded. No curated county stories or discovery map displayed. |
| /wild/down | "County API not connected", zero records. No curated county experience displayed. |
| /wild/places/example-woodland-venue | Labelled fictional County Down example; generic demonstration text and empty county data. |
| /workspace | Authenticated workspace and existing case listings load. No fresh upload/export or isolation test was performed in this review. |

Do not publish account identities, private case IDs, documents or credentials in this PR.

## 1. Homepage: connect the place, then route the audience

Replace the hospitality-only hero proposition with:

**Every place has a story. Connect the evidence behind it.**

Explore the wildlife, water, landscape and planning records that help explain a place. Bring the sources together to reveal its character, understand change and see what needs a closer look.

Place two clearly visible routes near the top:

- **For businesses & places to visit:** Turn the nature around your business into a richer guest experience—with a local discovery guide, seasonal stories and your own QR signage. CTA: Explore the business experience -> /wild/partners.
- **For planners, ecologists & professional teams:** Bring environmental records and your own documents into a source-linked case. Compare findings, follow the chronology and prepare reports for review. CTA: Explore the professional workspace -> /professionals.

Keep the striking otter photograph; verify its actual source/licence and required credit/link obligations. Do not revert to the abstract hills/sun illustration. Preserve natural colours and a deliberate desktop/mobile crop. Move the venue-specific ecology-hub mock-up below the shared hero into the business section.

Introduce a concise "one place, two perspectives" River Nore example: businesses use local stories for discovery, while professionals inspect records, dates, locations and uncertainty. Do not imply that a guest guide is an ecological assessment or that unverified professional capabilities are complete.

## 2. Complete Kilkenny and Down

Each county must have:
- A distinctive introduction and at least six useful, carefully researched nature/landscape stories.
- A map linked to those stories, showing suitable public discovery context rather than sensitive species coordinates.
- Appropriately licensed photography and required attribution.
- Seasonal reasons to explore, source links, relevant dates and clear scope.
- Navigation between county, story and fictional example venue.

Research candidate subjects including the River Nore for Kilkenny and Strangford Lough, Lecale and the Mournes for Down. These are research directions, not verified claims. Read the actual supporting passages and verify geographic relationships, access and factual detail before publishing. Do not invent trails, guaranteed sightings or venue-level species presence.

Show the two counties in an Ireland-wide context. Distinguish published content, fictional venue examples and planned coverage. Explain the ambition to connect hundreds of businesses across Ireland and Britain as a plan, not an existing network or partner count. Preserve the user's exclusion of unsigned real businesses.

## 3. Repair county data and preserve useful content

Kilkenny: establish exact exclusion reasons, checking publisher, administrative matching, licensing, sensitivity rules and bounded sampling. Expose detailed reasons to maintainers. If eligible results lie beyond the initial sample, implement bounded retrieval with caching and honest coverage.

Down: investigate appropriate Northern Ireland sources and their licensing; do not reuse Republic-only mappings or describe an unconnected source as live.

Separate reviewed editorial stories from API-derived records. Missing API coverage must not remove valid reviewed county content. Never present editorial material as live API output.

Preserve privacy, licensing and ecological protections. Do not loosen valid eligibility checks merely to show non-zero results. Retain provenance, source scope, observation versus retrieval dates and uncertainty. Use dated last-verified material where appropriate during outages. Guest-facing copy should be plain language; diagnostics such as "API route" belong with maintainers.

## 4. Finish two example venue journeys

Create one polished fictional venue demonstration per county, labelled as such throughout. Each needs a coherent venue story, licensed imagery, three verified nearby discoveries, a useful map, a substantive seasonal feature, guest prompt, editable marketing-caption examples and a working QR destination.

Use obvious demo treatment for business website/booking links; do not create fake actionable bookings or claim a real business is a partner. Do not use Nicolas Mosse or another business's photographs without permission.

Preserve existing stable QR addresses. Public content must be approved; future drafts stay private. Do not add synthetic venues to real partner counts.

## 5. Make onboarding truthful and usable

Prefer completing and verifying #47's existing operating flow after configuration and migration readiness are established. Verify private draft persistence, photo validation/limits/storage, separate reviewer access, cross-account denial, exact-snapshot publication, stable QR, private future edits and unpublish/revocation.

If the full flow cannot pass the existing gates in this scope, ship an explicit managed-onboarding route. Replace unavailable "Create your ecology hub"/"Start with your draft" promises with a founding-partner demonstration enquiry. Remove claims of unavailable self-service or automation. Never leave the main CTA at a preparation notice.

Explain concrete setup and monthly deliverables. Include an internal estimate of founder setup time, recurring review/support, signage, storage/scanner/API costs and limits. Label unknowns and assumptions. No billing, new subscriptions or analytics platform is requested. Use existing privacy-conscious engagement metrics only if already feasible; do not promise bookings or invent measurements.

## Acceptance checklist

All boxes remain open until evidence is attached:

- [ ] Reconcile current Abacus work and identify exact implementation branch/full SHA.
- [ ] Shared homepage proposition with two prominent routes; otter image and licensing verified.
- [ ] Kilkenny: six sourced stories, useful map, seasonal content and demonstrated data/error behaviour.
- [ ] Down: six sourced stories, useful map, seasonal content and truthful source coverage.
- [ ] Two fully labelled fictional venue examples with verified nearby discoveries.
- [ ] Homepage -> offer -> county -> example -> story -> source is coherent.
- [ ] Actual downloaded QR bytes independently decode to the intended destination; redirect and public page work.
- [ ] Main onboarding CTA completes working setup or clearly explained managed enquiry.
- [ ] If enabled, two-account private/reviewer/public/photo/QR and stale-publication checks pass in staging.
- [ ] Enquiry success/failure/retry persistence and notification handling pass in isolated tests.
- [ ] Desktop and mobile screenshots, keyboard checks, map touch usability, image loading and broken-link checks recorded.
- [ ] Explicit TypeScript check, relevant regressions and actual hosting production build pass on the reported SHA.
- [ ] Source outages preserve useful, truthful content; empty results never imply wildlife absence.
- [ ] Costs, recurring service scope and unresolved operational items documented.
- [ ] Exact deployment receipt and live journey evidence attached before claiming live readiness.

Use isolated data for tests. A real test enquiry/email, production migration, publication or deployment requires the applicable existing release authority; this documentation PR grants none. A printed physical QR scan needs human evidence and must not be claimed from digital decoding alone.

## Delivery and stop rule

Add implementation commits or link the agreed implementation PR, with source/image attribution notes, screenshots, test commands/results, exact SHA and a five-minute business demonstration sequence. Record proposed, implemented, tested, merged, deployed and live-verified states separately.

Finish these two counties before broadening coverage. Do not mark marketing-ready while either county is empty, the featured example is placeholder content, or the primary CTA cannot fulfil its promise. Keep professional workspace behaviour and private records intact.
