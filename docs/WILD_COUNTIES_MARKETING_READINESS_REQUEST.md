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

## 6. Mobile optimisation is a release requirement

Design for a guest arriving from a QR scan and a business owner reviewing the offer on a phone. A desktop layout squeezed into a small viewport is not sufficient.

### Layout and navigation

- Verify at 320, 360, 390 and 430 CSS-pixel widths, plus tablet and desktop. Test portrait and landscape. No page-level horizontal scrolling, clipped text, overlapping controls or inaccessible content.
- On mobile, put the shared proposition and both audience routes before the large hero photograph or venue mock-up. Use natural text wrapping, not desktop-only line breaks. Both routes must be easy to discover without navigating to the footer.
- Use a clear mobile menu with business, professional, county and account routes. Verify open/close, focus, Escape and return navigation. Sticky controls must not obscure content or keyboard-focused elements.
- Maintain readable body text (normally at least 16px) and comfortable spacing. Inputs should use at least 16px text. Support browser zoom and 200% text enlargement without losing content or actions.
- Primary buttons, menu controls, map controls and icon-only actions must have at least 44 by 44 CSS-pixel touch areas with adequate separation. No essential action may depend on hover.
- Preserve clear text contrast, visible keyboard focus, meaningful labels and reduced-motion preferences. Check the main menu, forms and discovery cards with a screen reader; report the browser/tool used and any remaining gaps.

### Photography, maps and discovery

- Supply responsive image sizes, reserve image dimensions to avoid layout movement, and choose a mobile crop that keeps the otter clearly visible. Keep credits legible.
- Prioritise the hero image and lazy-load below-the-fold media. Avoid serving full-resolution originals to small screens.
- Size maps for phones; markers, attribution and popups must remain usable. Panning must not trap normal page scrolling. Provide explicit zoom controls.
- Supply an equivalent discovery list so guests can reach every story without manipulating a map or waiting for map tiles. Retain this list if the map fails.
- Stack county and venue cards logically. Keep seasonal controls reachable and make selected states clear. Use wrapping or an accessible local scroller where necessary, never accidental whole-page overflow.

### Forms, sign-in and QR arrival

- Verify the complete enquiry journey with the on-screen keyboard open: appropriate email/URL keyboards, autofill, persistent labels, visible errors and a reachable submit button. Preserve entered values on errors and prevent duplicate submissions.
- Verify sign-in returns the visitor to the intended hub route. If hub creation is enabled, test draft saving/reopening, photo selection, upload progress/failure, twelve-month editing and submission on mobile. Unsupported image formats need a clear message; do not bypass scanning or validation for phone uploads.
- Guests opening a published QR link must reach the correct venue without an account or app installation. Check source links, back navigation, outbound business links and recovery from a slow or failed request.
- Respect device safe areas and changing browser/keyboard heights. Avoid rigid viewport heights that hide buttons or clip dialogs.

### Required evidence

- Test the homepage, /wild/partners, /professionals, /wild/kilkenny, /wild/down, both example venues, enquiry and the enabled studio journey.
- Attach 390px screenshots for each public route and 320px screenshots for the hero, open menu, map/list and enquiry form. Include interactive checks; screenshots alone do not establish usability.
- Test iOS Safari and Android Chrome on physical devices or an appropriate device service, recording device, browser version and tested commit. Desktop emulation is useful but must be labelled as emulation; missing device checks remain explicit release gaps.
- Run three cold-cache mobile performance checks on the homepage and each county/example page with the same documented throttling settings. Record median results. Set project lab targets of LCP <= 2.5 seconds and CLS <= 0.1; investigate misses, especially oversized images, map loading and blocking scripts. These are lab targets, not a claim about real-user performance or a guarantee of mobile quality.
- Verify a slow-network journey and an API/map failure without an endless spinner or loss of the reviewed story content.
- Fix reproducible mobile usability failures before marking the implementation ready for marketing. Report any unavailable device evidence separately; never substitute a desktop screenshot and call it a mobile pass.

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
- [ ] Section 6 mobile layout, touch, keyboard, screen-reader, form, map/list and QR journeys verified across the specified widths.
- [ ] iOS Safari and Android Chrome checks and mobile screenshots attached; real-device versus emulated evidence clearly identified.
- [ ] Mobile performance measurements and slow-network/error recovery recorded; remaining failures resolved or explicitly reported.
- [ ] Explicit TypeScript check, relevant regressions and actual hosting production build pass on the reported SHA.
- [ ] Source outages preserve useful, truthful content; empty results never imply wildlife absence.
- [ ] Costs, recurring service scope and unresolved operational items documented.
- [ ] Exact deployment receipt and live journey evidence attached before claiming live readiness.

Use isolated data for tests. A real test enquiry/email, production migration, publication or deployment requires the applicable existing release authority; this documentation PR grants none. A printed physical QR scan needs human evidence and must not be claimed from digital decoding alone.

## Delivery and stop rule

Add implementation commits or link the agreed implementation PR, with source/image attribution notes, screenshots, test commands/results, exact SHA and a five-minute business demonstration sequence. Record proposed, implemented, tested, merged, deployed and live-verified states separately.

Finish these two counties before broadening coverage. Do not mark marketing-ready while either county is empty, the featured example is placeholder content, or the primary CTA cannot fulfil its promise. Keep professional workspace behaviour and private records intact.
