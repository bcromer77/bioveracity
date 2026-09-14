# PR #47 — MVP operating service and release gates

Prepared 14 September 2026. This document supersedes the pasted showcase-only handover for the PR branch. It is not a claim about the currently deployed application.

## What the branch actually contains

PR #47 includes #46's seasonal ecology hub implementation and the honeycomb/API integration. Do not rebuild the four missing features from the older handover.

| Capability | PR implementation | Remaining operational work |
| --- | --- | --- |
| Venue onboarding | Sign-in and private self-service creation at /wild/studio; venue types include hotels, food, craft and community venues | Agree the pilot offer and verify the venue representative; no billing or automatic identity verification |
| Photos | Scanned, resized JPEGs stored durably in the existing Postgres database; private owner access | Apply migrations in staging and verify existing scanner credentials and database capacity |
| Editorial review | Owner submits an immutable version; current database administrators review at /admin/wild | Assign an existing authorised reviewer through the controlled administration process |
| Publication | Reviewer approves the exact submission; public page and stable QR then resolve; owner can unpublish | Staging browser and live-domain proof checks below |
| Enquiry handoff | Existing enquiry captures a lead and notifies founder; founder can share /wild/studio as the onboarding entry | Enquiry records are not automatically claimed by email, converted into accounts, marked paid or linked to hubs |

An enquiry is optional: a signed-in prospective venue can prepare a draft without buying anything. A founder can respond to an enquiry with the same sign-in/studio route; no invite system or new email service is required for the pilot. Sharing that route does not create a partner agreement.

## Review behaviour

1. Owner supplies profile, selected photos and all twelve monthly entries, then confirms authority and content approval.
2. Submit saves a separate immutable WildHubReview snapshot and increments the hub revision. Submission does not publish.
3. The review queue shows up to 20 current submissions per page. The reviewer can inspect every entry, selected image, image caption/credit and supplied Trends/source context. Photo access is authenticated, limited to the pending submission, and no-store.
4. Reviewer must record notes and confirm review, then approve/publish or return for changes. The review stores actor, time, decision and reason. Publication writes the existing hashed audit.
5. Saving edits, adding/removing photos, regenerating the plan or unpublishing changes the hub revision. A pending old version cannot then be approved or read through the review-photo route; the owner must resubmit. The last approved public edition stays unchanged until a replacement is approved.
6. Permissions are refreshed from User.role/User.accessState, using the central access policy. A venue owner cannot publish through the old publish action, forge a reviewer in a request, or review their own hub even if they are an administrator.
7. County API results update separately from venue editorial approval. Approval does not verify a species at the venue, certify environmental performance or endorse a business.
8. Previously published snapshots are retained. A legacy owner-approved snapshot is not retrospectively described as editorially reviewed. New submissions use this workflow.

The monthly feature advances automatically within the reviewed plan year on page requests. Preparation and data processing are automated; editorial judgement remains a deliberate step. Neither Google Trends live ingestion nor automatic social posting is claimed.

## Low-cost photo storage decision

**MVP choice: keep the existing Postgres storage.** No MongoDB migration, credit application or new cloud subscription is needed to exercise the implemented upload flow. This is not a claim of free database capacity: check the actual hosting plan, backups, traffic and scanner allowance before enabling it.

The existing limits are 12 images per hub, three hubs per account, 3 MB original JPEG/PNG upload, and at most 1.5 MB processed image. Processing removes original metadata and stores no original. At the maximum processed size:
- 20 hubs: 360 MB of photo bytes.
- 100 hubs: 1.8 GB.
These are sizing scenarios, not measured usage; database overhead, backups, replication and other application records are additional. The new administrator review screen displays actual photo count and total stored image bytes. This is a usage view, not a global spending cap. Start with a controlled pilot; per-account limits do not prevent unlimited new account creation.

**Growth option: private Cloudflare R2 Standard**, with image metadata/ownership staying in Postgres. Official pricing checked 14 September 2026: 10 GB-month storage, one million Class A and ten million Class B operations per month included; Standard storage above the allowance is $0.015/GB-month, with operation charges and billing-unit rounding. Internet egress from R2 is free. The 100-hub upper-bound example fits the storage allowance if no other objects consume it; this does not make the app, scanner or unlimited requests free.
Source: https://developers.cloudflare.com/r2/pricing/

R2 is a recommendation and is **not wired, provisioned or purchased in this PR**. A later adapter must keep the bucket private, serve images through the existing first-party authorised API, preserve hashes/IDs/credit and unpublish revocation, reconcile failed writes, and verify deletion/backup policies. Do not put public bucket URLs or presigned cloud URLs into venue pages. Move incrementally with a verified fallback; do not drop database bytes before checks.

MongoDB Atlas Free currently documents 0.5 GB total data storage and no managed backup enablement for that tier. Adding a second database solely for images would add migration and operation work. No MongoDB startup credit eligibility has been established.
Source: https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/

## Release checklist — record evidence rather than assuming completion

| Gate | What to record | Current status |
| --- | --- | --- |
| Exact source/deploy identity | Deployer receipt with full source SHA, build/deployment ID, target environment and UTC time; compare the checked-out source with PR head before release | Unverified: no Abacus deployment receipt in this turn |
| Schema readiness | In staging apply the existing 20260914_wild_hubs migration, then additive 20260914_wild_editorial_review; validate migration history and generate Prisma client | CI uses isolated PostgreSQL; no live migration |
| Feature configuration | WILD_HUBS_ENABLED (default off), WILD_PUBLIC_ORIGIN HTTPS origin and existing auth/database/scanner configuration in deployment environment | Live configuration not inspected |
| Reviewer access | Existing authorised admin account can load /admin/wild; regular venue account is denied and cannot review its own hub | Isolated service tests; live accounts not modified |
| Authenticated journey | Staging login, return to studio, create draft, upload, submit, reviewer approval, anonymous page/QR, draft edit, resubmit/reject, unpublish and photo revocation | Authenticated staging browser walk remains outstanding |
| QR bytes | Decode the actual downloaded SVG after rasterising; compare full URL with configured origin and venue ID | Added to CI with independent zbar decoder; CI result is the receipt |
| Live enquiry + notification | One explicitly authorised labelled release-test submission; record durable lead ID and founder notification receipt separately, including any delivery failure | Not performed; it writes live data and sends a real email |
| Visual/printed proof | 390px and 1440px layouts, image captions, review form; scan printed production QR | Not performed here |

The CI QR check calls the real download handler with fictional fixtures, converts its SVG bytes with sharp and independently decodes with zbarimg. It does not substitute the redirect Location header for a decoded QR. The QR target is a reserved .example test domain; no network visit or real email is involved. Locally: install zbar-tools and run WILD_QR_DECODE_TEST=true yarn test:wild-community. The CI workflow enables it explicitly.

The earlier b562dfe/local notes-only and c9c542f/origin claims came from the supplied handover. This turn has no access to that local checkout or a deploy tool to reconcile them. Do not manufacture or push system-managed checkpoint commits based on a pasted statement. PR #47's source head and CI run are the code review record; neither proves which commit is live.

## Deployment and rollback

No merge, deployment, real enquiry, notification, production data write or production migration is authorised by this PR update. Both new migrations need controlled staging validation. Do not assume the older "no schema change" handover applies.

Keep WILD_HUBS_ENABLED=false until the operating service gates pass. To roll back a rollout, disable that flag and revert application code through the existing deployment process while preserving new tables, photo bytes and customer records. The old cee886a checkpoint is a historical pre-integration reference; do not restore a whole database to that checkpoint after accepting new customer data.
