# UK and Ireland council register

An offline, source-linked identity baseline for BioVeracity. Built 8 September 2026.

| Jurisdiction | Principal councils |
| --- | ---: |
| England | 317 |
| Scotland | 32 |
| Wales | 22 |
| Northern Ireland | 11 |
| Republic of Ireland | 31 |
| Total | 413 |

`register.json` additionally separates 15 UK combined/strategic authorities found in the upstream snapshot. These are not added to the principal-council total. Coverage means listed identities, not complete websites, scraped records or operational monitoring. Website and asset links intentionally remain empty until sourced. Four pilot source endpoints are inventoried separately; Peterborough returned HTTP 403. Kilkenny's reviewed endpoint covers LCDC only.

## Rebuild and verify

Run `python scripts/build_council_register.py` from the repository root (Python 3, standard library only). The build is offline and deterministic, validates jurisdiction counts, duplicate IDs, county references and endpoint references, and never reads credentials or writes a database. Review new upstream snapshots and count changes before updating the baseline. Application TypeScript is unchanged; this branch does not claim an application build or type check.

## Provenance and limitations

- UK: mySociety's local authority identity crosswalk, pinned by blob SHA in `sources/manifest.json`; complete upstream input retained, including historical rows. Only source-current rows enter the generated register. MIT notice included. Source-reported start dates are not asserted to be legal founding dates. No coordinates imported.
- Ireland: CSO Register of Public Sector Bodies 2024 Final, Table 4.1, published 20 October 2025; names transcribed in `sources/ireland-local-authorities.json`. Count cross-check: https://www.localgov.ie/find-my-local-authority. Irish identity codes are local BioVeracity identifiers; official code alignment remains outstanding.
- England count cross-check: https://www.gov.uk/guidance/local-government-structure-and-elections (page states 317, last updated April 2023).
- Northern Ireland: https://www.nidirect.gov.uk/articles/local-councils (11).
- Scotland: https://www.gov.scot/policies/local-government/ (32).
- Wales principal names: https://www.gov.wales/find-your-local-planning-authority (22 council entries, national parks separate).

This is not independent legal certification of every authority's status on the snapshot date. Reorganisation proposals, shadow authorities and effective changes require authoritative verification and versioned succession relations. Combined-authority membership has not been independently checked and is not imported. Town/parish/community councils, Irish municipal districts, national parks, regional assemblies and other joint bodies require further inventory. Document reuse permissions are not inferred from availability or directory inclusion.

Keep future evidence in controlled evidence storage. The Git repository contains the source configuration, public identity baseline and work register. Never put private school submissions in this directory.

See `docs/council-intelligence-commercial-research.md` for product direction, commercial comparators and the next adapter acceptance criteria.
