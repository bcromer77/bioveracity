# Cambridge demo: source brief and station rainfall

## Delivered

Case route: /regions/cambridgeshire-peterborough/cases/march-liming-2025. Reached from March Place History, with regional-map and reviewed-search links. A print/save-PDF button uses browser printing; this is a case brief, not a statutory dossier. It distinguishes the 9 July 2025 publication from scheduled 27 July–22 September operational milestones. All three entries depend on the same statement. Actual cessation, restart and improvement remain unconfirmed.

Original: https://www.marchtowncouncil.gov.uk/anglian-water-march-water-recycling-centre-pausing-liming-work-for-the-summer-holidays/ . Read the opening statement and the paragraph beginning To support the community. The content is Anglian Water's statement republished by the council. No document is externally embedded by this feature.

Station rainfall: /api/physical/rainfall accepts only three inspected station keys (chatteris, fleam-dyke, uttons-drove), a real date and 1/7/30 days. Public EA OGL data; no API key or new database. Place History offers these as named-station context for March WRC, River Cam and Milton WRC. This is not a validated site/catchment rainfall mapping. Users explicitly load data; errors never yield synthetic values. Daily provider dates, quality/completeness flags, coordinates, source and licence are retained. Missing values stay null. Daily accumulation boundaries have not been aligned with exact incident times, so no preceding-72-hour total is claimed.

Fair use: fixed upstream, 15-second timeout, bounded query/result size, 100-entry one-hour cache and one upstream call in flight per process. A multi-instance production installation needs a shared concurrency/rate-limit policy before broad rollout. No scheduled collection or database archive is enabled by this route. Freshness is the last retrieved timestamp, not a claim of live telemetry.

## Evidence repair

scripts/audit-march-case.ts defaults to read-only dry run against the configured database. Exact old title/date matches only; different existing source URLs are left for manual review. No duplicate deletion. Same-day groups are listed as review candidates, not asserted duplicates. Approved --apply requires --out=<audit.json>; creates an exclusive new audit file containing old values before a transaction and checks for concurrent record changes. Keep the audit securely with the deployment records; do not commit database dumps. Re-running after successful title corrections proposes no repeat changes.

Seed scripts now use scheduled-milestone language, include source URLs for these entries and avoid setting them verified. Existing asset summaries/divergences are not repaired by the Event correction script: audit those separately before demoing their claims. None of the seed/correction scripts was executed against a database in this work.

## Verification completed

- Nine focused tests passed (rainfall validation, missing/zero/quality behaviour, duplicate/wrong-series rejection, source correction conservatism/idempotence, existing date-grouping boundaries).
- Explicit local TypeScript check passed with current remote versions of touched files.
- Case component server-rendered successfully with its forecast labels, source URL, print control and rainfall control.
- Live EA fetch through the implemented TypeScript adapter returned seven daily readings dated 20–26 July 2025 for each named station. Provider flags: Chatteris Unchecked; Fleam Dyke Suspect; Uttons Drove Good. These statuses must remain visible; do not describe all returned data as verified.
- Local browser navigation was blocked by the browser environment (ERR_BLOCKED_BY_CLIENT). Desktop/mobile rendering and print output have NOT been visually approved.

## Abacus: one bounded preview task

Integrate this PR (it includes PR18 as an ancestor) and open the case route. Load Chatteris rainfall before 27 July 2025; check seven provider-date rows, flags, source links and missing-data states. Change stations/days and ensure old results disappear. Print the brief and inspect all pages, including any loaded rainfall and attribution. Inspect March Place History at 390px and desktop width, including navigation to the brief. Run TypeScript and the three focused test files. Run the March audit in dry-run mode only and review the proposed source/date corrections; do not execute seeds. Report screenshot/print problems and remaining data issues. Confirm deployment route, rollback and approval before production writes or deployment.

This closes a narrow software gap. River telemetry, odour/wind evidence, sensitive-data workflows for new sources, ordinary-account vector retrieval demonstration and pilot outcome measurement remain distinct work.
