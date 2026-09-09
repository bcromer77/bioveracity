# Enniscorthy Historical Flood Case — Reviewable Chronology

**Prepared:** 8 September 2026
**Scope:** GitHub issue #11 — one documented Enniscorthy flood case from official sources, with rainfall and river-level coverage, dataset licence inspection, and explicit gaps. Source review only; no production import, no embeddings, no deployment.
**Rule applied throughout:** agency/operator statements are kept distinct from independently verified measurement. No event dates, station identifiers, coordinates, or licence terms are asserted here unless read from a live official source on this date.

---

## 1. Selected event

**Primary anchor: the November 2000 fluvial flood of the River Slaney at Enniscorthy Town.**
Supporting benchmark: the 1965 flood, recorded as the largest of the four major twentieth-century floods.

This event is chosen because it is the most precisely dated (month-level) flood documented in an official source, it is corroborated by two independent official documents, and both rainfall and river-level monitoring context can be identified for it (with the gaps stated in Section 5).

---

## 2. Case chronology (documented facts only)

| When | What is documented | Date precision | Source (official) | Locator |
|------|--------------------|----------------|-------------------|---------|
| 1924 | One of four major twentieth-century floods in Enniscorthy Town | year | OPW Feasibility Report on the Enniscorthy Flooding Problem, as cited in WCC SFRA | SFRA §2.3.2 |
| 1947 | One of four major twentieth-century floods | year | OPW Feasibility Report, cited in WCC SFRA | SFRA §2.3.2 |
| 1965 | Largest of the four; produced levels ~1.25 m higher upstream of Enniscorthy Bridge and ~0.9 m higher downstream of Seamus Rafter Bridge than the November 2000 flood | year | OPW Feasibility Report, cited in WCC SFRA | SFRA §2.3.2 |
| November 2000 | Major fluvial flood; considerable damage, many properties over one metre deep in water; in many cases flooding came from water exiting the river upstream and moving overland | month | OPW Feasibility Report, cited in WCC SFRA | SFRA §2.3.2 |
| November 2000 | Single flood events also recorded at St. John's Bridge and Carley's Bridge, from the River Urrin | month | OPW National Flood Hazard mapping (floodmaps.ie), cited in WCC SFRA | SFRA §2.3.1 |
| April 2013 (data snapshot) | floodmaps.ie had recorded 12 past flood events in the town, all fluvial; recurring flood points: The Island and Island Road, The Quays, The Promenade | snapshot date | OPW floodmaps.ie, cited in WCC SFRA | SFRA §2.3.1 ("Source: www.floodmaps.ie April 2013") |
| 2015 | Further extreme flood listed by the flood relief scheme | year | Enniscorthy Flood Relief Scheme (OPW + Wexford County Council) | enniscorthyfrs.ie home page |
| 2019 | Proposed scheme presented for public exhibition (Enniscorthy Library); covered a 3.5 km stretch (1.5 km upstream of Enniscorthy Bridge to 2 km downstream) | year | Enniscorthy Flood Relief Scheme | enniscorthyfrs.ie |
| 2020 | OPW submitted the proposed scheme to the Department of Public Expenditure & Reform for approval | year | Enniscorthy Flood Relief Scheme | enniscorthyfrs.ie |
| 2022 | Department refused the scheme under Section 7E(1)(b) of the Arterial Drainage Acts (as amended by the EU (EIA) (Arterial Drainage) Regulations 2019) | year | Enniscorthy Flood Relief Scheme | enniscorthyfrs.ie |

---

## 3. Exact supporting passages (verbatim)

**Source A — Wexford County Council, Strategic Flood Risk Assessment (SFRA) for the Enniscorthy plan** (PDF, 51 pages; retrieved 8 September 2026 from wexfordcoco.ie). This document cites the OPW Feasibility Report and the OPW flood database.

> "This website www.floodmaps.ie has recorded 12 past flood events in the town; all fluvial." — SFRA §2.3.1

> "Single flood events were recorded at St. John's Bridge and Carley's Bridge in November 2000 as a result of flooding from the River Urrin." — SFRA §2.3.1

> "The study identifies that there were … four major floods in Enniscorthy Town in the 20th Century; these occurred in 1924, 1947, 1965 and 2000. The 1965 was the largest relative to the November 2000 flood; it produced levels about 1.25m higher upstream of Enniscorthy Bridge and about 0.9m higher downstream of Seamus Rafter Bridge than the 2000 flood event." — SFRA §2.3.2

> "However, the flood event in November 2000 caused considerable damage with many properties over one metre deep in water. It is stated that in many cases the properties did not flood from the river adjacent to them, instead their flooding resulted from waters exiting the river at a point further upstream and moving overland to them." — SFRA §2.3.2

**Source B — Office of Public Works and Wexford County Council, Enniscorthy Flood Relief Scheme** (official scheme website enniscorthyfrs.ie; retrieved 8 September 2026).

> "The town of Enniscorthy, located on the banks of the River Slaney, has a long history of flooding. Extreme floods have occurred in 1924, 1947, 1965, 2000 and more recently in 2015."

> "In 2022 the Department made the decision to refuse this Scheme under Section 7E(1)(b) of the Arterial Drainage Acts (as amended by the European Union (Environmental Impact Assessment) (Arterial Drainage) Regulations 2019)."

**Event date vs publication date:** the flood events (1924, 1947, 1965, November 2000, 2015) are historical event dates. The documents that record them are later: the SFRA cites the OPW flood database at an "April 2013" snapshot; the scheme website is a live page retrieved 8 September 2026. The primary OPW Feasibility Report is cited by the SFRA but was not retrieved directly this turn (see gaps).

---

## 4. Monitoring coverage available for the event

### 4.1 Rainfall

| Attribute | Finding (read live 8 Sep 2026) |
|-----------|-------------------------------|
| Station | Met Éireann **Enniscorthy-Brownswood**, Co. Wexford |
| Variables | Daily and monthly rainfall |
| Record period | **1983-01-01 to Present** (dataset metadata: "Period of time covered (begin) 1983-01-01"; "1983 to Present") |
| Format / access | CSV, via data.gov.ie (Met Éireann open data) |
| Licence | **Creative Commons Attribution 4.0 International (CC BY 4.0)** — commercial reuse permitted with the required Met Éireann attribution statements |
| Relevance to event | Record begins 1983, so it **covers the November 2000 event**; it does **not** cover the 1924, 1947 or 1965 events |

### 4.2 River level

| Attribute | Finding (read live 8 Sep 2026) |
|-----------|-------------------------------|
| Station | OPW hydrometric station **12002 Enniscorthy**, River Slaney (Hydrometric Area 12 — Slaney & Wexford Harbour) |
| Variables | Water level and flow |
| Real-time access | waterlevel.ie — **provisional, raw, unchecked** data; **5-week rolling window only** |
| Archival access | Processed/quality-controlled records and "Annual Maxima" via the OPW Hydro-Data website (waterlevel.ie/hydro-data; opw.ie/hydro) |
| Republication | Station reference 12002 falls within 00001–41000, the range OPW states is "suitable for republication" |
| Latest reading captured | 8 Sep 2026, 21:45 UTC — staff gauge level 0.365 m; OD level 0.421 m (provisional, illustrative only) |
| Licence | Re-use "subject to licence under DIRECTIVE 2003/98/EC … on the re-use of public sector information" (Irish PSI licence, per circular per/2016/12). The OPW hydrometric station-details dataset on data.gov.ie is published under **CC BY 4.0** |
| Relevance to event | The gauge exists at Enniscorthy on the Slaney, but whether its **processed record extends back to November 2000** was not confirmed this turn (real-time site shows only 5 weeks; Annual Maxima not yet read from Hydro-Data). Do not assert the gauge captured the 2000 peak until verified |

---

## 5. Dataset licence inspection (summary)

| Dataset | Provider | Licence read live | Commercial reuse | Attribution |
|---------|----------|-------------------|------------------|-------------|
| Enniscorthy-Brownswood rainfall | Met Éireann | CC BY 4.0 | Permitted | Required (5 Met Éireann statements) |
| Hydrometric station details / water level | OPW | PSI re-use (Dir. 2003/98/EC; circular per/2016/12); station-details dataset CC BY 4.0 on data.gov.ie | Permitted with attribution | Required (OPW) |
| OPW flood maps (CFRAM fluvial/coastal layers) | OPW | Non-commercial only (general terms); ICWWS 2018 & Galway CWWS 2020 are CC BY 4.0 | **Prohibited for commercial/business/income-generating use** (except the CC-BY layers) | "Contains Office of Public Works information © Office of Public Works" + OSi attribution |
| WCC Strategic Flood Risk Assessment (document) | Wexford County Council | No reuse/embedding licence stated on the PDF | UNKNOWN | Cite as source; redistribution not established |
| Enniscorthy Flood Relief Scheme website | OPW + WCC | No reuse licence stated | UNKNOWN | Cite as source |

**Key licence consequence:** for a commercial demonstrator, Met Éireann rainfall and OPW hydrometric (gauge) data are reusable with attribution, but the **OPW flood-map layers are non-commercial** (except the CC-BY ICWWS/CWWS layers). This is a real, documented constraint — not an unknown — and must be resolved before any OPW flood layer is embedded in a commercial product.

---

## 6. Explicit gaps

1. **No absolute November 2000 peak level** was obtained from an official gauge record this turn. The SFRA gives only a relative comparison (1965 was ~1.25 m higher upstream / ~0.9 m higher downstream than 2000). News figures (e.g. "~4.7 m") are not from an official source and are excluded.
2. **Rainfall totals for the November 2000 event** were not extracted: the Met Éireann daily CSV was not downloaded/parsed this turn. Coverage (1983–present, CC BY 4.0) is confirmed; the specific November 2000 daily values are not yet in hand.
3. **Gauge record period unconfirmed:** whether OPW station 12002's processed Hydro-Data record reaches back to November 2000 was not verified (real-time site shows only 5 weeks; Annual Maxima not yet read).
4. **Primary source not retrieved directly:** the OPW Feasibility Report on the Enniscorthy Flooding Problem is cited only via the WCC SFRA. Direct retrieval remains outstanding.
5. **OPW flood-map layer detail not inspected:** which AEP scenario (10%/1%/0.5%/0.1%), which climate scenario (present day/MRFS/HEFS), layer dates, and whether defences are modelled — still not established for Enniscorthy.
6. **floodmaps.ie "12 past flood events"** is an April 2013 snapshot cited by the SFRA; the current count was not re-verified live this turn.
7. **Document reuse rights** for the WCC SFRA and the scheme website are UNKNOWN (content is citable; redistribution/embedding is not established).
8. **SFRA plan vintage:** the SFRA was retrieved from the Enniscorthy plan document set; its own formal adoption/publication date was not read from the (watermarked) title page this turn.

---

## 7. Smallest next implementation step

**Confirm the November 2000 event against the two attribution-clear datasets before any map or adapter work:**

1. Download the Met Éireann Enniscorthy-Brownswood **daily rainfall CSV** (CC BY 4.0) and read the November 2000 daily totals into an isolated staging file (no production import).
2. Open OPW station 12002 on the **Hydro-Data / Annual Maxima** view and record whether the processed record covers November 2000 and, if so, the annual maximum level for that hydrometric year.

Both use datasets whose reuse licence is already confirmed (CC BY 4.0 / PSI), so this step carries no unresolved rights risk. It converts the current documented-but-unmeasured event into a case with a verifiable rainfall and river-level record, and it deliberately avoids the OPW flood-map layers whose non-commercial licence is still a blocker. It reads only; it imports nothing, deploys nothing, and touches no production data.
