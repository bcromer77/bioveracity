# Old Belvedere club pilot — implementation and host handover

22 September 2026. Scope: the agreed €80/month club pilot; telemetry is excluded.

This branch is stacked on PR74 (`fix/qa-personal-journeys`, parent `3c08ab229a2e4c76c9b8b17137951b8e700c017f`). It includes PR73/70/71/72 through that ancestry. Do not merge or cherry-pick those components separately. Codex owns the application changes; Abacus owns isolated hosting setup and deployment evidence. This document does not authorise a production deployment, real charge, customer email or migration against production.

## What the club receives

- Its existing reviewed venue page and permanent QR destination; print the QR only after checking the published destination on a phone.
- Guest photo contributions with private contact details, a versioned release, separate optional publication permissions, scanning, review, downloads and withdrawal.
- A bounded Dublin City Council planning watch plus an explicitly selected EPA waterbody assessment chronology. These are public-source records, not telemetry or a measurement of the club's environmental performance.
- One opt-in weekly venue email, now including up to ten newly approved source records and retrieval status alongside photo previews. Global and venue opt-outs still apply.
- Revolut-hosted €80 EUR monthly checkout, account status refresh, scheduled reconciliation and cancellation. Data-rights requests and existing records remain available after cancellation.

Routes: `/wild/studio` → selected venue → `/wild/studio/{hubId}/club`; `/admin/wild/launch` → `/admin/wild/clubs?hub={hubId}`. Public approved source cards appear on `/wild/places/{hubId}`. The QR uses the existing `/wild/q/{hubId}` route.

## What was established, and what was not

The attached Abacus PR74 transcript describes a temporary `next dev` server, not a persistent private QA deployment. It says application and evidence were placed in the same QA database; the vector migration was recorded as applied while its required vector column was omitted. Those are unresolved release blockers, even though some UI scenarios passed. The screenshots and hosted actions in that transcript are Abacus's claims, not independently repeated browser evidence here.

This change fixes the reproducible code causes for missing signup terms and legacy `?type=venue` intent. Signup now requires and records current terms even with `DATA_RIGHTS_ENABLED=false`; missing acceptance storage causes signup to fail closed. New Google signup cannot bypass acceptance. Account data controls render their unavailable/contact state when disabled. Sign-out uses a local destination after confirmation and reports a network failure instead of claiming success. Correct `NEXTAUTH_URL` is still a host requirement.

Local checks: isolated PGlite tests exercise the actual new SQL migration, tenant isolation, review/correction history, payment state transitions and weekly delivery claims. UI and API tests cover explicit signup/subscription acceptance and sign-out. TypeScript and an optimised Next build are checked separately. See the PR's final check results for its exact candidate SHA. These are not proof of a hosted sandbox payment or browser acceptance.

Read-only public API probes on 22 September 2026: the EPA adapter parsed six published assessment periods for `IE_EA_09D010900`. A smaller Dublin planning probe retrieved 62 records with source dates. A larger probe exceeded the 2,000-record cap and failed closed. Neither probe defines the customer's agreed map area or proves that this is the correct waterbody for the club. No source data was seeded into a customer database.

## Required business inputs

1. RippleXn's approved Revolut Business **Merchant** account and access to its Subscriptions API; a business bank account alone is insufficient. The authorised merchant administrator supplies sandbox/live credentials through the host's protected secret configuration, never chat or GitHub.
2. Confirm the legal billing entity, club billing contact, invoice/receipt requirements and whether the agreed €80 is the **total** monthly charge. This implementation charges exactly 8,000 EUR cents. Tax registration/treatment is not inferred. Do not label it “€80 plus VAT” and charge €80, or increase the charge without a revised agreement.
3. A club-authorised owner account and approved page content/logo, plus the agreed WGS84 map rectangle and EPA waterbody code. Do not invent a location from the club name, county or an unconfirmed Eircode. The admin configuration records the confirmed scope.
4. A named source/photo reviewer and deputy, privacy operator/deputy, and monitored support/operations mailbox. These may be delegated; source approval remains human work.

At €80/month the annual contracted run rate is €960 before tax treatment, fees, hosting, scanning, storage, email and support. Actual collection, processor fees, operating costs and review minutes remain unknown. Capture first-month setup time separately from recurring minutes before projecting margin or scale. Hardware and telemetry are not promised.

## Abacus setup sequence — isolated QA first

1. Read this document, `AGENTS.md`, `PRODUCTION_READINESS_HANDOVER.md` and `TERMS_AND_DATA_RIGHTS.md` at the new PR's exact SHA. Preserve PR73 and PR74; keep the new PR draft. Wait for current checks on the exact commit.
2. Establish a persistent private QA URL with separate application/evidence databases and separate private storage. `3e9a3890e_preview` serves production and is forbidden for QA mutations. Provide host-side proof of deployed SHA and isolation without disclosing secrets.
3. Inspect actual schema and migration history. Resolve the historical Ellona cross-database dependency and pgvector requirements before release. Do not reuse the transcript's skipped-schema “applied” state, reset a database, blindly replay migrations or place evidence tables into the application database as a workaround. Generate separate Prisma clients for the intended schemas. This branch adds only `20260929_club_launch` to the **application** database; it does not repair the historical topology.
4. Use `ops/club-launch.env.example` as a template. Align `APP_BASE_URL`, `NEXTAUTH_URL`, `WILD_PUBLIC_ORIGIN`, authentication secrets and the actual QA host. Enable data rights, verification, admin second step and real scanning on QA. Confirm synthetic accounts and controlled recipient enforcement before any email test.
5. Configure a **sandbox** Revolut plan with one indefinite monthly phase, amount 8000, currency EUR, no trial, no usage items or future phases. Record its plan and variation IDs in secrets/configuration. The app verifies these values before checkout. No merchant account or plan was created during this code change.
6. Register the four subscription events at `/api/billing/revolut/webhook` and store the signing secret privately: `SUBSCRIPTION_INITIATED`, `SUBSCRIPTION_FINISHED`, `SUBSCRIPTION_CANCELLED`, `SUBSCRIPTION_OVERDUE`. Signature validation uses the untouched body, timestamp in milliseconds, five-minute tolerance and constant-time HMAC comparison. The endpoint durably stores a receipt and returns 204; scheduled reconciliation fetches authoritative provider state.
7. Use the launch desk to prepare a synthetic club and email-bound owner claim. A different administrator confirms its test scope on the club review page. Complete sandbox checkout; verify the first **completed** EUR 80 order and cycle, not merely an `active` subscription or a successful redirect.
8. Run `yarn billing:reconcile` with its QA flag; schedule every 15 minutes only in the isolated QA environment. Run `yarn club:sources` daily after payment confirmation. Both jobs record heartbeats. The existing weekly sender remains `yarn photos:weekly`; enable it only for controlled QA recipients. The crontab file is a template, not evidence of installed schedules. Monitor `/api/ops/status` with its protected bearer token and prove an alert reaches the operator/deputy.
9. Review imported source cards in the admin club page. Corrections create new immutable rows and immediately remove the superseded version from the public current view until the new version is approved. No source or photo approval is removed to improve an automation score.

## Payment behaviour and exception handling

- Customer/subscription creation has a durable per-club claim. Subscription creation also uses a persisted UUID idempotency key. A second click resumes the same pending order. There is no automatic customer-create retry: a lost response could otherwise create a duplicate. A crash or uncertain response is shown as needing reconciliation.
- Revolut does **not** emit a subscription activation webhook. Return-page polling and the scheduled worker fetch current subscription/cycle/order state. `active` alone is not proof of cash received. Only a completed matching EUR 80 cycle order establishes the paid service period.
- Provider timestamps and local revisions reject stale updates. Signed events do not themselves grant access. Customer, local external reference, plan and variation must match the stored subscription. Foreign owners cannot read, refresh, pay for or cancel another club's plan.
- Cancellation calls the provider only after the owner types `CANCEL SUBSCRIPTION`. It stops future cycles and pending orders. Paid source-watch service continues through the established paid period. It does not delete photos, revoke third-party rights, unpublish the venue or erase the account. Existing free headline records and data controls remain available.
- For `CREATING`/`UNKNOWN`, inspect the local private row and Revolut's customer/subscription records by the stored external reference and creation time. Establish whether the provider accepted the first operation. Never delete the claim, re-click with a new ID or paste secrets into a ticket to “try again”. Escalate for a reviewed recovery fix if identity cannot be established. Re-subscription after cancellation, card replacement, refunds, disputes and invoices require the merchant's support process for this pilot; they are not presented as implemented customer portal features.
- Do not switch provider for an existing active Stripe customer as a migration shortcut. Existing Stripe code is retained; the club checkout rejects competing billing state. QA must verify that the production merchant has no affected active Stripe subscriptions before changing a deployment-wide provider.

## Browser acceptance checklist

Use two unrelated synthetic venue owners, another administrator and a guest; record routes, screenshots, expected/actual behaviour and PASS/FAIL/BLOCKED per step. Count customer self-service separately from software automation. Administrator simulation counts as operator work. Include failed/blocked steps in the denominator and measure actual hands-on minutes; do not infer them from unit tests.

1. `/signup?type=venue` opens venue intent. Terms start unticked. POST without current acceptance fails with controls enabled or disabled. Complete controlled verification, sign in to the personal venue destination, recover a password and test admin codes. Sign out stays on the active QA origin.
2. Claim/setup the synthetic venue, approve its content with a different administrator, publish, download the QR SVG, independently decode it, then scan it on desktop/mobile. Unpublishing makes the QR destination unavailable.
3. Guest first/repeat contribution: contact private, scanning required, release recorded, optional future-publication permissions independent, private moderation, owner submission, independent editorial approval, public image, download, permission withdrawal and disappearance from the public page. Do not infer erasure from an acknowledgement.
4. Configure a confirmed source area. A non-admin/other owner cannot configure it. Retrieve both sources, inspect original supporting records and dates, approve selected cards, inspect public chronology and mobile layout. Check unchanged retrieval, corrected decision, changed bounds, absent geometry, source outage, capped pagination and overdue check. “No reviewed records” must not imply no environmental change.
5. Sandbox €80 monthly checkout: unticked recurring confirmation, verified email, correct club/merchant/currency/cadence/tax wording, hosted payment, first completed order, repeated clicks, abandoned checkout, delayed activation and no-webhook polling. Neither URL query parameters nor a forged/stale webhook may grant paid service.
6. Global/venue opt-out suppresses weekly delivery. Send a controlled weekly email with approved source records and private photo previews; repeat the job without duplicate delivery. A simulated ambiguous provider response stays UNKNOWN and alerts an operator.
7. Owner B cannot access owner A's club, source controls, photo originals, checkout, refresh, cancellation or exports. Confirm previously tested professional collaboration revocation still protects original and report routes; an old invitation must not restore revoked access. A fresh deliberate owner invitation is a new grant, not an old-token replay.
8. Cancel the sandbox subscription, verify provider state and no next renewal, preserve paid-period access and records, then test account download, full access request, unpublication and deletion request with an operator's actual fulfilment evidence. A limited JSON download or queued request is not full access/erasure fulfilment.

Return the stable private QA URL, exact SHA, isolation evidence, secure account access route, current results/screenshots, defects, recurring operator workload and verified rollback route. Do not report production ready until these hosted gates pass. Seasonal automation, professional processing/vector dependencies and any unsupported payment support flow remain explicit blockers where applicable.

## Rollback and data inventory

The host must identify its actual deployment/rollback mechanism before release; a `next dev` process is not a release mechanism. For QA rollback, disable club source refresh, weekly delivery and new checkouts; restore the known compatible prior app SHA while keeping the additive tables and existing records. Never drop tables or restore an old database over current data as routine code rollback. Disabling app billing does **not** cancel provider subscriptions. Reconcile/cancel synthetic sandbox subscriptions in Revolut as an explicit QA cleanup step and preserve required payment history. A live billing rollback requires a separate plan to maintain cancellation/reconciliation or handle each active subscription before taking those routes away.

New personal-data records: `ClubSubscription` stores owner, provider references, accepted terms version/tax wording, fixed amount, timestamps and payment state; `RevolutReceipt` stores event identifiers and processing timestamps, not payment-card data; `ClubWatch` stores the configuring operator; `ClubSourceRecord` stores reviewer identity/notes and public source metadata. Add these to access/retention/erasure fulfilment inventories. Instant account JSON remains a limited export; full requests still require operator fulfilment and justified retention handling.

## Primary API references checked 22 September 2026

- [Revolut subscriptions setup](https://developer.revolut.com/docs/guides/merchant/billing-subscriptions/api/get-started)
- [Subscription webhooks and activation limitation](https://developer.revolut.com/docs/guides/merchant/billing-subscriptions/api/webhooks)
- [Merchant API contracts, version 2026-08-17](https://developer.revolut.com/docs/api/merchant)
- [Webhook signature verification](https://developer.revolut.com/docs/guides/merchant/monitor-and-observe/webhooks/verify-the-payload-signature)
- [EPA WFD API and licence](https://data.epa.ie/api-list/wfd-open-data/)
- [National planning source schema](https://services.arcgis.com/NzlPQPKn5QF9v2US/arcgis/rest/services/IrishPlanningApplications/FeatureServer/0?f=pjson)
- [Dublin City Council planning catalogue](https://data.smartdublin.ie/en/dataset/dublin-city-council-planning-applications) — context, not a claim of a second independent feed.
