# Wild Counties partner preview — bounded implementation slice

## Objective

Make the existing WildHub flow good enough to put in front of one real prospective founding partner.

The commercial test is deliberately simple:

> Can a partner sign in, add their real place and photographs, see a beautiful Wild Counties visitor page taking shape, send it for review, and want the plaque outside their venue?

This is not a new product build. Extend the existing WildHub architecture already merged into `clarity/usability-release`.

## Base receipt

This branch was cut from `clarity/usability-release` at `89009e067240e492a0840ac78275547292bcd2f7` after PR #52. PR #47's WildHub/review architecture is already in this lineage.

Existing assets to preserve and reuse include:

- `/wild/studio`
- WildHub profile, photos, plan and publication snapshot
- existing photo upload/storage/scanning path
- existing owner isolation and revision controls
- existing editorial review and `/admin/wild`
- existing `/wild/places/[id]` published route
- existing stable QR route
- `WILD_HUBS_ENABLED`
- `WILD_PUBLIC_ORIGIN`

Do not create a second Partner Workspace, Place table, review system, publication system, object store or QR system.

## Principal implementation objective

Turn the current seasonal-content studio into a place-first partner studio without breaking the seasonal planner underneath it.

The first screen should feel like creating a Wild Counties page, not operating environmental software.

Primary flow:

1. Your place
2. Your story
3. Your photos
4. Plan a visit
5. Nature around you
6. Preview my page
7. Send for review

The existing twelve-month plan remains available as a secondary **Seasonal plan** section. It must not dominate first-run onboarding.

## Required implementation

### 1. Humanise the studio

Keep the existing APIs and safeguards. Change the presentation and hierarchy.

Use plain British English. Avoid internal terms such as `hub`, `revision`, `publication snapshot`, `API`, `eligible records`, `source processing` and `profile JSON` in partner-facing copy.

Preferred partner-facing language:

- `Your Wild Counties page`
- `Your place`
- `Preview my page`
- `Seasonal plan`
- `Send for review`
- `Published`
- `Changes requested`

Do not expose Nicolas Mosse, Ben Mosse or any other prospective partner as fixture/test data or on a public marketing page.

### 2. Add only the minimum place fields needed for a useful visitor page

Inspect the current profile persistence before changing schema. Prefer an additive extension of the existing WildHub profile representation over a parallel model.

Useful optional fields are:

- locality/address display text
- visit/shop/booking URL
- short visit prompt
- place-and-nature story
- up to three nearby recommendations supplied by the venue

Keep provenance explicit: venue-supplied recommendations and claims are venue content. They are not BioVeracity-verified ecological evidence.

If implementing these fields requires a destructive migration or replacement of existing production architecture, stop and document the conflict instead.

### 3. Real draft preview

This is the highest-priority code change.

Add **Preview my page** from the studio. It must render the owner's current saved draft as the visitor will experience it, not merely show the twelve-month campaign preview.

Preview requirements:

- authenticated owner/admin only;
- `noindex, nofollow`;
- not discoverable from `/wild` or county directories;
- reuse the same visitor-page rendering component(s) as publication so preview cannot drift into a separate design;
- show current draft photos and current saved profile;
- clearly but quietly label it as a private preview;
- never require the draft to be publicly published.

Refactor `PublishedHub` into a shared renderer if that is the smallest safe way to achieve preview/public parity.

### 4. Visitor page hierarchy

The visitor page should feel editorial and place-led, consistent with the existing green/cream/gold Wild Counties design.

Target hierarchy:

- Wild County / locality
- venue/place name
- one-line invitation
- hero photography
- the story of the place
- visit/shop/book action when supplied
- seasonal discovery when available
- nature around the place
- source-linked ecology where already safely available
- nearby venue-supplied recommendations, clearly identified as such
- BioVeracity provenance/caveat layer kept calm and readable

Do not claim that a designation is a sighting, that nearby evidence occurred at the venue, that participation is certification, or that payment buys ecological credibility.

### 5. Ecology is not the release blocker

Reuse existing `CountyNature` or another existing safe public query if it already provides appropriate source-linked context for the selected county/place.

Do **not** build a new ecology ingestion, H3, GBIF, Natural England, BNG or evidence-retrieval system for this slice.

If safe place-level attachment is not already available, show an honest empty state such as:

> We're connecting source-linked information about the landscape and wildlife around your place.

This release succeeds without automated place-level ecology matching.

### 6. Plaque preview, not plaque fulfilment

Add a simple digital plaque preview within the partner studio/review experience using the existing WildHub ID and QR architecture.

It should communicate the intended physical experience: Wild County identity, place name and QR entry point.

It is a preview only. Do not add manufacturing, ordering, payment, fulfilment or environmental-award language.

### 7. Preserve review and publication integrity

Reuse the existing review system.

Required behaviour remains:

- owner edits remain private;
- owner sends a saved version for review;
- administrator reviews the same visitor-page representation;
- approval publishes the reviewed snapshot;
- return-for-changes remains private;
- editing after publication must not silently change the live edition;
- owner cannot self-approve;
- existing published page remains available until a replacement is approved or it is explicitly unpublished.

## Explicitly out of scope

Do not use this PR for:

- homepage redesign;
- public pricing;
- payment/billing;
- Ask/chatbot changes;
- professional workspace changes;
- Natural England or BNG schema/UI;
- new ecology ingestion or vector work;
- Google Trends redesign;
- multi-venue enterprise administration;
- physical plaque manufacture;
- new storage provider;
- broad Cambridgeshire/Irish data expansion;
- 1,000-venue scaling architecture.

## Acceptance test

A release candidate is not complete until the following is demonstrated in staging or an equivalent authenticated environment:

1. New partner signs in and creates/opens their Wild Counties page.
2. They enter place/story/visit information and save it.
3. They upload at least two real test photographs through the existing safe upload path.
4. Logout/login preserves the saved content and photographs.
5. **Preview my page** shows the current saved draft using the same visitor renderer as publication.
6. Preview is private and noindex.
7. Seasonal planning remains available but is secondary.
8. Owner sends the saved version for review.
9. Admin sees the same visitor-page representation and can approve or return it.
10. Approval creates/updates the published `/wild/places/[id]` edition.
11. QR resolves to the correct stable public route when `WILD_PUBLIC_ORIGIN` is configured.
12. Subsequent owner edits do not silently alter the approved live edition.
13. Cross-account access and self-approval remain blocked.
14. Existing Wild Counties, evidence and Ellona behaviour is not regressed.

## Verification expected in the PR

Run the repository's existing WildHub/review tests, TypeScript check and production build. Add focused tests for preview access, preview/public renderer parity at the data boundary, persistence of any new profile fields, and preservation of the immutable publication behaviour.

Do not claim production readiness from component tests alone. Record any database-, scanner-, auth- or host-dependent gates separately.

## Abacus handoff after this PR

Abacus should receive an integration/deployment instruction only after the code PR is reviewed:

> Integrate the approved Wild partner-preview PR into the current BioVeracity Abacus application without rebuilding the WildHub architecture. Preserve the current database, authentication, scanner and existing production configuration. Apply only the additive migrations actually present in the approved PR. Verify `WILD_PUBLIC_ORIGIN` and enable `WILD_HUBS_ENABLED` for the authorised pilot. Test sign in → edit place → upload photos → logout/login persistence → Preview my page → Send for review → admin preview → approve → published page → QR. Do not redesign or add features. Report the exact deployed SHA, migration receipt, feature-flag state and any environment-specific failures.

## Stop condition

If the current Abacus checkout differs materially from this Git lineage, do not overwrite it. Compare the deployed/current host SHA with this branch, reconcile newer host changes, and report the conflict before deployment.
