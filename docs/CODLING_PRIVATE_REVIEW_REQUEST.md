# Codling private review access - implementation request

Status: REQUEST ONLY. This change does not implement a login, create an account, issue an invitation, ingest evidence or deploy a service.

## Customer outcome

A named invited reviewer signs in, opens a private Codling demonstration, reads the approved report and follows its source references. The reviewer sees the access expiry date. Expiry or revocation prevents subsequent protected requests without affecting unrelated access or deleting the record.

The initial scope is a read-only demonstration, not a commissioned Codling system or a determination of technical adequacy. The separately scoped evidence-pack service is described below.

## Target and ownership gate

- Work register: `bcromer77/bioveracity`.
- Inspected reference: PR #77, `feat/sports-club-venues`, full SHA `64b0d8d3759c17381f8c2aede0d1602d4f4079dc`.
- This documentation branch starts from that reference and must not be treated as a new production candidate.
- An earlier instruction named AeroVeracity as the host application. No separate AeroVeracity repository was located in the connected repository search. Confirm BioVeracity versus a separately identified AeroVeracity application before adding runtime routes. Recording this request here is not a silent change of host application.
- Codex is the ordinary implementation owner. Abacus supplies hosted-environment, release and rollback evidence. Do not have two agents implementing the same task.
- Confirm the approved application base and full SHA before implementation. Preserve the stacked PR #70-77 work and unrelated BNG changes. PR #78 branding targets a different base; do not merge it blindly into this work.
- Authority for this request: inspect, record the engineering request and open a draft PR. No production migration, deployment, real invitation, new access grant, charge or public publishing is performed or authorised by this document.

## Existing components inspected

These findings are about the inspected reference, not live production:

| Component | Finding and reuse boundary |
| --- | --- |
| `nextjs_space/auth.ts` | Existing credentials sign-in, optional email-verification gate, persistent rate limits, password-reset authority and refreshed session authority. Reuse identity; do not create a second password system. Verify the configured identity gates in hosted acceptance. |
| `nextjs_space/lib/access.ts` | The global DEMO state shares institutional capability depth. Do not change the reviewer's global role to DEMO or ADMIN to grant access to one demonstration. |
| `nextjs_space/lib/workspaces/service.ts` | Workspace and case membership, role checks and revocation already exist. The inspected access predicates do not implement the requested time-limited prospect grant. |
| `nextjs_space/lib/workspaces/case-files.ts` | Encrypted document bytes, hashes, scoped passages, revision history, exact-quote review and audit events exist. Do not replace them with a second evidence pipeline. |
| `docs/PRODUCTION_READINESS_HANDOVER.md` | Records hosted schema/history reconciliation, separate application/evidence storage, mailbox testing and restore acceptance gates. Its provider-specific statements are dated and must be read alongside later release work. |
| `AGENTS.md` | Requires source provenance, labelled demonstrations, server-side access checks, isolated data and a confirmed deployment/rollback route. |

Pinned reading reference: https://github.com/bcromer77/bioveracity/tree/64b0d8d3759c17381f8c2aede0d1602d4f4079dc

## One journey, not another product

Candidate route, subject to host confirmation: `/review/codling`.

1. An authorised operator approves a named review grant and an immutable demonstration asset version.
2. The intended reviewer uses existing sign-in or signup, accepts the applicable terms and verifies ownership of the invited email. Preserve the safe return destination through verification and recovery, including opening the email in another tab.
3. The private page opens directly on the approved introduction, demonstration and report. Do not route the reviewer into venue onboarding, workspace creation, a generic account chooser or billing.
4. The display identifies the record as a demonstration, shows the access expiry and presents source references without implying a completed technical review.
5. The operator can revoke or extend this grant with an attributable reason. The reviewer cannot alter the expiry, invite others or approve findings.
6. At expiry the server refuses further protected content requests and presents an access-ended state. A new login, restored cookie, reopened link or different device must not restart the grant.

## Access contract

The following are requirements to implement and test, not existing capabilities:

- Use named, project-scoped grants. Keep grant scope separate from global subscription and institutional roles.
- Proposed operator default: a fixed 14-day access period from operator activation. Record `startsAt` and `expiresAt` as explicit UTC instants and show the local date/time to the reviewer. The actual period must be approved before issuing any real invitation. Do not infer an expiry from the statutory observations period.
- Persist the recipient binding, authenticated user binding when claimed, project identifier, allowed asset version, startsAt, expiresAt, revokedAt, issuer and grant-change audit history. Do not place personal addresses or credentials in this public work register.
- Check current identity, verified email, intended recipient, scope, start time, expiry, revocation and current asset permission on every protected request. Use server time; at `now >= expiresAt`, access is denied. A missing/invalid grant or unavailable permission store fails closed.
- If a claim token is used, it is cryptographically random, hashed at rest, single-use, time-limited and bound to the intended verified identity. A GET or email-link scanner must not consume it. Do not log token values.
- Repeated claims and parallel requests must not create duplicate grants or extend access. Extension and revocation must have auditable, concurrency-safe behaviour.
- Initial permission is read-only access to the approved demonstration and its issued PDF. Viewing a PDF exposes its bytes to the authorised browser; expiry is not DRM and cannot recall downloads, printouts or screenshots.
- This grant must not confer source-editing, review, publication, invitation, raw customer-data access or unrelated workspace membership.
- For a later private case-backed service, extend the existing case permission boundary consistently across lists, source passages, originals, search, citations, reports and exports. An expiring front page over a non-expiring case membership is unacceptable.
- Public primary-source links remain public at their original websites. Do not claim to revoke those sources.

## Protected demonstration assets

This repository is public. The approved PDF, prospect materials, HTML payload, recipient details and future private project documents must not be committed here or placed in a publicly served assets directory. Test with synthetic fixtures only.

- Store approved assets through the application's controlled storage route. Use an operator-approved manifest containing asset identifier, version, media type, checksum, permitted scope and review state.
- Authentication precedes retrieval of HTML, report bytes, thumbnails and any private source excerpts. Do not inline the entire demonstration into public page source, metadata, prefetch responses or the public JavaScript bundle.
- Restrict requested assets to the approved manifest. Reject traversal, arbitrary file paths and arbitrary remote URLs. Bound file size and validate media type.
- If the existing self-contained HTML is embedded, serve it from an authenticated endpoint and sandbox it. Its scripts must not acquire the parent application's session or access unrelated APIs. Review inline scripts, external dependencies and link behaviour before release; document and test the chosen content-security policy.
- Apply private/no-store cache behaviour and noindex/noarchive controls to protected responses. Ensure that CDN, service-worker, static rendering, redirects, HEAD/Range requests and direct file URLs cannot bypass the grant. Noindex is not an access control.
- An open tab can clear the display when access ends, but that is only a user-interface safeguard. Server checks are the authority. No claim can be made that previously delivered content is recoverable from a viewer's device.
- Keep minimal access/revocation/extension audit records through the existing audit infrastructure. Do not add third-party tracking, content logging or a general analytics project to this scope.

## Preserve the approved presentation

- Keep the approved fuchsia/coastal one-page introduction without the diagonal watermark; retain its approved wording and demonstration designation.
- Keep the 19-page white-background Revision 03 report with the transparent BIOVERACITY watermark and DEMONSTRATION ONLY marking. Do not rewrite or regenerate that PDF as part of this access change.
- Preserve working source references. Any demonstration navigation accompanying the report must retain catalogue-only/unreviewed states and distinguish the original question, applicant material, operative instrument and review decision.
- Do not add synthetic wildlife, fabricated measurements, automatic compliance grades, countdowns without evidenced triggers or unsupported performance claims.
- Do not represent the illustrative coast image or schematic as validated project geometry.
- Host application, visual brand and intended recipient are separate configuration decisions; none establishes a client engagement or regulatory endorsement.

## Acceptance tests - required before a real invitation

| Test | Observable result |
| --- | --- |
| Signed-out request | No private HTML, report, thumbnail, embedded payload or source excerpt is returned; correct sign-in destination is retained. |
| Wrong/unverified account | Forwarded invitation and changed request identifiers reveal no protected content and create no access. |
| Correct recipient | Verified intended reviewer reaches the approved demonstration and report through existing identity; no billing or new-workspace step. |
| Before start / exact expiry | Access is denied before startsAt and at or after expiresAt using controlled server time. |
| Repeat and parallel login | Grant dates and scope remain unchanged; duplicate claim does not extend access. |
| Revocation and extension | Revocation denies the next protected request even with an otherwise valid session. Only an authorised operator can extend; actor, old/new dates and reason remain recorded. |
| Identity change/recovery | Password reset, revoked session or changed email cannot bypass recipient binding or grant checks. |
| Direct asset/cache bypass | HTML/PDF endpoints, HEAD/Range, caches, prefetch and guessed asset names enforce the same permission. |
| Tenant and role isolation | Other cases/workspaces remain inaccessible; reviewer cannot edit, approve, invite or change grant state. |
| Page integrity | Desktop and phone show the approved design, correct demonstration labels, expiry and functional source links. |
| Failure and recovery | Missing storage, failed permission lookup, expired token and unavailable email have explicit safe outcomes, not success messages. |
| Existing-product regression | Existing professional, venue, account recovery and report/citation journeys remain intact; billing/provider behaviour is unchanged. |

Use isolated synthetic identities, an operator account and two unrelated tenant accounts. Test time via an injected clock, not by modifying a production clock or waiting 14 days. Run relevant automated tests, explicit type checks and the actual production build on the exact implementation SHA. Record hosted browser/mailbox tests separately. Existing test reports or screenshots do not satisfy this new acceptance set.

## Release gate

Before release, the host supplies the actual current deployment SHA, correct application project, persistent isolated QA URL, database/storage identities, migration history and rollback route. Reconcile the documented migration dependencies without resets, hand-patched tables or marking absent schema as applied. Preserve existing records, access revocations and unrelated unmerged work.

Keep the new feature disabled by default. No real invitation is sent until host selection, recipient, access period, approved assets and hosted acceptance are confirmed. A disabled feature does not revoke copies already downloaded. Keep existing customer services unaffected by a rollback.

## Making the evidence report operational

The approved Revision 03 report is the scope reference, not proof of an operating Codling engagement. Pages 13-16 define access, measurement, deliverables and limits. It states that the full filed response and revised monitoring contents were not substantively reviewed, and that geometry, operational records and hosted access are not validated.

The first commissioned deliverable remains one agreed sub-item of FIR 6(g): no more than 20 files / 300 pages and three GIS layers, with one review round. The report specifies ten working days after the agreed source pack, permissions and reviewer are available. That period is not a promise to build the entire asset-lifecycle service or to secure statutory acceptance.

1. Obtain and freeze the selected authoritative filed-response files and exact instrument versions. Record provenance, dates, permissions and access failures.
2. Preflight actual file sizes, extracted-passage counts and formats. The inspected private-case importer limits a case to 100 documents, 50 MiB and 1,500 extracted passages; the commercial page count does not override those technical limits. GIS validation is separate from document parsing.
3. Build the scoped question-to-passage record using the existing private document and review services. Preserve source facts, applicant statements, analysis and unresolved points distinctly.
4. Validate any included geometry, coordinate system, units and model/scenario metadata with a qualified reviewer. Unvalidated catalogue entries remain catalogue entries.
5. Produce the internal technical brief and the selected external explanation from the same reviewed evidence. Record review/issue approvals, qualifications and the approved publication scope. Do not grant the external viewer access to unrelated private records.
6. Issue a versioned report and evidence manifest. Demonstrate that each selected finding opens the correct source, then measure retrieval/rework against comparable manual tasks. Record actual preparation and review time, not an assumed saving.

A hosted demonstration is the first access milestone. A reviewed, accepted evidence pack is the first delivery milestone. Automated monitoring of all authorisations, full GIS/model interpretation, statutory submissions, sign-off and a complete ongoing operational record remain outside this initial change.

## Required handover

Return target application; branch/full SHA; changed files; tests/build results; QA URL and deployed SHA; synthetic identity and expiry/revocation results; remaining blockers; feature state; rollback route; and confirmation of whether any actual invitation was sent. Do not report an implementation request as implemented, a build as deployment, or deployment as completed customer delivery.
