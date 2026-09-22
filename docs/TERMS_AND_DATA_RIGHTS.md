# PR72 — terms, data rights and contributor releases

## Delivery and base

Stack on PR71 `feat/venue-seasonal-discovery` at d9e9b51dd58d89885eb176910c68383ff4d65646. Its tree d64a8248d8ac6a574e0f21f29e3f234a37a5847d matches the starting checkout. Preserve PR70/71. Abacus remains deployment owner. No production changes or communications are authorised by this document.

## Customer experience

- Signup: an unticked required checkbox links terms/privacy. Server rejects absent/stale acceptance when DATA_RIGHTS_ENABLED=true. Account creation and acceptance (server time, wording, versions and full legal texts) commit atomically. Required contractual acceptance is not optional GDPR marketing consent.
- Google: existing accounts retain sign-in; new Google account creation redirects to credential signup while the terms gate is enabled. This prevents direct OAuth bypass; a future OAuth acceptance handshake is separate work.
- Existing users can explicitly accept the new version from Account; acceptance is never backdated. Rights requests remain available without acceptance or paid entitlement.
- Account: limited instant JSON download (clearly scoped), six kinds of full rights request, calendar-month due date, durable receipts and responses. Erasure requires typed confirmation. The button submits a request; it does not claim deletion happened.
- Owners can take venue pages offline with an owner-scoped action that invalidates pending editorial reviews. This control does not delete records or cancel payment; republishing uses the studio approval workflow. Existing notification toggles remain in Account.
- Cancellation does not transfer copyright, erase records or infer promotional permission. Do not conflate ownership of third-party photos with the venue’s service licence. Public facts, source/database rights, customer content and personal-data rights have distinct treatment.

## Contributor release

Account-free guest photo uploads require private contact name/email, adult/authority declarations, acceptance of the versioned release and the existing service/scanner choices. Public credit may be a pseudonym. Venue and BioVeracity future-publication choices are separate, optional and unticked. Contact details are not a marketing list and must not be disclosed to venue owners through ordinary exports.

The separate VenuePhotoRelease records the processed-photo ID, venue name, full wording, scope choices and server acceptance time. Ordinary feeds, image metadata exports and digest previews do not select contact columns. Existing photos receive no retroactive future-publication grant. New owner-gallery uploads also require private contacts and the same release, atomically saved with the photograph. Account downloads include their release records and offer owner-scoped future-use withdrawal. Older gallery uploads receive no new licence; obtain a fresh documented release before any broader use.

The private receipt token remains in a URL fragment. It authorises downloading the private release and withdrawing future-use permission separately from removing the photograph. Treat the complete receipt as a secret. Contact is self-declared, not email-verified automatically. Before future publication an administrator must independently verify contact AND authority, record evidence, obtain editorial approval and check the precise use through the clearance endpoint. Neither a checkbox nor an email address proves copyright ownership. Permissions are revocable prospectively; downloaded/printed copies require operational recipient handling. Do not promise global recall.

`/admin/data-rights` includes restricted contributor contacts, verification and current-use clearance downloads. Every new publication must recheck permissions immediately before use; a previous clearance is not evergreen. Verification does not send email and must never be marked merely because an address looks valid. Record the publication edition, recipient/processor and release reference in the controlled publication register; that external publication/recall operation is not automated here.

## Operator workflow (required before activation)

Assign a named accountable privacy operator and deputy; review `/admin/data-rights` daily. The queue is not an automatic email alert. No automatic deletion worker or complete subject-access export worker is claimed.

1. Acknowledge requests and proportionately verify identity. Avoid collecting identity documents routinely. Requests through Contact, email or other valid channels also count and must be recorded in the operating register; the web form is not mandatory.
2. Determine controller/processor responsibility and scope. Search account records, workspaces/cases, encrypted documents, reviews/exports, observation/attention records, venue/gallery/journal/release content, billing, email/scanner providers, logs and backups. Do not dump colleagues’ or guests’ data. A portable copy and an access response have different scope. Use authenticated or appropriately secured delivery; never paste personal data into GitHub or public issues.
3. For erasure, reconcile active billing separately; determine lawful exceptions individually. Execute approved deletion/anonymisation across applicable stores, derivatives, recipients and backups. Preserve the minimum justified audit evidence, with a documented review/deletion date. This schema intentionally prevents blind account deletion while rights/audit records reference it. A reviewed erasure operation must detach or minimise those references and records as justified; do not treat the foreign keys as an exemption. Test restoration suppression and revoke sessions (authVersion) when closing an account.
4. Provide the outcome and any retained categories, legal grounds and period/criteria, recipients and complaint rights. Complete within the applicable period. Extensions require a lawful reason and notice within the initial month; record it in the response and operating register. The UI keeps the original due date and does not silently reset deadlines.
5. Record IN_REVIEW then COMPLETED/PARTIALLY_COMPLETED/REFUSED only after actual work. Completion requires affirmative operator attestation. Responses appear in Account but are not emailed automatically: deliver/notify securely through the agreed channel. Final status cannot be silently overwritten. Retention and request fulfilment remain operational responsibilities, not a compliance certification by the code.

## Release gates

- Apply additive `20260924_data_rights` only after the actual hosted schema/history has been reconciled and snapshotted. Requires User, WildHub, WildHubReview, AttentionPreference, VenuePhoto and their earlier migrations. The known clean-chain blocker from PR67 is not repaired by this PR.
- Keep DATA_RIGHTS_ENABLED=false until signup, account controls, admin operations and legal text are accepted. The photo release is part of both gallery and journal write paths; migrate before deploying this journal code, and keep WILD_PHOTO_JOURNAL_ENABLED false until hosted acceptance. Rolling back should disable features and restore the previous app without dropping new rights records.
- Have UK/Irish technology/privacy counsel review these proposed terms and release. Before activation, verify the exact contracting entity/legal name, registered address/contact, controller roles, processor/subprocessor and international-transfer disclosures, retention schedule and backups, DPA, billing/cancellation and any applicable consumer terms. The notice currently describes categories, not a verified provider/location inventory. These omissions are release blockers, not permission to insert invented facts.
- Confirm actual Abacus project URL, deployment route, production build, snapshot and rollback; test real hosted signup, no-OAuth-bypass, download, cross-account denial, offline venue, contributor receipt, withdrawal and admin workflow on mobile. No production migration, feature activation, contact verification, mail send, deletion or deployment performed here.

## Research (22 September 2026)

- ICO: consent separate from contractual terms, granular positive choices and evidence: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/consent/
- Irish DPC: access versus portability, response time and other people’s rights: https://www.dataprotection.ie/en/organisations/know-your-obligations/access-and-portability
- Irish DPC: erasure grounds/exceptions and recipient handling: https://www.dataprotection.ie/en/individuals/know-your-rights/right-erasure-articles-17-19-gdpr
- Tripadvisor official terms (effective 15 July 2025), licence and restricted-licence sections: https://tripadvisor.mediaroom.com/us-terms-of-use . Its broad licence and restricted alternative informed the comparison; no Tripadvisor wording has been copied into the release. BioVeracity uses purpose-specific opt-ins instead.

## Verification on this draft

- 19 isolated PGlite/domain/service tests pass (data rights, journal and owner gallery), using the checked-in additive migrations. Suites run sequentially because running all three PGlite workers concurrently exceeded the sandbox Node heap.
- 13 UI interaction tests pass (2 new signup/data-panel checks plus 11 venue journal/studio checks).
- Full application TypeScript check passes using an isolated generated Prisma client and a temporary explicit module mapping. The shared cached runtime’s old generated client lacked authVersion; production source was not weakened to conceal that mismatch.
- Prisma schema validation passes with a dummy local connection string; no database connection/migration was performed by validation.
- Actual Next.js 16.3.3 Turbopack production build now passes with the repository’s CI lockfile after bundling the existing fonts locally. The initial Google Fonts download blocker is resolved. The pre-existing parser.ts:58 tracing warning remains. Abacus hosted acceptance and browser/mobile QA remain outstanding.
- git diff --check passes. No real emails, uploads, contact verification, billing changes, deletion or deployment performed.

## Font build follow-through

The root layout now uses app/fonts.css and 12 unchanged, locally served WOFF2 files under public/fonts/web, with their family OFL licences and checksum manifest. DM Sans, Plus Jakarta Sans and JetBrains Mono retain the prior weight ranges, character subsets, swap display, Latin preloads and fallback metrics. No Google font request is needed by the build or browser. Existing PDF fonts are unchanged.

Verified: production Turbopack build exit 0; separate full TypeScript check exit 0; built /terms route returns 200; all 12 served font files match their manifest checksums; rendered HTML/CSS contain the three families and local preloads without Google font-server references. The tests used a local production server and synthetic environment only. No deployment or production configuration changes.
