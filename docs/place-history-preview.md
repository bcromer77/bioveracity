# Place History preview handoff

The shared regional map now includes a Place History panel. It consumes only the chronology already supplied to the page; no new API, source permission, index, import or data access path is introduced. Any future caller must authorise its records on the server before passing props. This component is not an access-control mechanism.

Select a map place, choose an anchor record with explicit day precision, and inspect before/same-day/after within 1/7/30/90 days. Approximate, missing and invalid dates remain unplaced. The panel deliberately reads all loaded records for the selected place independently of the existing replay/category window so later evidence remains available. This scope is labelled in the UI. Source links and existing evidence types are retained; descriptions are record summaries, not automatically verbatim supporting passages.

Verification: three node tests cover cross-year boundaries, window edges, cross-place exclusion, uncertain/impossible dates, invalid anchors/windows and unsafe source schemes. Explicit TypeScript check passed against the local working application with the current remote operating-picture file. Full current-branch build and rendered browser QA remain for the hosted preview.

Preview checks: open Cambridge live view; choose two different places; select an anchor from the dropdown and a chronology card; vary the window; inspect empty/uncertain groups; open source links; confirm map focus follows selection. Check desktop and mobile scrolling, contrast and keyboard controls. Ensure existing question panel and chronology remain usable. Do not deploy until the deployment route and rollback are confirmed.

Enniscorthy research is PR #16. It is intentionally not loaded into runtime before reuse and review checks. No rainfall chart, river measurements, automatic event similarity, recovery assessment or hysteresis detection is claimed. Next bounded task: approve and ingest the documented case in isolated storage and validate one licensed rainfall series with station metadata and missing-data handling.
