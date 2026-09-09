# Cambridge question and coverage register

The machine-readable register is `nextjs_space/lib/investigation-questions.ts`: eight families, forty distinct prompts, and evidence requirements. These are test questions, not assertions or pre-written answers. Do not score success by returning any passage: relevance, scope, date and citation support matter.

## Map workflow

The Cambridge operating map starts on River Cam when that place exists. The investigation panel chooses a question family and local topic filter, displays actual loaded record counts and date precision, and submits a custom question to `/evidence`. Place selection scopes the chronology; reset restores all places/topics/dates. The map camera follows the selected place. Other regions do not show the Cambridge-specific question panel.

Loaded map records and reviewed-search records remain separate. Source-link counts do not mean verified or complete. Unknown dates remain unknown; yearly records do not become daily measurements. Selecting a question is not an answer or an automatic causal assessment. Report upload is explicitly not connected.

## Run each of the forty questions

For every `examples` entry, record: tester, date, source collection/version, expected supporting document or expected coverage-gap response, actual returned passages, citation correctness, geographic scope, temporal scope, unsupported assertions, and pass/fail with reason.

The three valid outcomes are: supported answer with citations; partial evidence with limits; or insufficient coverage with a specific next step. An empty result is never proof of no incident. Test misleading premises and outside-region questions. Have a second person add unfamiliar phrasings.

## Evidence work needed by family

| Family | Required collection | Current readiness |
| --- | --- | --- |
| Place | Canonical assets, aliases, area/waterbody identifiers | Map counts computed at runtime; identity correctness requires source review |
| Change | Earlier/later document versions and dated events | Collection coverage must be assessed |
| Claim | Original report, page passages, entity and reporting boundary | Upload not implemented; use approved imported documents |
| Support | Comparable independent records and measurements | Not established by map counts |
| Dependency | Funding changes, conditions, programme milestones | Check Cambridge relocation consent against subsequent funding evidence |
| Incident | Incident timestamp, operator records, weather and monitoring | High-frequency coverage not assumed |
| Connection | Source-backed relationships and validity dates | Do not infer drainage or causation from map lines |
| Gap | Search scope, unavailable sources, requested next evidence | No missing-data-to-zero conversion |

## Small Abacus handoff

Integrate this PR on the evidence integration branch. Run explicit typecheck and `node --import tsx --test tests/investigation-coverage.test.ts`. Open `/regions/cambridgeshire-peterborough/live` with populated preview data. Check River Cam focus, all eight question choices, custom query submission, place selection, reset and empty results. Repeat with no loaded events and at a narrow viewport. Do not enable fictional answers or insert synthetic records into the live database. Capture the preview before deployment.

The previous source-permission, database, approved-corpus and deletion gates still apply. This change adds a navigation and coverage layer; it does not provision sources, implement report upload or certify search quality. No new map provider or Google billing is required.
