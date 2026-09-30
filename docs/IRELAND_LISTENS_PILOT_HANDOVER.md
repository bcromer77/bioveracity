# Ireland Listens: free private listening pilot

User instruction, 30 September 2026: build a free BioVeracity citizen-science experience to support a proposed collaboration with Derek and Mooney Goes Wild, with exceptional signup and end-to-end usability. This branch implements the first private listening journey. It does not claim the nationwide observatory is finished.

## Release boundary

Base `place-exp/h-closure` at `7ee1155b629448e426ebe70c95491515b16b1351`. That qualified candidate is unchanged. New work is isolated on `feat/ireland-listens-pilot`. No production action, RTÉ contact, partnership, payment, data import or schedule is performed. Existing hosting remains Abacus. No replacement infrastructure.

## Implemented first slice

`/listen` → contextual free signup → verification callback → private place → five-minute self-reported listening visit → dated private history → repeat → JSON download or place deletion. Existing users sign in with the same callback. New signup directed to `/listen` requires verification even when general signup verification is disabled. Pilot API requires an actually verified account regardless of global auth flags.

Landing and APIs fail closed unless `LISTENING_PILOT_ENABLED=true`. Homepage and current paid products are unchanged. Adults only, no coordinates or media uploads, no public participant/visit endpoint. A county and private nickname provide an intentionally coarse first location. Three places per account, 52 visits per place; owner row locking serialises quota decisions. Bound SQL enforces ownership; repeated identical submission IDs deduplicate; conflicting reuse rejects. Observation offset and timestamp, method, effort, conditions, note and receipt time remain distinguishable. Observations are unverified; no rates of population change or causal inference.

No paid API or AI call is made for these visits. Free participation is an acquisition experiment; hosting, email and support still cost money. Quotas bound per-account storage but do not cap total signup volume. Keep the initial invitation group small; national promotion requires provider monitoring, an abuse plan and a total service-cost budget. No budget is invented or spent here.

## Required hosted QA before any launch

1. Hosting owner confirms the exact existing Abacus app, isolated QA databases and storage, migration history and rollback. Current environment has no callable Abacus capability. Production release execution remains blocked separately.
2. Apply `20261005_listening_pilot` only to the isolated application QA database through the reviewed migration path; do not replay or reset historical mixed migrations. Generate Prisma with the environment-appropriate output; do not patch production by hand.
3. Set QA `NEXTAUTH_URL` to its actual external HTTPS origin and `LISTENING_PILOT_ENABLED=true`. Configure controlled transactional email and confirm mailbox arrival. No production flag change follows from this document.
4. Run full TypeScript, existing signup/auth suites, listening contract tests and the actual hosting production build. The small listening workflow proves contracts only; it is not a build or browser-QA gate.
5. On mobile and desktop: guest reads proposition → joins with unticked terms → receives verification → resumes `/listen` across tabs → creates first place → saves visit → refreshes → signs out/in → returns to that history. Exercise an existing verified account, duplicate email, wrong password, expired verification, resend and password reset with return destination.
6. Two users: change plot IDs on read/write/delete attempts; verify no foreign notes or visits in history or export. Test missing/foreign origins, oversized JSON, unverified/deleted accounts, concurrent fourth-place and 53rd-visit submissions, duplicate retries and changed-key conflicts against real PostgreSQL. SQL mocks do not prove database concurrency.
7. Interrupt each save after server commit but before response; retry unchanged form and confirm exactly one row. Test ambiguous errors keep typed form. Check deletion cascades visit rows. Confirm account erasure covers these tables; backups and retention must be documented in the actual privacy notice before launch.
8. Verify accessible labels/focus, keyboard completion, screen-reader announcements, phone widths, loading/error/empty states and 16px inputs. Check consent banner and footer routes. Check clock/zone warning and DST ambiguity; this pilot records device-local times and offsets, not an authoritative dawn/sunrise-normalised protocol.
9. Export readable JSON; deletion removes active-service plot/visits. Limited pilot export must not be described as a full account export. Review the current privacy notice for listening fields, retention, purpose and free-service operation; this branch does not invent legal approval.

Rollback: disable only the listening flag and restore the prior compatible application build; retain additive tables/data. Do not drop data or restore an old database over newer records. Confirm the actual Abacus rollback route before production proposal.

## Subsequent work needed for the full proposition

- A reviewed sampling protocol, not the five-minute engagement exercise alone: repeat-site/time/effort guidance, seasonal and weather covariates, missed visits, identification/reviewer states and minimum evidence for comparisons. First-detection time must account for sunrise, DST and effort. Never infer absence from non-detection.
- Public aggregate participation map with approved disclosure policy, privacy/sensitive-species controls and demonstrable geographic coverage; private nicknames and notes never flow automatically into it.
- Rights-cleared audio/image upload with size limits, scanning, permissions, deletion, species-review queue and replay controls. Do not scrape WhatsApp, RTÉ archives, broadcast recordings or partner datasets without permission.
- Licensed, source-linked contextual weather/environmental evidence; align spatial/temporal resolution and distinguish publication, observation and retrieval dates.
- Matched repeat observations and uncertainty estimates; separate participation changes from ecological signals. Any national trend requires validated sampling/statistical methods. No composite biodiversity score or acceleration claim from this pilot.
- Partner editorial review and approved attribution. BioVeracity stays the evidence infrastructure; Derek and scientists interpret. No RTÉ logo, endorsement or programme ownership asserted.
- Consent-based return reminders, delivery tracking and unsubscribe; no jobs are installed here. Measure signup completion, verified first visit, second visit and founder support minutes. Proposed pilot review after 25 invited adults and four weeks: improve or pause on concrete completion/support evidence, not publicity alone.

## Validation status (local release-candidate qualification, 30 September 2026)

Observed on this VM against a local scratch PostgreSQL 17 + pgvector cluster and a local `next start` production build. Nothing here was run on Abacus hosting, a hosted QA database, real email or a real device.

- Unit/contract (`tests/listening-pilot.test.mjs`, mocked SQL): 14/14 pass.
- Real PostgreSQL (`tests/listening-pilot.pg.test.mjs`, skipped unless `LISTEN_PG_URL` is set): 8/8 pass, repeated 5 times. Covers owner isolation, separate evidence columns, unverified 403, concurrent 6 place creates → exactly 3, concurrent identical retries → 1 row with conflicting reuse 409, concurrent 48+8 visits → exactly 52, cross-owner id race at INSERT → one row plus 409 (not 500), place and account deletion cascades.
- Migration `20261005_listening_pilot` applied on a scratch database after the historical chain; both foreign keys are ON DELETE CASCADE; `prisma migrate diff` shows no listening drift. Two pre-existing migrations (`20260909_private_case_files`, `20260923_bng_obligations`) fail in lexical order on an empty database ("PrivateCase" does not exist); unrelated to this pilot.
- Full regression, every `tests/*` file: candidate 80 files / 550 tests, 548 pass, 0 fail, 2 skipped; base `7ee1155` 78 files / 528 tests, 526 pass, 0 fail, the same 2 skipped.
- App TypeScript, SDK TypeScript, SSR lint on `app/listen`, `prisma validate`, `next build` with the flag unset: all exit 0.
- HTTP end-to-end against the local production build (email transport stubbed locally, not delivered): 64/64 checks — flag off 503, guest 401, signup → verification link returning to `/listen`, expired/reused tokens, resend, callback manipulation, Origin/content-type/size hardening, idempotency and conflicts, quotas, two-user isolation without disclosure, deletion, password reset invalidating old sessions.
- Headless Chromium at 390×844 and 360×740: 96/96 checks — axe 0 violations in 9 states per width, /listen targets ≥ 44px, no horizontal overflow, visible keyboard focus, lost-response and offline retries save exactly once with typed form kept, timeline labels unverified participant observations, not-heard is not absence, download holds only own data without coordinates/email, delete, session-expiry state. The global cookie-consent banner (shared layout, first visit) has targets under 44px; recorded as pre-existing global debt, not changed here.

Not proven here: hosted QA database migration, real email arrival, proxy/origin behaviour on hosting, real iOS/Android date-time pickers and zones, screen-reader use by people, hosted interrupted-commit retry, rollback route, privacy notice and retention wording, and account erasure (the existing data-rights erasure request does not delete the User row, so it does not yet remove listening data).
