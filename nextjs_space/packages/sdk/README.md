# @bioveracity/sdk — BioVeracity Developer Platform V1

> Integrating with BioVeracity should be boring. Evidence integrity should not be.

The BioVeracity Developer Platform is the SDK-first ingestion boundary: a small,
versioned, stable contract for submitting **evidence** and reading back exactly
what BioVeracity stored. This SDK is a *thin delivery client* — authentication,
typed request/response objects, timeouts, safe retries, idempotency, request IDs
and structured errors. It contains **no** environmental analysis or
source-specific business logic; every producer maps its own native shape onto the
one canonical `EvidenceCreate` contract.

This guide gets you from zero to your first accepted evidence submission in under
ten minutes.

---

## 1. What you need

- An API key. Keys look like `bv_test_…` (test mode) or `bv_live_…` (live mode).
  The two modes are fully isolated: a test key can never read or write live data,
  and vice-versa. Start in **test** mode.
- Node.js 18+ (the SDK uses the built-in global `fetch`).

> The platform is feature-gated on the server via `DEVELOPER_PLATFORM_V1_ENABLED`.
> If health reports `platform_enabled: false`, the endpoints are present but
> disabled in that environment — ask your BioVeracity contact to enable it.

Keep your secret key **secret**. Never commit it, log it, or embed it in a
browser bundle. The SDK sends it only as a `Bearer` token over HTTPS.

---

## 2. Install

The SDK lives in this monorepo at `packages/sdk` and publishes as
`@bioveracity/sdk`.

```bash
# From a workspace that consumes it:
yarn add @bioveracity/sdk
# or, within this repo, reference it via the workspace:
#   "@bioveracity/sdk": "*"
```

---

## 3. Your first submission (TypeScript) — copy/paste

```ts
import { BioVeracity } from '@bioveracity/sdk'

const bio = new BioVeracity({
  apiKey: process.env.BIOVERACITY_API_KEY!, // e.g. bv_test_...
  // baseUrl defaults to production; point at your environment if needed:
  // baseUrl: 'https://bioveracity.com',
})

async function main() {
  // Submit one piece of evidence. The public contract is snake_case and
  // preserves uncertainty: everything except provider/evidence_type/source_data
  // is optional and is NEVER invented when you omit it.
  const evidence = await bio.evidence.create(
    {
      provider: 'my-scout-agent',
      source_external_id: 'my-source/record/42',
      evidence_type: 'community_report',
      // Your raw payload, stored verbatim. Put anything here.
      source_data: {
        note: 'Discoloured discharge observed at the outfall.',
        observed_by: 'volunteer-17',
      },
      // Optional, all preserved exactly as supplied:
      source_url: 'https://example.org/record/42',
      publisher: 'My Organisation',
      retrieval_time: '2026-10-01T09:00:00Z',
      geography: { kind: 'county', name: 'Cambridgeshire' }, // county stays county
    },
    // Idempotency is first-class. If you omit this the SDK generates one so that
    // automatic retries can never create a duplicate; pass your own to make an
    // entire logical submission safely repeatable across processes.
    { idempotencyKey: 'my-source/record/42' },
  )

  console.log('Stored evidence id:', evidence.id)          // ev_...
  console.log('Raw copy id:', evidence.raw_evidence_id)     // raw_...
  console.log('Processing status:', evidence.processing_status)
  console.log('Request id (quote in support):', evidence.request_id)

  // Read back exactly what we stored.
  const fetched = await bio.evidence.retrieve(evidence.id)
  console.log('Provider on record:', fetched.provider)

  // Inspect the full lifecycle of the request.
  const trace = await bio.requests.retrieve(evidence.request_id)
  console.log('Trace stages:', trace.trace.map((t) => t.stage).join(' → '))
}

main().catch((err) => {
  // Structured errors — see §6.
  console.error(err.type, err.code, err.message, err.requestId)
  process.exit(1)
})
```

Expected console output (ids will differ):

```
Stored evidence id: ev_a1b2c3...
Raw copy id: raw_a1b2c3...
Processing status: RAW_PERSISTED
Request id (quote in support): req_a1b2c3...
Provider on record: my-scout-agent
Trace stages: received → authenticated → validated → raw_persisted → evidence_id → processing
```

---

## 4. The same thing with `curl`

```bash
curl -sS https://bioveracity.com/api/v1/evidence \
  -H "Authorization: Bearer $BIOVERACITY_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: my-source/record/42" \
  -d '{
    "provider": "my-scout-agent",
    "source_external_id": "my-source/record/42",
    "evidence_type": "community_report",
    "source_data": { "note": "Discoloured discharge observed at the outfall." },
    "source_url": "https://example.org/record/42",
    "publisher": "My Organisation",
    "retrieval_time": "2026-10-01T09:00:00Z",
    "geography": { "kind": "county", "name": "Cambridgeshire" }
  }'
```

You can also authenticate with `-H "x-bioveracity-api-key: $BIOVERACITY_API_KEY"`
instead of the `Authorization` header.

Expected response body (`201 Created`; ids/timestamps will differ):

```json
{
  "id": "ev_a1b2c3...",
  "object": "evidence",
  "mode": "test",
  "contract_version": "v1",
  "raw_evidence_id": "raw_a1b2c3...",
  "provider": "my-scout-agent",
  "source_external_id": "my-source/record/42",
  "evidence_type": "community_report",
  "publisher": "My Organisation",
  "source_url": "https://example.org/record/42",
  "geography": { "kind": "county", "name": "Cambridgeshire" },
  "observation_time": null,
  "observation_precision": null,
  "publication_time": null,
  "retrieval_time": "2026-10-01T09:00:00Z",
  "source_data": { "note": "Discoloured discharge observed at the outfall." },
  "metadata": null,
  "provenance": null,
  "processing_status": "RAW_PERSISTED",
  "request_id": "req_a1b2c3...",
  "created_at": "2026-10-01T12:00:00.000Z",
  "replayed": false
}
```

Replaying the identical request (same `Idempotency-Key`, same body) returns the
**same** evidence with HTTP `200` and `"replayed": true` — no duplicate is
created. Even without an idempotency key, an identical payload is de-duplicated by
a deterministic fingerprint.

---

## 5. Endpoints

| Method & path                 | SDK call                     | Purpose                                   |
| ----------------------------- | ---------------------------- | ----------------------------------------- |
| `POST /api/v1/evidence`       | `bio.evidence.create(input)` | Submit evidence (raw-first, idempotent).  |
| `GET  /api/v1/evidence/:id`   | `bio.evidence.retrieve(id)`  | Read stored evidence by `ev_*` id.        |
| `GET  /api/v1/requests/:id`   | `bio.requests.retrieve(id)`  | Read a request's full lifecycle trace.    |
| `GET  /api/v1/health`         | `bio.health()`               | Unauthenticated liveness / readiness.     |

`retrieve` is scoped to your key and mode: you only ever see your own evidence in
your own mode.

---

## 6. Errors

Every error — from any endpoint — is the same JSON envelope:

```json
{
  "error": {
    "type": "validation_error",
    "code": "invalid_request",
    "message": "Required",
    "param": "provider",
    "request_id": "req_a1b2c3..."
  }
}
```

In the SDK these arrive as a thrown `BioVeracityError` with `.type`, `.code`,
`.message`, `.param`, `.requestId` and `.status`:

```ts
import { BioVeracity, BioVeracityError } from '@bioveracity/sdk'

try {
  await bio.evidence.create({ /* missing provider */ } as any)
} catch (err) {
  if (err instanceof BioVeracityError) {
    console.error(err.type)       // "validation_error"
    console.error(err.code)       // "invalid_request"
    console.error(err.param)      // "provider"
    console.error(err.requestId)  // quote this to BioVeracity support
    console.error(err.isRetryable)// false for validation errors
  }
}
```

Error types you may see: `authentication_error` (bad/missing/revoked key, HTTP
401), `permission_error` (key lacks the required scope, HTTP 403),
`validation_error` (bad input or unknown id, HTTP 400/404),
`idempotency_error` (an idempotency key reused with a different payload, HTTP
409), `rate_limit_error` (slow down — HTTP 429, see below), `api_error` (an
unexpected server fault, HTTP 500), `api_unavailable_error` (a downstream
dependency is temporarily unavailable, HTTP 503), `connection_error`
(client-side network/timeout).

### Retries & idempotency

The SDK automatically retries **transient** failures (network errors, timeouts,
HTTP 429 and 5xx) with exponential backoff and jitter, up to `maxRetries`
(default 2). It **never** retries validation or permission errors. On a `429` it
honours the `Retry-After` header. Because one logical `create` call reuses a
single `Idempotency-Key` across all its retries, retries can never duplicate
evidence. Tune per-client or per-call:

```ts
const bio = new BioVeracity({ apiKey, timeoutMs: 15000, maxRetries: 2 })
await bio.evidence.create(input, { timeoutMs: 30000, maxRetries: 0 })
```

---

## 7. Test mode vs live mode

- Keys are prefixed `bv_test_` or `bv_live_`; the mode is baked into the key.
- The two modes are **completely isolated** data spaces. Test submissions never
  appear in live, and live keys cannot read test data.
- Every `evidence` object echoes its `mode` so you can assert you are where you
  think you are.
- Do all integration and load testing with a **test** key. Switch the key value
  (not your code) to go live.

---

## 8. Design principles (why the contract looks like this)

- **Raw-first.** Your exact submission is persisted verbatim (`raw_evidence_id`)
  *before* any interpretation. A downstream processing failure can never destroy
  what you sent — you will still get an evidence id, with a `processing_status`
  that tells the truth.
- **Uncertainty is preserved, never invented.** Optional fields left blank stay
  blank. County-level geography is stored as county-level; the platform does not
  silently promote it to a town or a point.
- **The contract is versioned.** Everything carries `contract_version` (`v1`).
  Additive change only; your integration will not break underneath you.
- **The SDK is thin.** It delivers and reads. All environmental judgement lives
  behind the boundary, not in your client.
