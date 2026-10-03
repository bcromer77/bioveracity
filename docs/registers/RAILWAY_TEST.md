# Controlled railway tests

Defined only. **NOT RUN.** Do not execute either test under the 3 October documentation authorisation. Do not replay NPWS Train #001. Do not point either test at production.

These tests are not satisfied by a case-file upload. A case upload is Alice's journey. A railway journey starts at a source.

The first execution, when separately authorised, uses an isolated application database and an isolated evidence database. It does not collapse them. It uses one fixture whose source URL, retrieval time and raw bytes are recorded. It does not call a live source unless that call is itself authorised.

## Railway A — one successful journey

Not run. The identifiers below are the names the tester must write down. They are not values invented in advance.

| Stage | What must exist before the next stage | Identifier to record |
|---|---|---|
| Source | A named source, a URL, and the bytes or response that were retrieved. A dry run is not this stage. | source name, source URL, retrieval time UTC, content hash |
| Receipt | The system has stored that it received those bytes, separately from any later interpretation. | receipt id or equivalent row id, hash equal to the source hash |
| Raw evidence | The raw payload is retained and can be opened. It is not only a normalised row. | raw evidence id, location, hash |
| Processing | A processing record says what was done, and whether it finished or failed. | processing id, status, start and finish time |
| Canonical evidence | A canonical row was written only after processing finished. It points back to the raw id. | canonical id, foreign key or recorded link to the raw id |
| Provenance | A person can see the source URL, the retrieval time, and the raw id from the canonical row. | the screen or API body that shows all three |
| Search | A search for a unique sentence that was in the raw bytes returns the canonical id and no other tenant's id. | query, result ids |
| Report | A report includes the canonical id and the source URL, or it says the evidence is missing. It does not invent a sentence that was not in the raw bytes. | report id, quoted sentence, source URL |

**PASS.** Every identifier above is filled, the hashes match, and the report sentence is in the raw bytes.

**FAIL.** A stage is skipped, the hash changes without a recorded reason, the report contains a sentence that was not retrieved, or search returns another tenant's id.

**BLOCKED.** The isolated databases are not authorised, the fixture is not chosen, or a required id has no column in this candidate. A missing column is BLOCKED and is written into the migration register. It is not filled by a schema change during the test.

No specific external record is named here. Naming one would pretend the test had a source. Choose the fixture when the test is authorised, and write its URL into the acceptance register at that time.

## Railway B — a source that fails

Not run.

**Setup.** One retrieval that fails on purpose: a refused connection, an HTTP error, or a connector status other than success. Do not delete a successful row and call that a failure.

**Required observation.** The stored state and the customer-visible state both say the retrieval failed. The words may be the product's own words. They must not be interchangeable with:

- a successful retrieval
- zero results from a successful retrieval
- no change, meaning the same evidence was fetched again
- no evidence found, meaning the source was read and did not contain the thing

**PASS.** A reviewer can tell, from the screen and from the stored row, that the operation failed, and no canonical evidence row was created for the missing payload.

**FAIL.** The failure is stored or displayed as "no change", "nothing found", an empty success, or a canonical row with no raw payload.

**BLOCKED.** The rehearsal has no way to force a failed retrieval without touching production. Do not use production to create the failure.

## What this candidate already says, and what that does not prove

`nextjs_space/lib/ingest/scotland-pipeline.ts` returns `success: false` and HTTP 207 when a source status is not `ok` or a write throws. Its comment says a client must not advance a cursor unless `writesAcknowledged` is true and `failedWrites` is 0. That is code in the candidate. It is not a test result. It does not prove every other adapter behaves the same way. Railway B exists so that an adapter cannot be waved through on this paragraph.
