# Issue 3: scoped identity and date follow-up — 9 September 2026

## Coordination
Read issue #3, AGENTS.md, current main 1c8437abbf140ce7aee4016a7b34712b6bef9cb4 and relevant open PRs. Stack on #7 head 8e19592d0175ed31cc65ce6b65c0ffddc76281bc, retaining #5's existing source-review and event-date-fallback fixes. PRs #1/#2 remain untouched: no duplicate register or collector. Checked #21/#29 file lists for overlapping ingestion changes; none found. Later feature branches and unrelated v20 work are not overwritten.

## Supporting implementation passages and decisions
- [main verify.ts](https://github.com/bcromer77/bioveracity/blob/1c8437abbf140ce7aee4016a7b34712b6bef9cb4/nextjs_space/lib/ingest/verify.ts), assessCandidate: identifier branch uses `if (match)` to AUTO_VERIFY; next branch uses resolved place plus trusted URL. Neither establishes claim support. Retain #5/#7's HUMAN_REVIEW requirement.
- [main normalise.ts](https://github.com/bcromer77/bioveracity/blob/1c8437abbf140ce7aee4016a7b34712b6bef9cb4/nextjs_space/lib/ingest/normalise.ts), recordDate: fallback includes c.publishedAt and c.retrievedAt. Different facts must not become event/measurement dates. Retain earlier fix.
- [PR7 resolve.ts](https://github.com/bcromer77/bioveracity/blob/8e19592d0175ed31cc65ce6b65c0ffddc76281bc/nextjs_space/lib/ingest/resolve.ts), identifier query and alias loop: verified values are not scoped by authority/type/jurisdiction, and first unique alias wins. Decision: require explicit scope and agreement across every supplied hint.
- [PR7 schema-2-1.ts](https://github.com/bcromer77/bioveracity/blob/8e19592d0175ed31cc65ce6b65c0ffddc76281bc/nextjs_space/lib/ingest/schema-2-1.ts), pickDate: new Date(s) is still used by normalisation's permit/project/validity fields. Decision: month/year and invalid calendar dates cannot be converted into exact days where no precision carrier exists.

These are implementation-source reviews, not new environmental claims. Test sources and records are synthetic; no source acquisition timestamps or factual records are fabricated.

## Changes and producer contract
- All identity hints require jurisdiction. IDs additionally require identifier_authority and identifier_type (camelCase aliases accepted by ingestion). Never guess a namespace from a website. One namespace applies to the identifier list; mixed namespaces need review.
- Every identifier must have a verified row in that namespace/jurisdiction. Every alias must match verified aliases there. Names/slugs must agree too. Missing, unverified, ambiguous or contradictory hints remain unresolved/private. Identity never verifies a claim.
- Only event_date/eventDate supplies chronology position. Unqualified date is ambiguous and no longer accepted. Publication/retrieval fields and raw source remain on the candidate.
- Event month/year precision remains preserved by #7. Padded storage anchors are not known days and must use the existing precision-aware formatter.
- Measurements with unknown/coarse dates stay in review. Grant/expiry/validity/project dates must be valid exact calendar dates; partial, invalid, conflicting or timestamp-format values stay in review rather than being silently coerced. No schema migration added.

## Executed validation
- Explicit application check: node_modules/.bin/tsc --noEmit --incremental false — passed on isolated PR7 sources plus the patch.
- node --import tsx --test --test-concurrency=1 tests/evidence-*.test.ts tests/ingest-integrity.test.ts — 27 passed, 0 failed.
- Includes seven new regressions plus existing URL/identifier non-verification, exact source-excerpt review and in-memory PostgreSQL/pgvector tests. Provider requests are mocked. No app database credentials were loaded.
- Initial parallel run passed 26 but hit a V8 JIT allocation crash in evidence-search.test.ts. The full sequential rerun passed.
- The local execution service then became unavailable during final file readback. The already-tested code patch was reconstructed from the exact executed edit content for GitHub publication; a final post-publication rerun was not possible. Abacus must rerun the commands on the published commit. Audit SQL is supplied as guidance only and was not executed.

## Read-only existing-record audit
Use issue-3-readonly-audit.sql only on an authorised read-only snapshot/replica after checking schema. It is bounded triage, not findings of falsehood or a repair script. A date equalling publication time is a flag, not proof of error; follow up beyond 500 rows if the limit is reached.

For each flag, inspect retained original document/passage. Record candidate/destination IDs; source URL/document hash/locator; old and proposed claim/type/event date/precision; separate publication/retrieval dates; identifier namespace/jurisdiction; named reviewer and supporting/rejecting explanation. Keep unsupported event dates unknown and ambiguous identities unresolved. Preserve old review and source version. Produce a dry-run correction manifest for approval. Never silently rewrite/delete production history or bulk promote candidates.

## Abacus handoff and remaining acceptance
1. Integrate only this bounded diff into the existing #7-based preview. Rerun validation on the published commit. Test producers with explicit identity scope; conflicting hints must remain private. Missing scope intentionally reduces automatic resolution.
2. Verify month/year Event cards display no false day, and unknown dates remain in review. Capture expected/actual results and commit SHA without private source text or credentials.
3. Before closing #3, complete the legacy admin publication audit: it records free-text verification rationale and publishes previously stored normalisedPayload. Bind reviewed claim/source/date/evidence type to what is actually published; test stale/changed review rejection and publication retry/transaction behaviour. This bounded patch does not modify that separate lifecycle endpoint.

The newer EvidenceReview path already has explicit source/claim/publication checks and exact retained-excerpt validation; do not replace it. Issue #3 stays open pending the legacy lifecycle acceptance and preview checks. Status: PR prepared, not merged, deployed or live verified. Deployment route and rollback still need Abacus confirmation. No production seeding, migration or deployment is authorised by this handoff.
