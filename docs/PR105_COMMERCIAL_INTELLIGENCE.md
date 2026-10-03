# PR 105 — Commercial intelligence

Work label PR 105. GitHub assigns the pull-request number. This is a draft. It is not merged and not deployed.

## What a customer can do in this draft

An organisation can hold more than one portfolio. A portfolio can hold many assets. A second user can be allowed into one portfolio and refused the other. A third organisation cannot see either.

Each attached record keeps the source, the event date and the publication date separately, the geography of the record, and why it was attached. Finance and legal see the same fact and a different question. Neither question is a conclusion.

An issued PDF and XLSX keep the snapshot used to generate them. A later failed source check does not rewrite that issue, and a failed check is not stored as “no change”.

## What was already in the repository

Inspected on `release/qa-pr70-pr72` (`32d0646504b84db3d9d62700d48f0e82875ec5ec`).

`docs/DEVELOPMENT_WORKFLOW.md` and `docs/CURRENT_HANDOVER.md` are not in the repository. `docs/CURRENT_STATE.md` is present and dated 19 September 2026. `AGENTS.md` is present.

Reusable, and left in place:

- `PrivateWorkspace`, membership, revocation and audit
- public `Asset`, `ChangeRecord`, `SourceDocument`, `DatasetCoverage` for ports, rivers and other published places
- `pdf-lib` brochure and case-file rendering
- `jszip`

Not reused as the customer asset, because the public `Asset` table is not organisation-scoped and carries a priority score. Customer properties are new tables. `CommercialSignal` already means a sales opportunity on a raw ingest. It was not reused.

Open pull requests 102, 103 and 104 are reference copies under `demonstrators/`. This branch does not touch them. Pull request 101 changes the landing page. This branch does not.

## Schema

Migration `20261003_commercial_intelligence` only creates tables. Rollback is to drop those tables. It has not been applied to any shared or production database.

## Sources that were read

| Asset | What was read | What was not done |
|---|---|---|
| Central Bank, North Wall Quay | Contact page address D01 F7X3. Campus page: BREEAM Outstanding at design stage. | No coordinate. Not treated as an operational certificate. |
| Lands adjacent to Bracetown | Coonan listing, 16 March 2023, stating E2/E3 zoning. | The development plan PDF was not retrieved. Stamullen’s flood study was not attached. |
| Dundrum Town Centre | Irish Times, 18 August 2025. BreakingNews.ie, 27 November 2025. | The planning order was not retrieved. The two articles are one matter, not two independent signals. |
| Intel, Collinstown | EPA application form P0207-05, received 26 November 2019, Eircode W23 CX68. EPA clerical-amendment scan: granted 17 November 2022, amended 5 June 2024. | The scan’s register number reads PO207-05. It was not silently matched to P0207-05. No personal contact details were copied. |
| Dublin Port | Masterplan 2040 review page: €1 billion planned; inland-port works commenced beside the airport. | Planned was not called delivered. The inland port was not called the port estate. |

Nine registry entries have a retrieved passage or an explicit non-attachment. Fifteen further priority types, and sixteen more names, are in the registry as `NOT_CHECKED`. They are not live feeds.

## Tests

`node --import tsx --test tests/commercial-intelligence.test.ts`

Passed on 3 October 2026, locally, against PGlite. Not a GitHub Actions run. Not production Postgres.

Measured in that PGlite process, not extrapolated:

- 50 assets inserted through the service: 68 ms
- 450 further fixture rows inserted by SQL: 9 ms
- portfolio summary of those 500 fixtures: 20 ms

The 500 rows are named scale fixtures and contain no evidence.

## Reports

`docs/commercial-pr105/finance-brief.pdf` and `finance-brief.xlsx` are the demonstration issue from that test. The PDF text is in the file (compressed hex strings were decoded and checked for the design-stage sentence, the port plan, and the refusal to call an asset at risk). The workbook has six sheets, a frozen header, and the EPA URL. They were not opened in Excel or a print preview.

## Not done

- Not merged. Not deployed. No production migration. No billing change. No ingestion restart.
- No map. No filterable asset grid. The new page lists portfolios the account can see, and only when private workspaces are enabled.
- No twenty live adapters. No national completeness.
- No language model, so there is no token cost to record. Sentences are templates.
- No screenshot of a running site.
- `next build` was not run for this branch.
