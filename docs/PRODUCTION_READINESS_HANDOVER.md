# Production readiness handover

This change is code and isolated verification, not production deployment or compliance certification. PR 72 remains stacked on the seasonal/photo/navigation work. Deploy an exact reviewed SHA through the confirmed Abacus route. Do not enable unattended deployment.

## Implemented

- Managed internal links, including photo views and account downloads; existing navigation test preserved.
- Explicit TypeScript enforcement in Next production builds and CI. Portable Prisma generator output.
- Database-backed login/email and signup/IP limits; bounded password input. Forwarded IPs are trusted only with `AUTH_TRUST_PROXY_IP=true` after the host confirms header replacement. Otherwise requests share a conservative limit. Password-reset limits continue to operate.
- Email ownership verification: hashed, expiring, single-use token, no token in server URLs, explicit confirmation POST (email link scanners cannot consume it), generic resend response. `AUTH_REQUIRE_VERIFIED_EMAIL=true` gates credential sign-in and existing sessions. Enable only after delivery/recovery rehearsal; existing unverified users must verify rather than being silently marked verified.
- Administrator email second step: password required to request a code, 10-minute expiry, user/purpose/version binding, one-use consumption. `AUTH_ADMIN_EMAIL_STEP_UP=true` also invalidates pre-existing administrator sessions and prevents Google OAuth bypass. An account promoted to admin must sign in again. This is an email possession step, not phishing-resistant passkey MFA. Admins without a password must use password recovery/controlled account recovery first; do not enable until tested.
- Session roles/access are refreshed from the database. Demotion does not wait for JWT expiry.
- Ask requires both feature gates, a signed-in account, 8 KiB request/2,000-character question limits, at most 30 assets/40,000 context characters, 10 calls/user/hour, 100 calls/deployment/day and a 45-second provider timeout. Responses do not expose upstream errors. Leave disabled if not part of the launch. Fixed-window limits are request caps, not a currency budget; set provider spending alerts too.
- Daily private-request summaries to configured operator and deputy; response notices link users to their authenticated Account page. No request details are mailed. Durable claims suppress duplicate delivery; ambiguous delivery needs operator inspection, never blind retry.
- Weekly digest/daily privacy job heartbeats; authenticated `/api/ops/status` reports missed/failed jobs, ambiguous deliveries and overdue requests without names or addresses. Database failure returns 503. A separate monitor must poll this endpoint; an app cannot reliably notify you of its own total outage.
- Disabled Abacus notifications are delivery failure, not success. Stripe requests have a timeout and reject an explicitly unsupported billing provider. Revolut is not integrated.
- Read-only readiness/configuration check, migration plan/reconciliation guard, isolated restore helper and acceptance procedure.

## Release commands and boundaries

Run from `nextjs_space` with the host's protected environment; never paste URLs, keys, backups, private mail or downloaded data into GitHub.

1. `yarn prisma generate`, `yarn typecheck`, the full CI workflow, and `yarn build` on the exact release SHA.
2. `yarn db:release` prints the application migration plan and checksums without connecting. `yarn db:release --evidence` prints the separate evidence plan. Historical SQL files/checksums are preserved; workspace foundation is ordered before private case files.
3. Existing blocker: `20260915_ellona_opportunity_watch` has an application-side foreign key to `EvidenceDocument`; production `evidenceDb()` requires a separate database. Inspect actual table locations, constraints and `_prisma_migrations`. Do not apply evidence migrations to the application database or mark missing schema applied to bypass this. The application release helper stops if this dependency is absent. An existing schema without reconciled history, checksum mismatch or unresolved failed migration also stops.
4. Only after reconciliation/backup/target review, the host may set `RELEASE_DATABASE_URL` and `DATABASE_RELEASE_ACK=REVIEWED_BACKUP_AND_TARGET`, then run `yarn db:release --apply` for the intended target. The helper uses psql, advisory locking and one transaction, records original checksums, and suppresses database output. It does not replace the Abacus schema packaging route without host confirmation. New migration: `20260925_production_readiness`.
5. Enable identity gates only after correct email delivery is proved. Configure a primary privacy operator, deputy and monitored mailbox. Confirm proxy-header behaviour. `yarn ops:check` checks configuration names without printing values; passing is not hosted acceptance.
6. Install `ops/production-readiness.crontab.example` via the confirmed host scheduler. Jobs remain disabled by default. Monitor `/api/ops/status` with the bearer token from outside the application, and route failures to primary plus deputy. Confirm the monitor actually alerts when the endpoint fails and when a job is overdue. Do not confuse a crontab template with an installed schedule.
7. Observe and privately resolve UNKNOWN delivery records using provider evidence. Do not erase claim rows just to rerun. Stale RUNNING heartbeats require verification that the original worker has stopped before operator reset. Health warnings remain until resolved. Keep a restricted operational incident record.

## Restore rehearsal

Host owner: obtain a fresh encrypted database archive, uploaded/object-store inventory and encryption-key recovery material through existing backup controls. Agree backup frequency and maximum tolerable data loss/downtime. Record actual restore duration and missing data; do not invent an RPO/RTO.

- Provision an empty isolated PostgreSQL database with required extensions and restricted access. Install matching PostgreSQL client utilities.
- Set `RESTORE_DATABASE_URL` to it and `RESTORE_REHEARSAL_ACK=ISOLATED_EMPTY_DATABASE`.
- Run `node --import tsx scripts/restore-rehearsal.ts /protected/path/backup.dump`. The helper refuses a nonempty target or the configured application/evidence database identity; do not use alternate host aliases to bypass the guard. No production backup is created by this command.
- Verify record counts and representative relationships; restore media separately if stored outside PostgreSQL. Recover encryption keys independently and open a known private document through the isolated app. Confirm both tenants' access boundaries and export readability. Restoring SQL alone does not prove media/key recovery.
- Disconnect email, billing, scheduled jobs and outbound processing in the restored environment. No real customer messages or charges. Destroy rehearsal data through the agreed retention process after recording non-sensitive evidence.
- Rollback: preserve additive schema and data, disable newly enabled flags and restore prior application SHA if compatible. Never drop new tables or restore an old database over current production as a routine code rollback.

## Privacy fulfilment and publications

Name the primary and deputy before activation. The queue still needs a human to investigate, assemble full responses, redact others' data, apply justified retention and complete deletion safely. The limited account JSON remains accurately labelled. There is deliberately no blind cascade-delete button.

For each request, record identity verification, systems/providers searched, scope, third-party redactions, retained categories and grounds, delivery method, actual completion and reviewer. Include backups and recipients in the procedure. Practise a synthetic full-access and erasure case end to end. The admin status change records the outcome; it does not do the underlying work.

Keep contributor contacts private. Verify identity/authority before future publication and recheck current permission immediately before use. Maintain a restricted publication register: release/photo reference, venue, permitted publisher, verification evidence, edition/date, recipient, withdrawal received, future use stopped and any recipient follow-up. Venue cancellation transfers no contributor copyright. Separate subscription end, public-page removal and data erasure.

Bazil/company adviser must confirm exact contracting legal entity/address/contact, controller/processor roles, processor and transfer inventory, retention periods, DPA and cancellation wording. The code does not substitute guessed particulars or claim legal approval.

## Hosted acceptance — two independent synthetic tenants

Record SHA, environment, date, operator and result for each step. Do not use real personal data or live payment cards.

| Journey | Expected evidence |
| --- | --- |
| Signup and verification | Unticked current terms required; acceptance saved; unverified sign-in denied; correct email arrives; explicit confirmation works once; resend/expired links work safely. |
| Recovery and administration | Reset revokes old sessions/codes; administrator password alone fails; emailed code works once; wrong user/code fails; old session and Google cannot bypass admin step; demotion takes effect. |
| Abuse | Repeated login/signup/resend becomes limited across server instances; client-supplied forwarding headers cannot bypass the host configuration. |
| Venue contributions | Private contact/release saved, independent optional permissions; malicious/oversized uploads rejected; moderation required; no private contacts in public feeds or ordinary exports. |
| Tenant separation | Account B cannot read/change A's cases, documents, photos, download endpoints, releases or requests by changing IDs; repeat after revocation. |
| Subscription | Chosen supported provider's test checkout, active subscription, failed renewal, cancel-at-period-end and final cancellation; replay webhook without double changes; out-of-order event; verify Account/data requests still work. |
| Publication | Publish, withdraw future use, check clearance denial, unpublish and confirm pending editorial approval cannot republish; payment cancellation does not perform deletion. |
| Notifications | Daily operator/deputy notice, authenticated user response notice, weekly digest with real preview images; repeated job does not resend; deliberately failed delivery is visible; external alert arrives. |
| Data rights | Complete synthetic access and erasure request across app/provider inventory; secure delivery, exclusions and outcome documented; no unrelated person's data disclosed. |
| Recovery/mobile | Restore evidence above; venue QR journey and account/download flows on a phone; no clipping or inaccessible controls. |

## Responsibilities remaining before activation

- Codex: code and CI evidence, exact-SHA handover; tracked in PR 72.
- Abacus/host operator: schema/history reconciliation, migration route, restored backup/media/key proof, secrets, email DNS/delivery, scheduler, uptime/error/spending alerts and hosted two-tenant acceptance.
- Bazil: named operator/deputy, confirmed legal particulars and review, and payment provider decision. Current code supports Stripe; do not switch the provider label to Revolut expecting it to work.

Seasonal briefing adapters/scheduler are still a separate product delivery: do not advertise automated seasonal alerts from the foundation alone. This readiness change instruments the existing weekly photo digest and privacy jobs.

## Isolated verification recorded for this change

- Next.js 16.3.3 Turbopack production build passed with TypeScript errors enforced. This scratch runtime needed a temporary mapping to the newly generated local Prisma client and its checked-in CI lockfile; neither temporary configuration was committed. Fresh GitHub CI generates its own client.
- Explicit TypeScript check passed.
- Seven readiness tests passed: durable limits, token binding/expiry/reuse/revocation, failed delivery, private/duplicate-safe reminders, heartbeat failure, dependency ordering and changed-email rejection. Account recovery and email tests passed, including disabled-notification rejection.
- Existing Honeycomb, hubs, journal, rights, seasonal foundation, onboarding, navigation, workspace, invitations and attention tests passed locally. Stripe tests include cancellation/past-due states and unsupported-provider rejection. County/community checks passed; independent QR binary decoding is left to CI, where zbar is installed.
- Production-server smoke checks: login/signup/verify-email/contributor-release returned 200; unauthorised operational status returned 401; disabled Ask returned 503.
- Full production database rebuild, hosted upgrade, external mailbox delivery, actual payment-provider checkout, external alert receipt and backup/media/key restoration have NOT been performed. The historical Ellona cross-database dependency remains a release blocker requiring actual hosted schema evidence.
