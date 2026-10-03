# Current state — 3 October 2026

This is the operational record as of the documentation baseline.
Classifications are not interchangeable.

- **VERIFIED** — directly observed, with the evidence named.
- **REPORTED** — stated by a person, a host or an existing document, and not independently checked.
- **INFERRED** — the evidence points this way and does not prove it.
- **UNKNOWN** — not established. Unknown is a result, not a gap to be filled by assumption.

## Identity

| Fact | Class | Record |
|---|---|---|
| Production running commit | UNKNOWN | No page, header or script on the public site named a git commit. A branch name containing "deployed" is not evidence. |
| Production application database identity | UNKNOWN | Pending a current host confirmation. No connection string is recorded here. |
| Production evidence database identity | UNKNOWN | Pending a current host confirmation. |
| Production `_prisma_migrations` ledger | UNKNOWN | It has not been read. |
| `20260915_ellona_opportunity_watch` on production | UNKNOWN | Three states remain possible. None is selected. See the migration register. |
| `EvidenceDocument` present in the production application database | UNKNOWN | Not inspected. |
| Production feature-flag state | UNKNOWN | No current environment was read. Flags this candidate understands are listed in `docs/registers/CUSTOMER_CANDIDATE.md` as code, not as live settings. |
| Current host backup and recovery configuration | UNKNOWN | A historical document describes a restore helper and says a full restore had not been performed. That is not proof of today's backups. See the incident log. |
| Customer candidate | VERIFIED | `3c08ab229a2e4c76c9b8b17137951b8e700c017f`. **CUSTOMER CANDIDATE — NOT DEPLOYED — NOT ACCEPTED.** Database compatibility is not established. |
| Production write freeze | DECIDED | Operating decision of 3 October 2026. It is not a control observed on the host. |
| Customer browser acceptance | NOT RUN | |
| Two-tenant isolation on this candidate in a rehearsal | NOT RUN | |
| Controlled railway acceptance | NOT RUN | |
| Pull request 105 | UNTOUCHED | Outside this recovery. Not modified by this commit. |

## What was actually observed

VERIFIED, 3 October 2026, by reading this commit and the GitHub record of it:

- The commit message is "Fix personal sign-in journeys and complete case access revocation". Its parent is `32d0646504b84db3d9d62700d48f0e82875ec5ec`. Committer time 2026-09-22 14:48:22 +0100.
- GitHub check run `validate` concluded success: https://github.com/bcromer77/bioveracity/actions/runs/35736037352/job/106773408220. That is a check run. It is not browser acceptance and it is not a deployment.
- `Event.datePrecision` is in `nextjs_space/prisma/schema.prisma`. No migration in this commit adds that column.
- The repair file lives in a later commit, `156d29a67324a3ed5510079518189712d5ac81ff`, folder `20260930_event_date_precision`. That commit is five commits after this candidate and was not cherry-picked.
- This commit has no `nextjs_space/app/place` route.
- The next commit, `4f0daec0ed18b8bf5d740246a1bfefa0e6d31034`, has this commit as its only parent. It adds the club source watch and the Revolut pilot. It is not part of the candidate. The sports-club venue type is a further descendant, `423215bd3b331502ae44bda5d172ca21dfe7dd3d`.

VERIFIED external HTTP observation, 2026-10-03T09:46:34Z: `GET https://bioveracity.com/place/dodder` returned 500, and the HTML title was `Place — BioVeracity`. No commit hash was present.

INFERRED from that response, and not a production SHA: the title matches the Place page that exists only in later commits. The response is compatible with a build that contains that route. It does not identify which commit, and it does not prove that this candidate is, or is not, the rest of the running application.

## Contradictions left unresolved

The 19 September text preserved below disagrees with itself. One section says a supplied report deployed `7b240dab00826c8d2a52c1c4582449d744dec2e5` and applied the three `20260919_*` migrations. An older section of the same file says those migrations were not applied and that production was checkpoint `b692e9a`. Neither section was re-checked against the host. Both stay as historical writing.

## Registers

- `docs/registers/RELEASE_REGISTER.md`
- `docs/registers/MIGRATION_REGISTER.md`
- `docs/registers/DECISION_LOG.md`
- `docs/registers/INCIDENT_LOG.md`
- `docs/registers/CUSTOMER_CANDIDATE.md`
- `docs/registers/ACCEPTANCE_REGISTER.md`
- `docs/registers/ACCEPTANCE_CONTRACT.md`
- `docs/registers/RAILWAY_TEST.md`
- `docs/registers/REHEARSAL_PLAN.md`

---

# HISTORICAL SUPPLIED REPORT — 19 SEPTEMBER 2026 — NOT CURRENT PRODUCTION VERIFICATION

The material below is preserved. It is not the current production record. Nothing in it has been promoted to VERIFIED by this commit.

# Current engineering update — venue launch preparation

Updated 2026-09-19 (UTC). This section supersedes the older release snapshot below.

- GitHub integration baseline inspected for this task: PR65 merged into
  `clarity/usability-release` at `a36399b` (verified via git fetch).
- Last production report supplied by Bazil: Abacus deployed
  `7b240dab00826c8d2a52c1c4582449d744dec2e5`, applied the three `20260919_*`
  migrations and kept Wild Hub/billing flags disabled. This is a supplied deployment
  report, not an independently inspected live environment.
- PR65 production deployment and its observation migration are not verified here.
- Current work: `feat/venue-launch-onboarding` implements managed intake, owner setup
  and launch tracking. Read `docs/VENUE_50_LAUNCH.md` for scope, validation and release
  gates. No live flags, accounts, permissions, messages or databases changed here.
- Venue readiness now takes priority at Bazil's instruction: prepare the technical
  route for 50 places next week. This is a delivery target, not contracted demand.
- PR64 was the merged billing-date fix. The historical reservation below is obsolete.
  Annual billing remains outside this venue-onboarding change.
- The connector branch is preserved remotely as `archive/abacus-connectors-acaadb1`
  per the supplied Abacus report; it is not part of this change.

---

# Historical release snapshot (superseded above; retained for provenance)

> All agents must read this file before reconstructing project state. Verify externally changeable facts before deployment and update this file before completing release work.

# BioVeracity Current State

## Repository

- Repository: `github.com/bcromer77/bioveracity`
- Integration branch: `clarity/usability-release`
- Current integration commit: `2ae2d01514ce5ccde5546532cefee269e8f019ad` (GitHub `origin/clarity/usability-release` tip; imported into the Abacus workspace)
- Production deployment commit: checkpoint `b692e9a` (v35 reconciled release). Production still runs this checkpoint — the `2ae2d01` integration code is **not** deployed.
- Last verified: 2026-09-19 (UTC)

## Product boundary

- **RippleXn.com** is the company.
- **BioVeracity** is the environmental / ecology evidence application.
- **Wild Counties / Wild Venue** is the venue-facing product within BioVeracity.
- Core architecture: multiple evidence sources operate as coordinated railway tracks and trains — each source is a track, each scheduled/queried pull is a train — so sources stay independently verifiable rather than blended into a single opaque feed.

## Latest merged release

Merged into `clarity/usability-release` (at `2ae2d01`):

- **PR58 — Establish Luogo observation contract and integration seam** (content commit `b66deac`; not a numbered merge commit, but the code is present in `2ae2d01`).
- **PR59 — Luogo observation persistence** (merge `a648536`).
- **PR60 — Luogo source trains (source trains and source health)** (merge `1def81d`).
- **PR61 — Institutional arrival (destination-first onboarding)** (merge `3194a70`).
- **PR62 — Attention return (quiet attention engine)** (merge `dd7fb2b`).
- **PR63 — Guarded Stripe subscription billing** (merge `2ae2d01`).

## Deployment state

Each fact is recorded separately. Merged code is **not** deployed software.

- Merged in GitHub: **YES** — PR58–PR63 are in `clarity/usability-release` at `2ae2d01`.
- Imported into Abacus: **YES** — Abacus workspace working tree synced to `2ae2d01` (2026-09-19). Abacus commit before sync was `590d841` (PR57 field-journal line; preserved, not part of this release).
- Built successfully: **YES** — production build (`yarn build`) exit 0 on `2ae2d01` (2026-09-19).
- Migrations applied: **NO** — the three release migrations are pending in the target database (see below).
- Deployed: **NO** — nothing from `2ae2d01` has been deployed to production.
- Live journey verified: **NO** — no hosted end-to-end journey has been run against the imported release.

## Pending migrations

Detected on disk under `nextjs_space/prisma/migrations/`, in Prisma execution order (lexicographic by folder name). None are applied in the shared database (applied history ends at `20260917_register_interest`). All three are strictly additive (only `CREATE TABLE` / `CREATE INDEX` / `ADD CONSTRAINT` foreign keys — no `DROP`, no destructive `ALTER`, no data mutation).

1. `20260919_attention_return` — creates `AttentionPreference`, `AttentionEvent`, `NotificationDelivery`. FK to existing `User`. Status: **not applied**.
2. `20260919_institutional_arrival` — creates `PrivateWorkspaceInvitation`. FKs to existing `PrivateWorkspace`, `PrivateCase` (composite `workspaceId,id`), `User`. Status: **not applied**.
3. `20260919_stripe_billing` — creates `BillingAccount`, `StripeWebhookEvent`. FK to existing `User`. Status: **not applied**.

All FK parent tables (`User`, `PrivateWorkspace`, `PrivateCase`) and the required `PrivateCase(workspaceId,id)` unique index are confirmed present in the target database.

## Feature flags

Status reflects the Abacus workspace `.env`. Absent = disabled (feature ships dark). No values shown.

- `BIOVERACITY_BILLING_ENABLED` — absent → **disabled**.
- `BIOVERACITY_BILLING_LIVE_ALLOWED` — absent → **disabled** (live billing not allowed).
- `STRIPE_WILD_SELF_SERVE_ENABLED` — absent → **disabled** (Wild self-service checkout off).
- `STRIPE_PROFESSIONAL_SELF_SERVE_ENABLED` — absent → **disabled**. Professional self-service is **off** and must stay off.
- `WILD_HUBS_ENABLED` — absent → **disabled** (Wild Hubs / field-journal features ship dark).

## Billing configuration

Variable **names** only — never record or print values here.

Required by the PR63 code (`lib/billing/stripe.ts`, `app/api/billing/checkout`, `app/api/billing/webhook`, `app/api/account/billing`):

- `STRIPE_SECRET_KEY` — absent from Abacus `.env`.
- `STRIPE_WEBHOOK_SECRET` — absent from Abacus `.env`.
- `STRIPE_WILD_MONTHLY_PRICE_ID` — absent from Abacus `.env`.
- `STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID` — absent from Abacus `.env` (professional product not configured).
- `STRIPE_API_VERSION` — absent (code falls back to its pinned default).
- `WILD_PUBLIC_ORIGIN` — present (used for checkout return URLs).

**Plan support in code:** `BillingPlanKey` is exactly `'WILD_MONTHLY' | 'PROFESSIONAL_MONTHLY'`. The code supports **only `WILD_MONTHLY`** for the Wild Venue product. **There is no `WILD_ANNUAL` plan key, no `STRIPE_WILD_ANNUAL_PRICE_ID`, and no annual code path.** Annual billing is **not** supported and annual must **not** be routed through the monthly plan.

**Commercial decisions (record only — do not implement beyond what PR63 already ships):**

- Product = **Wild Venue**.
- Monthly **£99 GBP** inc. UK VAT.
- Optional annual **£990 GBP** inc. UK VAT — **not yet supported in code** (see PR64 reservation under Next actions).
- One venue / place per subscription.
- No Bronze / Silver / Gold tiers.
- No Professional Workspace or institutional Stripe products yet.
- Payment state must **not** grant workspace / case / venue / institutional permissions.
- Founding venues must **not** be auto-charged.

## Current blockers

- **Stripe not configured in Abacus** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_WILD_MONTHLY_PRICE_ID` all absent. Test/live checkout cannot run until these are set. Stripe account verification and payout requirements are outside this workspace and must be confirmed with the Stripe dashboard owner before live billing.
- **Release migrations awaiting authorisation** — the three `20260919_*` migrations are not applied in the target database and require explicit approval to run.
- **Hosted release tests not yet run** — validation and build passed in the Abacus workspace, but no hosted / deployed end-to-end journey has been executed.
- **Annual billing missing** — commercial plan includes an optional annual price with no code support.
- **Unpublished Abacus-local connector line** — a dormant local branch (`acaadb1`, preserved as `safety-local-clarity-acaadb1`) holds 56 commits NOT on any GitHub remote (MARA/EPA statutory publishers, Dublin Port venue ledger, OCDS/Mod.gov connectors, award tracking). It is not part of this release and has not been reconciled or deployed.

## Next actions

1. Authorise and run the three additive `20260919_*` migrations against the target database (backup + preflight first; see the release runbook / Part 4 procedure).
2. Decide the fate of the unpublished `acaadb1` connector line (reconcile onto a branch and open its own PR, or explicitly retire it) — do not fold it into this release.
3. Deploy `2ae2d01` to production only after migrations are applied, then run the hosted end-to-end journey.
4. When live billing is intended: configure Stripe env names in Abacus, keep `BIOVERACITY_BILLING_LIVE_ALLOWED` off until the full hosted billing journey passes.
5. Reserve **PR64** for the smallest safe change adding `WILD_ANNUAL` Wild Venue billing (£990/yr) — do not consume PR64 with anything else.

## Do not do

- Do not expose or commit secrets (keys, tokens, price IDs, webhook secrets, connection strings).
- Do not merge all open PRs — the repo has many old/draft/stacked PRs; they are not a deployment queue.
- Do not deploy from `main`.
- Do not enable live billing before the full hosted billing journey passes.
- Do not grant application permissions (workspace / case / venue / institutional) from billing / payment state.
- Do not alter Cambridge, Niamh, Fodder, or any other user's permissions.
- Do not send invitations or customer communications.
- Do not improvise VAT or legal treatment.
- Do not run destructive database operations (`--accept-data-loss`, `--force-reset`, drops, truncations, resets).
