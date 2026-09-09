# PDF export containment — issue #24

This patch repairs the legacy public-report endpoint. It does **not** implement private case exports, original retention, redaction, workspace permissions or evidential manifests.

## Changes
- Both routes require a session and reload the account from the database. Deleted accounts cannot poll; current institutional entitlement is checked again for full reports.
- `request_id` returned to the existing client is now an AES-256-GCM encrypted receipt containing owner, upstream job ID, report kind and a 15-minute lifetime. The upstream ID is never accepted directly or exposed in plaintext. No schema migration required.
- Missing configuration fails closed. Requests/replies and provider calls are not cached. Provider details are not reflected in error messages.
- Body is capped at 1 MiB while streaming; arbitrary client PDF options are no longer forwarded. Private case/workspace context is rejected explicitly.

## Operator gate / deliberate compatibility change
PDF generation is disabled by default. Before any deployment, review the external provider's processing/retention and HTML-rendering/network-isolation arrangements, then explicitly configure `PUBLIC_PDF_EXTERNAL_PROCESSING_ENABLED=true`, a random 32-byte hex `PDF_JOB_ENCRYPTION_KEY`, and the existing `ABACUSAI_API_KEY` in the deployment secret manager. Never commit values. Existing raw job IDs stop working and users must regenerate. Key rotation revokes outstanding receipts.

The generic endpoint still accepts client HTML if enabled. It cannot determine whether arbitrary HTML contains confidential material. Consequently **do not enable it as a private-workspace export facility**; field rejection is not a confidentiality classifier. Keep private-workspace UI away from this flow. A dedicated server-generated export must bind case membership and permissions to persistent jobs and recheck before polling/download. Receipt expiry is not deletion of material retained by the external provider.

The receipt is owner-bound, not a bearer-only download token. Replay by the still-authorised owner is allowed within 15 minutes. Individual job revocation/audit requires persistent job records in the future. Account reload supports deletion/entitlement revocation, not case-membership revocation; no case is supported here.

## Validation and release
Run `node --test nextjs_space/tests/pdf-job-access.test.mjs`. Run explicit JS/TS checks and full application typecheck in the integrated branch. Tests exercise handlers with fake actors/provider only; no live data, credentials, provider calls or migration. Full hosted session/database behavior must be smoke-tested before release. Confirm specific Abacus deploy and rollback route. No merge or deploy performed by this patch.
