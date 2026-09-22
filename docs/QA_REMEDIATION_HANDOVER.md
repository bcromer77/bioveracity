# QA remediation: personal journeys and release gates

This is a follow-on implementation stacked on PR73 / `release/qa-pr70-pr72` at `32d0646504b84db3d9d62700d48f0e82875ec5ec`. Preserve PR73's candidate and draft status; do not separately cherry-pick PR70/71/72. No production deployment is authorised by this document.

## Why this change

Browser QA confirmed that returning users see new-workspace choices before their existing work, saved workspaces can display a generic persona as their name, and an unrelated example occupies the active case's primary space. Code inspection additionally identified a lost signup destination at email verification and incomplete accepted-member revocation. Source/search/review actions failed shortly before the QA preview went offline. That outage is not diagnosed as a parser or report-code defect.

## Implemented in this PR

- General signup asks whether the customer runs a venue, works with professional evidence, or uses both. A trusted local deep link takes priority. This purpose is navigation, never an administrator role or access grant.
- Venue and professional entry links identify the intended destination. Signup, verification email (including another device), explicit confirmation, resend, password recovery and sign-in preserve that destination. Verification tokens remain in fragments and require an explicit confirmation action. Existing terms, throttles, verification and admin-code gates remain in place.
- `/start` uses current server-authorised memberships: one workspace/one case resumes it, venue-only accounts open studio, empty/multiple/mixed accounts get a personal home with both experiences. No guessed role from an email address or company name. No new database migration or classification of legacy accounts.
- Saved workspaces precede creation choices. Actual saved names appear in the canvas; legacy `custom` type is not silently rewritten. `My home` and `My venues` are available in the private account menu.
- Enniscorthy is an optional example, separate from the current case. Upload copy accurately lists PDF/TXT/CSV and 3 MB. Search, cross-check and report errors are visible next to their controls. HTTP 503 no longer asserts that nothing was saved; no automatic write retries.
- Workspace-and-case owners can create private colleague invitation links for VIEWER, REVIEWER or CONTRIBUTOR, with independent export permission; view pending invites/members; cancel pending invites; and remove a non-owner's accepted access after explicit confirmation. The UI sends no invitations by email. A case-scoped owner check prevents a workspace owner granting access to a case they do not own.
- Removal revokes that case membership and its export grant, invalidates pending invitations to that case, and records an audit action. Other case access remains intact. Owners cannot remove themselves/other owners using this control. Downloaded copies cannot be recalled. The existing server permission checks cover case/source/search/report routes.
- Recovery no longer displays a successful submission after a network/server failure. Neutral mail wording distinguishes a delivery attempt from proven arrival.

## Validation

- New UI interaction tests: venue signup continuation; explicit general purpose without role escalation; fragment removal/explicit verification/safe deep links; citation-aware sign-in and accessible credentials.
- Routing tests: empty, venue-only, single/multiple professional and mixed accounts; safe return paths and malicious external destinations.
- Isolated PostgreSQL journey: owner creates cases, reviewer accepts invitation, reviews a source and creates/downloads a real PDF; removal denies list/passage/search/original/report/review while preserving access to a different case. Invitations to different cases remain independently usable. Pending invitation cannot restore removed access; unrelated users cannot manage membership; owners cannot remove themselves.
- Existing account-recovery, institutional invitation, private-workspace, case-file HTTP/PDF and production-readiness tests passed locally alongside new tests. Full explicit TypeScript passed with an isolated generated client.
- Next.js 16.3.3 **Turbopack production build passed**, with type errors enforced. Scratch uses a shared dependency cache with an older generated Prisma client, so local verification temporarily mapped the isolated current client and used the checked-in CI lockfile; those overrides are not committed. CI creates its own client. Host must use independent dependencies, not share generated clients with production.
- CI includes the new tests and the existing case-file HTTP/PDF journey. Hosted browser acceptance of this new SHA has not occurred. Build/test success is not deployment.

## All audit findings: disposition

| Audit finding | Code action / remaining owner | Required observable acceptance |
| --- | --- | --- |
| QA host outage | Abacus; not diagnosed or repaired by this PR | Stable supervised private QA; protected error logs, external uptime alert and recovery rehearsal; complete a browser journey without rescue. |
| Signup/sign-in/personal landing | Implemented above | Actual controlled email round trip; venue/professional/mixed/empty/legacy accounts reach the right owned work; invitation/citation deep links survive signup and verification. |
| Generic workspace heading/example distraction | Implemented above | Saved name and selected case prominent; example collapsed; site selection explicit, no invented coordinates. |
| Unsupported audio promise | Implemented above | Correct copy plus hosted negative upload/size/scanner tests. |
| Collaboration/removal missing | Implemented above | Two controlled accounts complete invite/review/report/revoke through UI; deny changed-ID access after revocation. |
| Distant/ambiguous action errors | Implemented above | Controlled failure appears beside each action; input retained; refresh checks state before another write. |
| Full access/erasure fulfilment | Delegated privacy operator/deputy, existing queue retained | Actually inventory/search/redact/deliver or erase across applicable systems, document exclusions/retention/backups; completion flag alone is not evidence. |
| Email/tenant/publication/mobile/cancellation evidence absent | Abacus hosts; QA operator executes | Every acceptance row below has PASS/FAIL/BLOCKED plus evidence, exact SHA and actual role/minutes. |
| Isolation/schema history/generated-client concerns | Abacus; release blocker | Separate production/QA application/evidence identities and storage/keys, reconciled migration history, independent runtime; no fabricated applied schema. |

## Hosted acceptance required before production

Use two separate synthetic venue owners, an independent admin, a professional owner/collaborator and guest. Only controlled QA mailboxes/content; scan normally. `3e9a3890e_preview` serves production and is never the QA mutation target. Confirm exact application and evidence databases, storage and keys privately before testing. Keep live billing and production schedules disabled.

1. Record the new deployed full SHA and private URL, build identity evidence, isolated database/storage identities, relevant feature flags by name, secure test-account handoff and rollback target. Do not put secrets, tokens, contacts or private documents in GitHub.
2. Verify empty, venue-only, professional-only, multiple and mixed destinations; existing account logins; fresh venue/professional signup with unticked terms; stale/missing acceptance rejection; verification, resend and deep-link continuity; password recovery/admin codes, expiry/reuse and session revocation. Observe actual mailbox arrival.
3. Run owner venue setup and guest photo/contact/release upload; independent unticked future-publication options; malicious/oversized rejection; owner submission; separate verification/moderation/editorial approval; published snapshot, QR, credit/download and privacy. Repeat a second contribution without repeating onboarding.
4. Withdraw future-use permission and deny fresh clearance; unpublish and reject stale pending publication. Test provider **test-mode** cancellation and retained rights access. Revolut is still unsupported; seasonal adapter/delivery automation remains unfinished. Do not mark either PASS.
5. Import synthetic documents through the browser, inspect full exact passage, search, edit date precision conservatively, accept/reject, generate/download/reopen an accepted-only report and manifest, compare original hashes, test duplicate import and failure recovery. Add reviewer via UI; revoke and prove every read/write/download denial from the second account. Test forged foreign workspace/case/photo/release/request IDs.
6. Download limited account JSON; submit separate full access and erasure exercises and **actually fulfil** both with operator records. Keep release contacts private and third-party data redacted. Preserve original due date. Named primary/deputy and mailbox ownership are prerequisites.
7. Controlled weekly/privacy notices: preview images/links, unsubscribe/preferences, no duplicate send, ambiguous failures visible, external monitor actually alerts. Job templates are not installed jobs.
8. Phone-width/keyboard QA: signup/login/verify/studio/guest upload/account/receipt/review/report. Screenshots and downloadable report inspection; no desktop-only claim of mobile coverage.
9. Restore rehearsal of database, media and keys; record actual duration and loss against agreed RPO/RTO. Confirm tenant separation after restore and suppression of erased material. Observe scan/email/storage costs and real operator effort; unknown is not zero.

Record each required step's expected/actual, route, evidence, PASS/FAIL/BLOCKED/UNTESTED, software/customer/operator/founder role and measured hands-on minutes. Keep failed/blocked/untested steps in completion denominators. Self-service is customer work, not software automation. Do not remove human publication/authority approvals to improve percentages.

## Deployment and rollback

Abacus remains deployment owner. This PR adds no schema migration and does not authorise repairing history by marking missing schema applied. Follow `PRODUCTION_READINESS_HANDOVER.md` and `TERMS_AND_DATA_RIGHTS.md`; the Ellona cross-database dependency remains a host reconciliation gate. Require independent generated clients and a confirmed backup/rollback route.

Rollback application code to the compatible previously recorded SHA and disable newly enabled feature flags if required. Preserve additive tables, memberships, revocations, audit and rights records. Do not overwrite production with an old database or drop tables. Revoked memberships remain revoked when rolling back this UI. The host-specific restart command, prior compatible artifact, backup/media/key proof and recovery timings must be supplied by Abacus; none is invented here.

## Three actions to close

| Owner | Next action | Completion evidence |
| --- | --- | --- |
| Codex | Keep this follow-on PR draft until CI and hosted acceptance | Exact commit, checks, code review and reproduced UI fixes. |
| Abacus | Re-establish safely isolated stable QA and controlled email access | Exact new deployment, isolation/schema/runtime proof, secure role access, rollback/monitor evidence. |
| QA operator + privacy primary/deputy | Complete the full journeys and fulfilment exercises | Reproducible report, role/time scorecard and unresolved gates; no founder-required routine operations. |
