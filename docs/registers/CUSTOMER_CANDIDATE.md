# Customer candidate

| | |
|---|---|
| SHA | `3c08ab229a2e4c76c9b8b17137951b8e700c017f` |
| Commit message | Fix personal sign-in journeys and complete case access revocation |
| Parent | `32d0646504b84db3d9d62700d48f0e82875ec5ec` |
| Committer time | 2026-09-22 14:48:22 +0100 |
| Status | **NOT DEPLOYED. NOT ACCEPTED. DATABASE COMPATIBILITY NOT YET ESTABLISHED.** |

This is not production, not production-ready, not deployed, not verified live, and not accepted.

GitHub check `validate` concluded success on this SHA. That check was not re-run for this documentation commit. It does not accept the candidate.

## Prominent unresolved defect

**KNOWN CANDIDATE SCHEMA/MIGRATION MISMATCH — UNRESOLVED**

The Prisma schema expects `Event.datePrecision`. No migration in this commit creates it. The repair commit `156d29a67324a3ed5510079518189712d5ac81ff` is not part of this candidate and is not authorised to be cherry-picked. A database created only from this commit's migrations can disagree with this commit's schema. Do not deploy it onto an unread production ledger.

## Included

Included means the code is in this commit. It does not mean the feature is enabled in production, and it does not mean a customer has used it.

- Personal sign-in journeys changed by this commit: general signup asks venue, professional evidence, or both; the choice is navigation, not an administrator role. Verification and password recovery keep a same-site destination. `/start` uses server-authorised memberships. Saved workspace names are shown. Colleague invitation links can be created for VIEWER, REVIEWER or CONTRIBUTOR, and an accepted non-owner can be removed from a case, with an audit row. The invitation UI does not send email. This description is taken from `docs/QA_REMEDIATION_HANDOVER.md` in this commit. Those local tests were not re-run on 3 October 2026.
- Account recovery migration `20260922_account_recovery`.
- Terms and data-rights migration `20260924_data_rights`. Signup in this commit returns HTTP 409 and the text "An account with this email already exists" when the email is already registered (`nextjs_space/app/api/signup/route.ts`). That discloses whether an email has an account.
- Workspaces, cases, case documents, passages, search and a case-timeline PDF download. Upload copy in the workspace UI allows PDF, TXT and CSV, up to 3 MB, five files per batch. DOCX, EML, images and audio are blocked in that copy. Files are described as being sent to Cloudmersive before text is read.
- Managed venue onboarding (`20260921_venue_launch`) and venue photo settings (`20260923_venue_photo_journal`). This is the venue capability that already existed. It is not the sports-club venue type.
- Stripe billing tables. The code is present. Whether any flag is on in production is UNKNOWN. Revolut is not this capability.
- Wild hubs, attention preferences, institutional invitations, observation revisions, Ellona opportunity tables, and the production-readiness helper. Ellona's foreign key is an unresolved defect, not a working cross-database design.
- Roles the server code recognises on a workspace or case: OWNER, CONTRIBUTOR, REVIEWER, VIEWER.

## Excluded, and why

Exclusion is from commit ancestry. It is not a product judgement about the later work.

| Later work | First commit outside this candidate | Why it is outside |
|---|---|---|
| Club source watch and Revolut subscription pilot | `4f0daec0ed18b8bf5d740246a1bfefa0e6d31034` | Direct child of this candidate. Not contained in it. |
| Sports club venue type | `423215bd3b331502ae44bda5d172ca21dfe7dd3d` (2026-09-23T10:56:44Z) | Descendant. Not contained in this candidate. |
| `docs/OLD_BELVEDERE_LAUNCH_HANDOVER.md` | Touched by `4f0daec0ed18b8bf5d740246a1bfefa0e6d31034` and `af12f341986e17959e96b884dc2a53bf18b57b97` | The file is not in this commit. It was not renamed. Old Belvedere is the pilot name for Sports Clubs, not a separate product. The capability is outside this candidate because the commits are outside it. |
| `Event.datePrecision` migration | `156d29a67324a3ed5510079518189712d5ac81ff` | Five commits later. Not cherry-picked. |
| Place route (`app/place`) | Not in this tree | A later place page exists on descendant commits. It was not merged back. |
| Pull request 105, commercial property | Not in this commit's history | Left untouched by decision. |

## Flags this code can read

These names are in `nextjs_space/.env.example` at this commit. **The production value of every one of them is UNKNOWN.** Listing a name is not evidence that it is on or off.

`NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, `PRIVATE_WORKSPACES_ENABLED`, `PRIVATE_EVIDENCE_ENABLED`, `PRIVATE_EVIDENCE_RUNTIME_APPROVED`, `ELLONA_WATCH_ENABLED`, `BIOVERACITY_BILLING_ENABLED`, `BIOVERACITY_BILLING_LIVE_ALLOWED`, `STRIPE_WILD_SELF_SERVE_ENABLED`, `STRIPE_PROFESSIONAL_SELF_SERVE_ENABLED`, `WILD_PHOTO_JOURNAL_ENABLED`, `WILD_PHOTO_DIGEST_SEND_ENABLED`, `DATA_RIGHTS_ENABLED`, `AUTH_REQUIRE_VERIFIED_EMAIL`, `AUTH_ADMIN_EMAIL_STEP_UP`, `AUTH_TRUST_PROXY_IP`, `ASK_SERVER_ENABLED`, `OPERATIONS_SEND_ENABLED`, `BIOVERACITY_EVIDENCE_ENABLED`, `BIOVERACITY_VECTOR_ENABLED`, `PUBLIC_PDF_EXTERNAL_PROCESSING_ENABLED`.

No secret values are copied here.

## What would have to be true before this candidate could be deployed

Not authorised now. Recorded so it is not forgotten.

1. Production SHA and both database identities known.
2. `_prisma_migrations` read.
3. Ellona state chosen from evidence, not from this document.
4. `Event.datePrecision` reconciled on an isolated copy.
5. Isolated Alice/Bob acceptance passed.
6. A restore rehearsal recorded.
7. A release-register entry filled before the deploy, not after.
