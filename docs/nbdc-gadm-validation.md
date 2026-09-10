# NBDC county selection — GBIF GADM validation notes

## Problem

The NBDC connector (`fetchNBDCEcologySouthEast`) previously selected records by a
free-text `stateProvince` filter (e.g. `County Wexford`). NBDC's records published to
GBIF leave `stateProvince` **null** while populating the structured GADM administrative
area (`gadm.level1.gid`). As a result the old filter accepted ~0 records — county
population silently failed.

## Fix

Selection now uses the GBIF `gadmGid` query parameter with the validated GADM level-1
GID for each county, and every returned record is re-validated per-record against
`record.gadm.level1.gid`. Records without a GADM level-1 area, or whose area is a
different county, are rejected (counted in `rejected`) rather than misassigned.

Retained unchanged: the `publishingOrg` restriction (NBDC publisher key), `countryCode`
= IE check, sensitive-record exclusions (`informationWithheld` / `dataGeneralizations`),
evidence-contract year date derivation, pagination, and the `ConnectorResult` return type.
The Irish planning connector and the blocked EPA connector are unchanged.

## Resolved & validated GADM level-1 identifiers

Resolved on 2026-09-10 from the live GBIF geocode API
(`https://api.gbif.org/v1/geocode/gadm/IRL/subdivisions` and `.../gadm/{gid}`); each
confirmed `englishType` = "County" with `higherRegion` Ireland (IRL).

| County    | GADM level-1 GID |
|-----------|------------------|
| Carlow    | IRL.1_1          |
| Kilkenny  | IRL.10_1         |
| Waterford | IRL.23_1         |
| Wexford   | IRL.25_1         |
| Wicklow   | IRL.26_1         |

## Live GBIF occurrence counts (first page, limit 20)

Publisher `d2b97690-bfd6-11de-b279-d52977ace833`, `country=IE`, `gadmGid=<GID>`.
Columns: total occurrences reported by GBIF for the filter, and accepted records on the
first page of 20 after per-record validation. See the script output for the exact figures
from the run committed with this change.

| County    | GBIF total | Accepted (page of 20) |
|-----------|-----------:|----------------------:|
| Carlow    |     38,516 |                    20 |
| Kilkenny  |     62,000 |                 19–20 |
| Waterford |     94,551 |                    20 |
| Wexford   |    121,535 |                    20 |
| Wicklow   |    116,513 |                    20 |

The old `stateProvince=County Wexford` filter returned **0** records for the same
publisher, confirming the root cause.

## How to reproduce

```
cd nextjs_space
yarn tsx scripts/validate-nbdc-gadm.ts          # live GBIF, per-county assertions
node --import tsx --test tests/regional-connectors.test.ts   # unit tests (mocked)
```
