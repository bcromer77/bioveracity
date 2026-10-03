# Migration register

Human ledger for the migrations present in customer candidate `3c08ab229a2e4c76c9b8b17137951b8e700c017f`.

Production status is **UNKNOWN** for every row. The production ledger has not been read. Local evidence means the file is in this commit. It does not mean the migration was applied, and it does not mean a test was re-run on 3 October 2026.

QA evidence is **NOT RE-RUN** for this baseline. Older documents may claim a local or isolated run. Those claims stay in those documents. They are not copied here as production status.

How to apply, when application is separately authorised: `yarn db:release` as described in `nextjs_space/prisma/migrations/README.md` and `docs/PRODUCTION_READINESS_HANDOVER.md`. This register does not authorise an apply.

No migration SQL in this set contains a `DROP TABLE` or `DROP COLUMN`. That search is not a promise that every statement is harmless. `20260930_event_date_precision` is not in this set.

## Known mismatch — unresolved

**KNOWN CANDIDATE SCHEMA/MIGRATION MISMATCH — UNRESOLVED**

`Event.datePrecision` is required by `nextjs_space/prisma/schema.prisma` in this candidate (`String @default("day")`). No migration folder in this candidate adds the column.

The repair is commit `156d29a67324a3ed5510079518189712d5ac81ff` (2026-09-22T22:19:05Z, message "Add missing Event datePrecision migration"). The file is `nextjs_space/prisma/migrations/20260930_event_date_precision/migration.sql`. That commit is five commits after this candidate. Its parent is `af12f341986e17959e96b884dc2a53bf18b57b97`, which is on the later club line. The SQL is an additive column repair: add `Event.datePrecision` if missing, backfill `day`, then set default and NOT NULL. It was not cherry-picked. It was not applied. It must not be applied as part of documentation.

## Ellona — unresolved

`20260915_ellona_opportunity_watch`, introduced by `486a2c83002dee17142e0f43df6029f1a69cb31a`.

The migration creates `PublicOpportunity` and adds a foreign key from `PublicOpportunity.evidenceDocumentId` to `EvidenceDocument.id`. `EvidenceDocument` is created by `0001_evidence_pipeline`, which is the evidence-database migration. The release helper refuses an application-database plan when `EvidenceDocument` is absent and this Ellona migration is not already recorded as finished. The helper's own message says not to copy evidence migrations into the application database to satisfy the key.

Which of these is true in production is **UNKNOWN** until `_prisma_migrations` and the table list are read:

1. Ellona is recorded, and `EvidenceDocument` is in the application database.
2. Ellona is recorded, and `EvidenceDocument` is not in the application database.
3. Ellona is not recorded, and `EvidenceDocument` is not in the application database.

This document does not choose one. It does not mark the migration applied.

## Inventory

Intended database is taken from the migration's own comment or from the product the tables serve. Where that is not explicit, it is UNKNOWN. It is not a statement of where production actually put the table.

| Migration | Introducing commit | Purpose | Intended database | Dependency | Change | Production |
|---|---|---|---|---|---|---|
| `0000_init` | `d730712e74c6f20db41eb0462b87219e9a7d8782` | From-empty baseline. The migrations README says it was marked already applied to a database originally created with `db push`. That sentence is historical documentation, not a current ledger. | UNKNOWN | none stated | baseline | UNKNOWN |
| `0001_evidence_pipeline` | `957f058fda8d66790f45165dd1d609bbeaca1d7d` | Creates `EvidenceDocument`. | evidence | none stated | additive create | UNKNOWN |
| `0002_evidence_vectors` | `f4ddf75eaaf50324d3b51ab7bfca57c4313707a5` | Vector columns. The file says pgvector is required and to apply in staging first. | evidence | `0001` | additive | UNKNOWN |
| `0003_biodiversity_safeguards` | `29105bb676a161fc8c2667249a341900b07c515a` | Biodiversity safeguards. The file says evidence database only. | evidence | evidence tables | additive | UNKNOWN |
| `20260909_private_case_files` | `dc6ba9be9f31b23b6cf64592a5f33700f1164318` | Creates `PrivateCaseDocument`. | application | Sorts before workspace foundation. The readiness handover says this order is unsafe for a blind `migrate deploy`. | additive create | UNKNOWN |
| `20260909_private_workspace_foundation` | `dc6ba9be9f31b23b6cf64592a5f33700f1164318` | Workspace and case foundation. Same commit as the case-file migration. | application | Must be reconciled with the case-file migration before any apply. | additive create | UNKNOWN |
| `20260911_scan_pacing` | `199aba198f6b3237229fb30a22862e0e64e8a74c` | Cross-instance scan pacing cursor. | application | scanner use | additive | UNKNOWN |
| `20260911_scan_usage` | `73b514b32c8d49efb614e9f55afa0706defb07d0` | Monthly scan-usage counter. | application | scanner use | additive | UNKNOWN |
| `20260911_workspace_persona` | `e91fcaf7af7d8fa9ba4fb01773a94b8f69f055c0` | Persist workspace persona. File says additive. | application | workspace foundation | additive | UNKNOWN |
| `20260914_wild_hubs` | `d443636082c813fd58a406f802c19635848ca4a1` | Creates `WildHub`. | application | none newly established here | additive create | UNKNOWN |
| `20260915_ellona_opportunity_watch` | `486a2c83002dee17142e0f43df6029f1a69cb31a` | Opportunity tables. Foreign key to `EvidenceDocument`. | application migration, evidence-table dependency | `EvidenceDocument` in the same database at apply time | additive create plus cross-database key | UNKNOWN |
| `20260915_wild_editorial_review` | `c7b76e8278b547c375d30a84e3e667b73132f0f4` | Creates `WildHubReview`. | application | wild hubs | additive create | UNKNOWN |
| `20260919_attention_return` | `9dc6091f3341f6d7560599780bb30ffa49565cc7` | Creates `AttentionPreference`. | application | user table | additive create | UNKNOWN |
| `20260919_institutional_arrival` | `9517b4aaf29cb3263a4024088e915c415fa60fcd` | Creates `PrivateWorkspaceInvitation`. | application | workspace and case | additive create | UNKNOWN |
| `20260919_stripe_billing` | `829778e8d5d1dcd93068c515e3a5a3a89b1a58ba` | Creates `BillingAccount` and `StripeWebhookEvent`. | application | user table | additive create | UNKNOWN |
| `20260920_observation_revisions` | `442c0fe027dc95d90a0afafc53355110e55968ca` | Observation corrections and content snapshots. File says do not drop existing objects. | application | existing observation tables | additive | UNKNOWN |
| `20260921_venue_launch` | `0e37880e4c061492c97d4f8fae9008e09d39d878` | Managed venue intake. File says nothing is seeded. | application | venue product | additive | UNKNOWN |
| `20260922_account_recovery` | `3c3088ab0f2e736e1e9e79c1b4e98d8d4208e937` | Password reset and session invalidation. File says additive. | application | user table | additive | UNKNOWN |
| `20260923_venue_photo_journal` | `68891797410e4fabf6343097f9a34e5f9509b849` | Creates `VenuePhotoSettings`. | application | venue | additive create | UNKNOWN |
| `20260924_data_rights` | `cd3f05ad1e727f2ee3b3a512ff36b71d6cca6be4` | Creates `TermsAcceptance`. | application | user table | additive create | UNKNOWN |
| `20260925_production_readiness` | `32d0646504b84db3d9d62700d48f0e82875ec5ec` | Creates `IdentityChallenge`. | application | account | additive create | UNKNOWN |

Not in this candidate, recorded so it is not forgotten:

| Migration | Commit | Status |
|---|---|---|
| `20260930_event_date_precision` | `156d29a67324a3ed5510079518189712d5ac81ff` | Identified. Not in the candidate. Not cherry-picked. Not applied. |
