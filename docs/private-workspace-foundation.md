# Private workspace foundation — issue #24

This bounded implementation is not the full case-file product. It creates and lists private workspaces and multi-site cases with server-side authorization. No upload, extraction, search, map layer, evidence export, CBAM calculation, invitation, billing or membership-management UI is enabled here.

## APIs

Authenticated NextAuth session identity is authoritative; body-supplied user/owner IDs are ignored. All responses carry private/no-store. `PRIVATE_WORKSPACES_ENABLED` must equal `true` or authenticated requests receive 503; default is disabled. Writes require same-origin Origin and JSON, streamed body maximum 16 KiB.

- GET /api/workspaces → `{workspaces:[{id,name,createdAt}]}`
- POST /api/workspaces `{name}` → `{workspace:{id,name,createdAt}}` (201)
- GET /api/workspaces/:workspaceId/cases → `{cases:[{id,workspaceId,title,template,createdAt}]}`
- POST same path `{title,template,sites:[{name,latitude?,longitude?}]}` → `{case:{id,workspaceId,title,template,createdAt}}` (201)
- GET /api/workspaces/:workspaceId/cases/:caseId → `{case:{...,sites:[{id,name,latitude,longitude}]}}`

Workspace name max 120; case/site titles max 180; max 20 sites. Templates PLANNING/FARMER/ESG/FREIGHT/GENERAL organise work only, not specialist calculations or compliance judgments. Coordinates require both valid numbers or remain null. Lists return at most 100 latest records: pagination remains a delivery dependency, not an exhaustive listing promise.

## Privacy boundary

Workspace membership AND explicit case membership are necessary to read a case. Workspace ownership or a platform subscription/admin label does not bypass case membership. Case creators become explicit owners, with export permission false. Review, contribution and export grants are distinct. No export endpoint exists here. All SQL values are bound parameters; SQL strings are fixed. Composite foreign keys prevent a site or case membership being assigned to a foreign workspace. FK RESTRICT preserves records rather than silently cascading evidence/account deletion; account deletion/retention workflows require explicit later design. Revocation checks execute on each request. Transactions lock membership rows and use Serializable isolation; conflicts fail rather than retry non-idempotent creation. Invitation/revocation must later use the same authorization and transaction conventions.

No private evidence is inserted into the public source/search pipeline. No OCR, embeddings, PDF or other third-party processor receives workspace content. Public assets remain unchanged. Audit rows are recorded transactionally for creation; this is an application audit, not cryptographic tamper-proof storage.

## Schema and verification

Prisma schema and an additive migration are included together. Migration was generated with Prisma diff from main `1c8437abbf140ce7aee4016a7b34712b6bef9cb4`, plus explicit PostgreSQL CHECK constraints (retain these because Prisma cannot express them). Never run db push on production to bypass migration review.

Run in nextjs_space after normal dependency installation:

```
npm run test:workspaces
npx tsc -p tsconfig.workspaces.json
npx prisma validate
```

Tests apply the real SQL migration to an isolated in-memory PostgreSQL engine (PGlite), not a mocked SQL repository. They cover two workspaces, case/site mismatch, explicit membership, viewer denial, case/workspace revocation, parameter-bound injection-shaped title, role/export policy, input validation, rollback and audit count. They use synthetic users only. This does not replace hosted PostgreSQL concurrency, authenticated browser or Next runtime integration testing. Scoped strict TypeScript includes routes, service, real authentication and Prisma adapter. No full application build or production tests are claimed.

## Release / next gate

Keep flag absent/false until staging migration, backups/rollback plan, per-account browser tests, CSRF/request-limit runtime checks, rate limits/creation quotas, membership lifecycle and monitored retention controls are approved. Create/list writes have no idempotency token yet: clients must not auto-retry an ambiguous network failure. Disable the feature flag to remove endpoint access on rollback; retain tables and data, do not drop them. Production migration/deployment is not authorised by this PR. Reconcile #7, #19–22 and #14/#23 separately; none are silently merged by this change. Export hardening is a separate PR, not enabled through this API.
