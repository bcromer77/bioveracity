# Signal-watch review bundle: Waterford and Anglian Water

Date prepared: 13 September 2026 (day precision)

This change adds two newly reviewed signals as a machine-readable review bundle. It does **not** seed the production database, publish an environmental conclusion or authorise Direct API ingestion.

## 1. Port of Waterford material-amendment application

- Record: `LIC230013MA`
- Parent licence: `LIC230013`
- Publisher: Maritime Area Regulatory Authority (MARA)
- Application received: 9 September 2026 (day precision)
- Supporting technical note: 8 September 2026 (day precision)
- Place: River Suir at Port of Waterford, Belview, Counties Kilkenny and Waterford
- Current state: applied; not yet assessed
- Public consultation: MARA says one may be required, but none is currently announced

The applicant seeks to remove Specific Condition 28 from the existing maritime usage licence. The condition currently prevents the permitted marine site-investigation surveys between 1 November and 31 January to reduce disturbance to known fish spawning along the survey route.

The evidence is disputed rather than settled:

- MARA previously retained the condition under the precautionary principle. Its published reasoning noted limited site-specific inshore fisheries data and warned that absence of records should not be interpreted as confirmation of absence.
- The applicant's new fisheries assessment argues that the works would fall outside relevant spawning areas and would not materially affect habitat, fish movement, underwater noise or water quality.

Those are attributed positions. The application is not approval, and the applicant's environmental conclusions remain subject to MARA's assessment.

Primary sources:

- [MARA application register](https://www.maritimeregulator.ie/application/lic230013ma/)
- [Detailed material-amendment justification](https://www.maritimeregulator.ie/wp-content/uploads/2026/09/Details-of-Material-Amendment.pdf)
- [Parent licence record](https://www.maritimeregulator.ie/application/lic230013/)

BioVeracity opportunity: demonstrate a version-controlled chronology connecting the original licence, public-body observations, licence conditions, supplementary evidence, amendment application, any consultation and the eventual decision. Port of Waterford is only a prospective buyer; no BioVeracity engagement, procurement or available budget is evidenced.

## 2. Anglian Water source-access failure

- Source: [Anglian Water news](https://www.anglianwater.co.uk/news/)
- Retrieval date: 13 September 2026 (day precision)
- Result: HTTP 403 access restriction during direct review
- Coverage: Anglian Water region, including Peterborough and East Anglia

This is a source-health record, not evidence of an environmental event. Search-index results cannot establish that no publication exists. The review period must therefore remain unchecked until an accessible official source can be read.

BioVeracity opportunity: source-health monitoring should preserve failed retrievals and prevent them from being converted into false “no change” conclusions. No prospective buyer or budget is asserted from this failure.

## Review and acceptance

Before any production publication:

1. Re-read each primary source and preserve the supporting passage.
2. Keep the applicant's claims distinct from MARA's findings and future determination.
3. Keep the Anglian Water item outside the environmental chronology unless an actual source record is later retrieved.
4. Deduplicate by source URL, official identifier and substantive change.
5. Preserve the displayed date precision; do not invent publication times or coordinates.

Acceptance is achieved when the JSON parses successfully, both records retain their separate evidence states, and reviewers can trace every factual claim to the listed primary sources.
