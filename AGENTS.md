# BioVeracity project rules

## Purpose

Preserve a source-linked environmental chronology. Distinguish measurements, regulator findings, operator statements, community observations, analytical inference and questions not yet resolved. Cambridge–Peterborough is the lead pilot; awards and school participation are proposed additions.

## Evidence

- Read the actual supporting source passage. A trusted domain or matching asset identifier alone cannot verify a claim.
- Preserve source identity, document location, publication versus event date, time precision and place identity. Never invent timestamps, coordinates, records or partnerships.
- Track dependence: copied articles or shared classroom prompts are not automatically independent observations.
- Do not introduce arbitrary source weights, place ratings, uncertainty scores or a two-source rule for factual verification.
- Say evidence was not located in the sources reviewed unless its absence is established. Do not infer causation from proximity or temporal coincidence.
- Keep demonstrations and illustrative content labelled wherever users could otherwise mistake them for actual records.

## Community and commercial integrity

- Children offer valuable perspectives; they are not inherently unbiased sensors. Use reviewed anonymised themes via school intermediaries, not identifiable child uploads.
- Awards recognise curiosity, observation and learning, not dramatic accusations. Sponsors cannot influence findings, search rankings or access private participant data.

## Engineering

- Preserve unrelated changes and current database records. Source import is not permission to seed, migrate, delete or deploy production data.
- Keep secrets out of code, logs and commits. Use environment templates with placeholders only.
- Use isolated development data. Make ingestion idempotent and corrections auditable; enforce access on the server for search, APIs and reports.
- Add meaningful checks for each behavioural change. Run explicit type checks; a Next build with ignored type errors is not enough.
- Document source coverage, failed retrieval and unsupported integrations honestly. GitHub is the code and work register; controlled evidence storage is separate.
- Confirm the specific Abacus app deployment route and rollback before proposing a production release. Do not enable automatic production deployment without authorisation.

## Agent tasks

Use bounded branches with a problem statement, scope, acceptance tests and handoff. Suggested lanes: source adapters; claim verification; search; community questions; release checks. Persistent scheduling exists separately in ChatGPT and is not activated by this file.

## Development ownership and handover

- Read docs/DEVELOPMENT_WORKFLOW.md and docs/CURRENT_HANDOVER.md before implementation. Refresh branch heads and open PRs; dated handover entries are evidence snapshots, not live status.
- Codex owns ordinary implementation and tests; GitHub holds the authoritative code and work register; Abacus remains the hosting/deployment route for now. One implementation owner per task. During the current parser build repair, Abacus owns that repair until a pushed, tested handover is recorded.
- Push meaningful increments, before changing tools/owners, and at session end. Record the branch and full commit SHA. Push does not mean merge, deployment or live verification.
- Never start from main merely because it is the default: confirm the approved integration base and preserve unmerged work. Do not merge unrelated PRs or launch overlapping scheduled coding.
- Include a proportionate cost/capacity check for features that add paid APIs, storage, recurring jobs or human review; distinguish measured costs from assumptions.
