# Scout schema 2.1 delivery

## Problem and scope

The 13 September 2026 digest reported 13 staged payloads and no POSTs because
`BIOVERACITY_INGEST_URL` and `BIOVERACITY_INGEST_KEY` were absent in Scout.
This directory supplies an executable delivery runner and operating contract.
It does **not** configure a ChatGPT automation's environment, recover another
session's files, install a scheduler, or establish live delivery by merging a PR.

Inspected application base: `main` at
`1c8437abbf140ce7aee4016a7b34712b6bef9cb4`. The existing schema 2.1 route is
`nextjs_space/app/api/ingest/grok/route.ts`. It expects the header
`x-bioveracity-ingest-key`, with the same key configured on the receiving server.
The reviewed evidence intake introduced by PR #5/#7 is a different contract;
do not send schema 2.1 payloads to `/api/ingest/evidence`.

This standalone Python 3.10+ runner has no third-party dependencies and can be
reviewed against main without merging the unrelated feature branches. It makes
no Next.js, database schema, verification or publishing changes.

## Configure the two runtimes

1. Confirm the deployed release and that its `/api/ingest/grok` route uses the
   inspected contract. Record the deployment checkpoint and rollback reference.
2. In the receiving application's **server secret settings**, configure
   `BIOVERACITY_INGEST_KEY` using the existing approved secret-management route.
   Preserve existing consumers; do not rotate their key casually.
3. In the runtime actually executing Scout, configure that matching key and
   the confirmed full HTTPS URL. `env.example` is a placeholder, not an env loader.
   Neither variable belongs in browser settings, a prompt, a digest, a PR or logs.
4. Confirm that Scout has an authorised outbound HTTPS path to the endpoint and
   durable private storage for payload files and the SQLite ledger. A GitHub
   repository secret is not automatically available in a ChatGPT task.
   If that runtime cannot receive secrets or retain files, move the sender to an
   approved persistent worker; do not embed credentials in automation text.

## Validate and replay

Recover the **original full JSON files** from the originating Scout runtime first.
The digest text is not a substitute. Its reported
`/workspace/bioveracity-delivery/*-2026-09-13/payloads` directories were unavailable
in the implementation session. No real payloads were reconstructed or committed.

From the repository root, after configuring runtime secrets:

```sh
python3 scout/scout_delivery.py \
  --payload-dir /absolute/private/watch/payloads \
  --ledger /absolute/private/scout/receipts.sqlite \
  --dry-run

python3 scout/scout_delivery.py \
  --payload-dir /absolute/private/watch/payloads \
  --ledger /absolute/private/scout/receipts.sqlite \
  --limit 1
```

Repeat `--payload-dir` for each of the five actual directories. Paths must exist;
each immediate `*.json` file must contain one envelope, not a batch or digest.
The sender checks an explicit schema version 2.1, non-empty observation objects,
object-shaped sections and a 2 MiB file limit. This is a conservative preflight,
not factual verification or a replacement for server validation.

After inspecting the first receipt and its raw record in the authenticated ingest
monitor, rerun the same command without `--limit 1` (default 100 new attempts).
Acknowledged files are skipped using the persistent endpoint-scoped ledger.
The server fingerprint guards identical retries after a crash. Keep source bytes
unchanged: changing retrieval times during a retry defeats duplicate protection.
Do not run independent ledgers concurrently against the same backlog.

The runner never deletes source files. Back up the private payload directory and
ledger with the worker's normal durable-storage policy. Run it from the existing
watch delivery step only after its host, secrets and storage are configured;
this PR adds no scheduled execution.

## Receipt meanings and recovery

| Outcome | Meaning / action |
| --- | --- |
| `validated_only` | Local preflight passed. No request made. |
| `intake_acknowledged` | API returned 2xx, `success: true` and `rawIngestId`. Raw intake only. |
| `already_acknowledged` | This endpoint and exact file previously received an acknowledgement. No new POST. |
| `retry_pending` | Network failure, 429 or server error without a retained raw ID. Batch stops; rerun after recovery/backoff. |
| `auth_blocked` | 401/403. Batch stops; repair runtime credentials before rerunning. |
| `stored_needs_attention` | API reports a failed stored row. Held without automatic replay; investigate that raw ID. |
| `response_needs_attention` | Invalid/unexpected response, redirect or other rejection. Investigate before rerun. |
| `invalid_payload` | File could not be read or did not pass local validation. Recover/correct the source file. |
| `remaining_unattempted` | Files outside the current bound or left after a stopped batch. Completion is not claimed. |

Exit codes: 0 means selected work was acknowledged/already acknowledged (or locally
validated in dry-run mode); 1 means unfinished/failed work; 2 means configuration
or command usage is invalid. Digest counts must retain these distinctions.
Do not report `already_acknowledged` as today's newly delivered count.

The legacy duplicate response contains no processing status. Therefore even an
acknowledged duplicate may refer to a previously failed row (for example after a
lost response). A receipt is **never** proof of completed interpretation,
verification, publication or search eligibility. The sender holds failures it
actually observed but cannot diagnose unknown server state from this response.
For held rows, an operator must inspect/repair the stored interpretation and
record the resolution; do not delete a ledger row or change the payload merely
to force a POST. No automatic repair of partial server records is included here.

Redirects are refused so the key is not forwarded. HTTPS certificate verification
uses Python defaults. The runner logs aggregate counts only, not keys, payloads or
server error text. Each request has a 30-second timeout and no immediate retry loop;
respect server limits by delaying the next scheduled/manual run.

## Acceptance and handover

Codex owns this repository change. The deployment/Scout-runtime operator must
complete the configuration steps above. Bazil retains deployment authority.
No deployment, migration, production POST or automation change was made.

Before claiming the incident resolved, retain evidence of:

1. One original staged file passing local validation and receiving a raw ID.
2. That raw row and all expected observation candidates being persisted.
3. Required source-passage and permission review, then permitted publication or
   reviewed-search registration under the actual deployed pipeline.
4. A signed-in source-linked search result for the reviewed record. The legacy
   raw endpoint alone does not implement the newer evidence search connection.
5. All 13 files reconciled by outcome and the next scheduled run delivering
   successfully, with missed industrial runs and prior backlog accounted for.

Verification in the implementation session: Python 3.12.14; 12 `unittest` tests
passed, using temporary SQLite ledgers and controlled HTTP responses; Python
bytecode compilation passed. Run from the repository root:

```sh
python3 -m unittest discover -s scout -v
python3 -m py_compile scout/scout_delivery.py scout/test_scout_delivery.py
```

Tests cover configuration, redirect refusal, request bytes/header, receipt
persistence, endpoint isolation, bounded replay progression, network retry,
authentication/rate-limit batch stopping, failed stored records, invalid files
and false-success responses. These are isolated sender tests, not a live API,
production database or end-to-end search test. No TypeScript changed; application
type checking and the hosted production build were not run for this Python-only
addition. Confirm the deployed contract before activating it.
