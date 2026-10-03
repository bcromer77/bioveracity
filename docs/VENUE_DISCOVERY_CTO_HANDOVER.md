# Venue discovery and Luogo: first implementation slice

21 September 2026. Base: feat/venue-weekly-photo-review at 2c15d7a. This is a stacked change, not a replacement for other unmerged work. No production migration, flag change, email send or deployment.

## Code inspection findings

- WildHub is owner-scoped (lib/wild-hubs/service.ts); private workspaces have separate membership enforcement. Do not replace these with a browser-supplied tenant ID. A multi-user venue team is not yet established by the owner model.
- Venue onboarding already prepares administrator-reviewed records and hashes seven-day claim tokens, checks the fresh account email, and prevents claim links transferring ownership. It creates a private draft, not a public listing.
- Public hubs use approved snapshots. The existing venue journal branch implements weekly review emails, durable delivery claims and unknown-send handling. Deployment/scheduler state has not been verified.
- OpenAI embeddings already exist (lib/evidence-embeddings.ts): text-embedding-3-small by default, 1536 dimensions, explicit feature flag, model/recipe version. Reviewed evidence retrieval already fuses PostgreSQL keyword and pgvector rankings, with account quotas and keyword fallback. No new vector store purchase is warranted by this inspection.
- Honeycomb's map search is independently scoped to authorised cases, with lexical candidate filtering. Its current geometry is Ireland-specific. It is not a UK-wide seasonal semantic retrieval API.
- Wild county nature API is a bounded sample of historic Irish records, not a current venue sighting feed. UK source coverage must be implemented and verified explicitly.
- Luogo observation/source-train contracts are on feat/luogo-source-trains, not integrated into this base. Preserve their method, date precision, effort, coverage and lineage model during integration.

## This change

1. Adds /wild/destinations: a simple tourism-partner arrival page, illustrative venue journey, three-venue pilot explanation and a no-account enquiry using the existing lead endpoint. Destination context is included in the message; no new public endpoint or schema.
2. Links the venue arrival page to this route, explains seasonal guidance and removes wording implying already participating venues.
3. Adds a tested internal seasonal briefing boundary: approved reusable public source material only, exact place/county applicability, validity windows, explicit observation dates, no venue sighting inferred from county context, conflicting-revision suppression, owner check before source access, bounded cards and opt-in/delivered-key digest planning.

The seasonal module is an internal foundation, not wired to a production source adapter, page, email sender or scheduler. There is no fabricated sample catalogue serving guests. Its approved/reuse/scope inputs must be set by trusted server adapters after review, never by model output or public requests. Guidance text itself still requires editorial/source verification.

## Next bounded implementation

- Reconcile the latest photo-review and Luogo source-contract PRs with the actual deployed branch. Obtain full hosted SHA and deployment route before release.
- Build a reviewed seasonal-guide adapter and persistent place-to-source links. Separate recurring seasonal guidance from observed change. Preserve place geometry precision; county boundaries do not establish catchment membership. Record licensed reuse and sensitivity before embedding or guest delivery.
- Extend the existing hybrid retrieval with explicit geography, audience and temporal eligibility *before* ranking. Reuse embeddings by source revision; do not embed the same region for each venue. Evaluate synonyms against a labelled local set, alongside false-locality, stale-season and cross-tenant leakage cases. Scores rank relevance, never ecological truth.
- Connect the owner-checked brief to the venue studio and existing attention service. Start with in-product cards and one opted-in weekly bundle; separately agree high-interest change alerts. Never treat absent uploads as absent wildlife.
- Persist per-hub source-revision delivery keys in an atomic outbox. Recheck recipient/ownership and preferences immediately before delivery; uncertain sends require reconciliation, not retries. Retain the existing weekly photo digest rather than create competing mailers.
- Source collection can run regularly without emailing on every check. Seasonal flowering windows are expectations; a claim of flowering today requires a dated observation. Public location disclosure must protect sensitive species.
- Add habitat/location confirmation and notification choices to onboarding only after these inputs are supported end to end. Tourism organisations can refer venues without access to their private material.

## Acceptance and economics

Test: a permitted venue sees relevant reviewed seasonal guidance; another owner cannot retrieve it; a stale/withdrawn/private source disappears; changed source versions cannot silently reuse old embeddings; an opted-out owner receives nothing; duplicate runs do not send twice; unknown provider outcomes do not retry. Hosted enquiry persistence, notification delivery, invitation claim and publication need a staging journey before outreach uses the new URL.

At GBP60/month, shared regional retrieval and bounded editorial review are essential. Measure per-venue support/review minutes, unique source embedding volume, mail/storage cost and retention. No API keys or paid calls were used to develop this slice. No production functionality is claimed solely from code.

## Local verification of this slice

Node v24.19.0. Nine seasonal-discovery tests passed using Node's TypeScript stripping and a temporary extension resolver (no source transformation). Isolated strict TypeScript 5.6.3 check of the seasonal module and its tests passed. All three changed TSX files passed TypeScript transpilation/syntax checks. `git diff --check` passed.

Full `npm run typecheck` was attempted but unavailable (`tsc: not found`) before the isolated compiler was downloaded. The committed dependency install stalled during resolution and was stopped; the original hosted yarn.lock symlink was restored unchanged. No full application build, UI browser validation, database integration or email delivery pass is claimed. CI has been extended to run the new tests and full existing gates against the stacked base. This remains a draft until those checks and staging acceptance pass.

UK/Ireland check: enquiry pages explicitly welcome both markets and reuse the unbounded-region enquiry endpoint. Regional briefing tests cover English, Northern Irish, Republic of Ireland, Scottish and Welsh identifiers. This does not claim full source coverage or automatic hub creation for every region: the existing Wild County catalogue and onboarding remain bounded, and unsupported areas require setup before activation. No currency conversion or automatic subscription is introduced.
