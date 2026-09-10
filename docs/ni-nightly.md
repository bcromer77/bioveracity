# Northern Ireland nightly staging

Implementation: 10 September 2026. Based on the existing unmerged council-history-honeycomb collector, commit 87f11bed534ff411ed664700fff1b92195cb1afc. This PR is stacked on that branch; it does not merge other work or activate production.

All 11 council identities reuse the council register. Homepage URLs were checked against the official NI Direct directory: https://www.nidirect.gov.uk/contacts/local-councils-in-northern-ireland . Host/page responses and reuse terms still need live review. These are discovery seeds, not verified planning/enforcement feeds.

Each run attempts at most two HTML pages per council, with robots checks, HTTPS host restrictions, at most 1 MiB per response, and sequential source requests. PDF, OCR, semantic embeddings, LLMs and production delivery are excluded from this runner. Each council gets a separate allowance so one busy council cannot consume all slots. Failed sources are recorded, not described as no activity. A five-minute collection timeout can interrupt the run; a timeout is not successful coverage.

SQLite preserves originals, versions and source locators and maintains a current-passage FTS5 keyword index. Publication/event dates stay unknown. The regional output is coverage.json and summary.txt, not an environmental prediction or trained model. Homepage/navigation changes are unreviewed source versions, not verified environmental events. No external database or Next.js application is modified.

State uses a best-effort GitHub Actions cache with separate branch keys. It is not a backup or durable evidence archive; eviction causes recollection. Never put private case data in this cache (PR workflows may read base-branch caches). At 32 MiB before a council refresh, collection stops for that council pending operator maintenance; a refresh can overshoot this threshold. Reports retain three days and contain coverage counts only. Cache capacity and artifact storage share account constraints.

## Activation

1. Review/land the collector dependency and this workflow on the repository's default branch using the approved integration route. Scheduled workflows only run from the default branch. Do not wholesale merge unrelated branches.
2. Confirm Actions is enabled and the account has sufficient INCLUDED Linux minutes, cache and artifact storage. Set a stop-spending Actions budget/account control before activation; this workflow cannot inspect or enforce the account bill. Do not enable paid overages. No promise of absolute zero cost is made.
3. Set repository variable NI_NIGHTLY_ENABLED=true. This is the explicit spending-capacity gate. No API keys or database secrets are needed.
4. Manually run Northern Ireland daily staging and inspect the real coverage report. Then observe the first scheduled run, nominally 03:23 UTC daily (04:23 Irish summer time). GitHub schedules can be delayed or dropped; not an exact 24-hour SLA.
5. To stop, set NI_NIGHTLY_ENABLED=false or disable the workflow. Production remains unchanged.

At the eight-minute job cap, 31 scheduled runs consume at most roughly 248 runner minutes plus rounding and separate PR/manual runs; this is a bound, not measured usage. Standard-library-only HTML collection avoids package installation and paid services. Confirm actual account allowance at https://docs.github.com/en/billing/concepts/product-billing/github-actions .

## Validation

Run python -m unittest discover -s tests -v and python -m compileall -q collectors tests. The new tests verify all 11 councils are attempted despite an individual failure, repeated content does not create duplicate versions, FTS indexing works and no embeddings are written. Tests use synthetic evidence; they do not prove live council access or full coverage. Existing collector tests also run. No TypeScript changed, so no application build is claimed.

## Next integration boundary

Before live-site updates: validate targeted committee/planning/news feeds and reuse permissions, approve durable evidence storage and the production intake route, then deliver only to an authenticated review queue. Source collection does not authorise publishing allegations. The separate ChatGPT council research automation, if still enabled, must not be described as this workflow.
