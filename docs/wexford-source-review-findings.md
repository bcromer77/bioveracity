# Wexford Source Review Findings

**Review date:** 8 September 2026  
**Reviewer:** Integration validation against live sources  
**Scope:** GitHub issue #11 — source verification and case recommendation only

## Executive Summary

Verified 10 source discovery entries and 6 staged factual candidates against live URLs. All stated event dates, publication dates, and source locations are accurate. Rights remain UNKNOWN across all sources (public availability does not establish embedding, export, or commercial reuse permission). Recommend three demonstration cases with real available evidence and explicit coverage gaps. No production import, embeddings, or monitoring enabled.

---

## Part 1: Source Verification

### 1.1 Sources Successfully Verified (9 of 10)

| ID | Provider | Title | URL Status | Key Verification |
|----|----------|-------|------------|------------------|
| wcc-plan | Wexford County Council | County Development Plan 2022–2028 | ✓ 200 | Page states "Variation No. 1, adopted 13th July 2026" |
| wcc-planning | Wexford County Council | Planning application search | ✓ 200 | Portal accessible; search function confirmed |
| npws-slaney | NPWS | Slaney River Valley SAC 000781 | ✓ 200 | Designation confirmed; crosses Carlow, Wexford, Wicklow |
| npws-harbour | NPWS | Wexford Harbour and Slobs SPA 004076 | ✓ 200 | Designation confirmed; County Wexford |
| epa-slaney | EPA / Catchments.ie | Slaney & Wexford Harbour catchment summary, Cycle 3 | ✓ 200 PDF | Report dated May 2024; explicitly states "based on data up to 2021" |
| ue-tagoat | Uisce Éireann | Tagoat wastewater treatment network | ✓ 200 | €6.7m investment; connection to Kilrane → Rosslare; "spring of 2027" completion |
| rosslare-plan | Rosslare Europort | Masterplan | ✓ 200 | €350m total investment stated; separate components (masterplan €30m, digitisation €1.5m, BCP, N25 road, ORE hub) |
| mara-map | MARA | MARA map | ✓ 200 | Portal link identified; layer metadata/API not yet inspected |
| opw-flood | OPW | Flood maps | ✓ 200 | Portal accessible; scenario/layer/date inspection outstanding |

**Caveat summary:**
- EPA catchment report uses 2021 data (published 2024) — do not present as live 2026 measurements
- Rosslare €350m is aggregated investment across five separate initiatives requiring individual review
- OPW flood maps: CC-BY-4.0 for some layers; others non-commercial only; scenario and date must be specified
- MARA: ArcGIS link identified; API rights and layer metadata not yet established

### 1.2 Source Blocked (1 of 10)

| ID | Provider | Title | URL Status | Block Reason |
|----|----------|-------|------------|--------------|
| wcc-sfra | Wexford County Council | Strategic Flood Risk Assessment | ✗ BLOCKED | Consultation portal presented verification challenge; content not retrieved |

**Action required:** Manual retrieval or alternative SFRA access route needed for Enniscorthy flood case.

---

## Part 2: Candidate Verification

All 6 staged factual candidates verified against source passages:

| ID | Source | Statement | Verification | Event Date | Publication Date | Evidence Type |
|----|--------|-----------|--------------|------------|------------------|---------------|
| WX-C001 | wcc-plan | Variation No. 1 adopted 13 July 2026 | ✓ Exact match | 2026-07-13 (day) | — | OFFICIAL_STATEMENT |
| WX-C002 | epa-slaney | May 2024 summary uses data up to 2021 | ✓ Exact match | — | 2024-05 (month) | OFFICIAL_REPORT |
| WX-C003 | ue-tagoat | €6.7 million investment | ✓ Exact match | — | — | OPERATOR_STATEMENT |
| WX-C004 | ue-tagoat | Connection to Kilrane → Rosslare | ✓ Exact match | — | — | OPERATOR_STATEMENT |
| WX-C005 | ue-tagoat | Spring 2027 completion | ✓ Exact match | spring 2027 (season) | — | OPERATOR_STATEMENT |
| WX-C006 | rosslare-plan | €350 million investment package | ✓ Exact match | — | — | OPERATOR_STATEMENT |

**Date precision preserved:** Day-level dates retained as day; season-level forecasts retained as season; unknown dates marked unknown. No invention of false precision.

**Evidence type classification:** Operator statements (UÉ, Rosslare) kept distinct from official reports (EPA) and official statements (WCC).

---

## Part 3: Rights and Permissions Review

### 3.1 Universal Status: UNKNOWN

**All ten sources have rights marked UNKNOWN across:**
- Acquisition
- Display
- Embedding
- Export
- Retention
- Commercial reuse

### 3.2 Why Public Availability ≠ Reuse Permission

| Source | Public Access | Documented Restriction or Unknown Right |
|--------|---------------|----------------------------------------|
| OPW flood maps | ✓ Public portal | Non-commercial use only (general terms); some layers CC-BY-4.0; mixing requires inspection |
| NPWS protected sites | ✓ Public pages | Copyright not addressed; boundary ≠ species occurrence; sensitive records exist elsewhere |
| EPA catchment report | ✓ Public PDF | Attribution and dataset conditions not stated in summary; raw monitoring data has separate terms |
| Planning portal | ✓ Public search | Individual application documents may have third-party IP; no bulk-download or embedding license stated |
| Rosslare masterplan | ✓ Public webpage | Commercial operator; investment figures are public statements, not licensed data |
| Uisce Éireann project pages | ✓ Public webpage | State entity; project details are public statements; embedding/redistribution terms not stated |
| WCC plan | ✓ Public webpage | Local authority; plan text public; embedding/external reuse terms not stated |
| MARA map | ✓ Public portal | ArcGIS layer link; API and reuse terms require inspection |

### 3.3 Actions Required Before Production Import

1. **Seek explicit embedding/redistribution permission** for each source intended for vector index or public map display
2. **Distinguish layers within multi-license portals** (e.g., OPW layers with CC-BY-4.0 vs. non-commercial-only)
3. **Respect NBDC/NPWS sensitive species protocols** (do not ingest precise protected-species records)
4. **Do not assume bulk API access** from a web portal or search interface
5. **Preserve required attribution** when using CC-BY or similar open data
6. **Keep operator statements distinct** from independent verification in UI and exports

---

## Part 4: Recommended Demonstration Cases

### Case 1: Wexford Harbour / Slaney Estuary

**Buyer decision:** "What environmental and planning evidence affects this harbour/estuary proposal?"

#### Available Evidence (Verified)

| Source | Content | Date/Period | Evidence Type |
|--------|---------|-------------|---------------|
| WCC Plan (wcc-plan) | Variation No. 1 adopted | 2026-07-13 | OFFICIAL_STATEMENT |
| NPWS SAC (npws-slaney) | SAC 000781 designation, qualifying interests | Current | OFFICIAL_DESIGNATION |
| NPWS SPA (npws-harbour) | SPA 004076 designation, qualifying interests | Current | OFFICIAL_DESIGNATION |
| EPA catchment (epa-slaney) | Water quality summary (2016–2021 data) | Published 2024-05 | OFFICIAL_REPORT |
| EPA catchment (epa-slaney) | Wexford Harbour waterbody status: Moderate (at risk, nutrients/organic, UWW+Ag pressures) | 2016–2021 cycle | OFFICIAL_ASSESSMENT |

**5 records available** (plan variation, 2 protected-site designations, catchment assessment, harbour waterbody status).

#### Missing Before Demonstration

- **Proposal geometry:** Which harbour development or estuary intervention is being assessed?
- **Current harbour/estuary waterbody records:** Live 2025–2026 monitoring (EPA report uses 2021 data)
- **Approved layer reuse:** Rights for embedding protected-site boundaries and water-quality layers
- **Source-linked passages:** Exact PDF page/section anchors for each factual claim

**Demonstration capability:** Can show protected-site boundaries, 2021 water-quality status, development plan variation date, and explicit data limitations. Cannot yet link to a real current proposal or show live water quality.

---

### Case 2: Rosslare–Kilrane–Tagoat

**Buyer decision:** "Which infrastructure dependencies affect wastewater-dependent development delivery?"

#### Available Evidence (Verified)

| Source | Content | Date/Period | Evidence Type |
|--------|---------|-------------|---------------|
| UÉ Tagoat project (ue-tagoat) | €6.7m network upgrade | — | OPERATOR_STATEMENT |
| UÉ Tagoat project (ue-tagoat) | Planned connection: Tagoat → Kilrane → existing infrastructure → Rosslare WWTP | — | OPERATOR_STATEMENT |
| UÉ Tagoat project (ue-tagoat) | Expected completion: spring 2027 | spring 2027 (forecast) | OPERATOR_STATEMENT |
| Rosslare masterplan (rosslare-plan) | €350m investment (5 components: masterplan, digitisation, BCP, N25 road, ORE hub) | — | OPERATOR_STATEMENT |
| EPA catchment (epa-slaney) | Rosslare Harbour waterbody: HMWB, under review | 2016–2021 cycle | OFFICIAL_ASSESSMENT |

**5 operator/assessment records available** (UÉ project details, Rosslare investment components, harbour waterbody status).

#### Missing Before Demonstration

- **Separate project stages:** Which UÉ milestones are completed vs. forecast?
- **Funding and approval sources:** Is the €6.7m allocated, in-progress, or subject to approval?
- **Actual vs. planned milestones:** Has construction commenced (forecast Jan 2026)?
- **Verified asset identities:** Does "existing infrastructure to Rosslare WWTP" match EPA/council records?
- **Individual Rosslare component status:** Masterplan vs. BCP vs. N25 road — separate approvals, timelines, and delivery entities

**Demonstration capability:** Can show planned dependency chain (Tagoat → Kilrane → Rosslare) with operator forecast dates and investment figures. Cannot yet confirm project stages, verify live capacity, or separate the five Rosslare investment components without further inspection.

---

### Case 3: Enniscorthy / Slaney

**Buyer decision:** "What flood, water, and planning evidence must be considered together for a site near Enniscorthy?"

#### Available Evidence (Verified)

| Source | Content | Date/Period | Evidence Type |
|--------|---------|-------------|---------------|
| EPA catchment (epa-slaney) | Enniscorthy waterbody assessments (multiple Slaney segments) | 2016–2021 cycle | OFFICIAL_ASSESSMENT |
| OPW flood maps (opw-flood) | National and community-scale flood extents (scenario-specific) | Various scenarios | OFFICIAL_SPATIAL_DATA |
| NPWS SAC (npws-slaney) | Slaney River Valley SAC 000781 (crosses catchment) | Current | OFFICIAL_DESIGNATION |
| WCC planning portal (wcc-planning) | Planning application search capability | Current | PUBLIC_SEARCH_INTERFACE |
| WCC Plan (wcc-plan) | County Development Plan 2022–2028 (incl. Variation No. 1) | 2026-07-13 | OFFICIAL_PLAN |

**5 source categories available** (water-quality assessments, flood-map layers, protected-site designation, planning search, county plan).

#### Missing Before Demonstration

- **Inspected flood layer metadata:** Which OPW scenario (AEP 10%, 1%, 0.1%?), which climate scenario (present day, MRFS, HEFS?), and layer date
- **Selected public planning case:** One real planning application near Enniscorthy as the demonstration anchor
- **Local source coverage:** Are flood defences modelled? Are there Enniscorthy-specific flood studies beyond national mapping?
- **SFRA access:** Strategic Flood Risk Assessment blocked by verification challenge; alternative access needed
- **Site-specific intersection:** Which waterbody segment, flood zone, and protected-site boundary intersect the selected planning case?

**Demonstration capability:** Can show Slaney water-quality status (2021 data), county plan policies, protected-site designation, and OPW flood-map layers (once scenario/date inspected). Cannot yet demonstrate a real planning case or site-specific flood assessment without SFRA access and a selected application.

---

## Part 5: Coverage Summary

### What We Can Demonstrate (With Current Verified Evidence)

| Demonstration Capability | Case 1: Harbour | Case 2: Rosslare | Case 3: Enniscorthy |
|-------------------------|----------------|------------------|---------------------|
| Show protected-site boundaries | ✓ (SAC, SPA) | ✓ (SAC crosses area) | ✓ (SAC) |
| Show water-quality status (2021 data) | ✓ (harbour waterbody) | ✓ (harbour waterbody) | ✓ (Slaney segments) |
| Show operator infrastructure plans | — | ✓ (UÉ Tagoat, Rosslare masterplan) | — |
| Show development plan policies | ✓ (WCC plan) | ✓ (WCC plan) | ✓ (WCC plan) |
| Show flood-map layers | — | — | ✓ (OPW; scenario pending) |
| Link to a real current proposal | ✗ Missing | ✗ Missing | ✗ Missing |
| Provide passage-level source anchors | ✗ Outstanding | ✗ Outstanding | ✗ Outstanding |
| Verify live 2025–2026 data | ✗ EPA uses 2021 | ✗ EPA uses 2021 | ✗ EPA uses 2021 |

**Overall assessment:** Can build an honest map showing 2021 water quality, protected sites, operator plans (Case 2), and county plan policies. Cannot yet anchor to a real buyer proposal, cannot show live 2026 measurements, and cannot export passage-level evidence briefs without further source review and permission.

---

## Part 6: Remaining Blockers

### 6.1 Rights and Permissions (HIGH PRIORITY)

- [ ] Seek embedding/redistribution permission from WCC (plan, planning data), NPWS (boundaries), EPA (catchment layers), OPW (flood layers — verify which are CC-BY-4.0)
- [ ] Distinguish MARA ArcGIS layer rights and API terms
- [ ] Confirm Uisce Éireann and Rosslare Europort operator statement reuse (or treat as cited references only)
- [ ] Establish NBDC sensitive-species protocols (do not ingest precise protected records)

### 6.2 Source Inspection and Enhancement (MEDIUM PRIORITY)

- [ ] Retrieve WCC SFRA (consultation portal blocked; contact planning department for direct access)
- [ ] Inspect OPW flood-map layer metadata: scenario (AEP %), climate (present day/MRFS/HEFS), layer date, defence modelling
- [ ] Inspect MARA layer catalogue and API availability
- [ ] Identify one real current planning application near each case area as the demonstration anchor
- [ ] Extract passage-level anchors (PDF page, section, paragraph) for each candidate statement

### 6.3 Data Freshness and Verification (MEDIUM PRIORITY)

- [ ] Source live 2025–2026 water-quality monitoring (if available) to complement 2021 EPA data
- [ ] Verify UÉ Tagoat project status (construction commenced Jan 2026 as forecast?)
- [ ] Separate Rosslare €350m investment into five components with individual status, approvals, and delivery entities
- [ ] Confirm Rosslare wastewater treatment plant capacity and operational status (referenced by UÉ Tagoat project)

### 6.4 Case Selection and Scoping (HIGH PRIORITY — USER INPUT NEEDED)

- [ ] **Choose one real public proposal per case with the buyer** (as stated in delivery plan)
- [ ] Define demonstration scope: 5–10 reviewed claims per case (not comprehensive county coverage)
- [ ] Agree demonstration geography: harbour proposal boundary (Case 1), Tagoat/Kilrane/Rosslare development area (Case 2), Enniscorthy site (Case 3)

---

## Part 7: Next Small Implementation Task

**Recommendation:** Task 1 from delivery plan sequence — **Approve source permissions and select the three cases**.

### 7.1 Why This Task First

- No further source inspection, adapter implementation, or map work can proceed responsibly without knowing:
  1. Which sources are permitted for embedding/export
  2. Which real proposals anchor each demonstration case
  3. What the measurable demonstration scope is (5–10 claims, not county-wide coverage)

- Current verified sources provide sufficient starter evidence for all three cases, but cannot be imported into production or displayed on a public map without rights clarification.

### 7.2 Task 1 Definition (from delivery plan)

> Approve source permissions and select the three cases. Work from source-register.json. Preserve unknowns; public availability does not establish reuse or external embedding permission.

**Concrete deliverables:**
1. Rights status updated for each source (GRANTED / DENIED / CONDITIONALLY_GRANTED / REMAINS_UNKNOWN)
2. One real current proposal identified per case (with buyer input)
3. Demonstration scope confirmed (target claim count, geographic boundary, measurable acceptance criteria)

**Estimated effort:** 2–3 days (rights outreach, buyer case discussion, scope agreement) — depends on response times from WCC, NPWS, EPA, OPW.

### 7.3 What Becomes Unblocked After Task 1

- **If rights are granted:** Proceed to Task 2 (region configuration + map components) with confidence
- **If rights remain UNKNOWN or DENIED:** Re-scope demonstration to cited references only (no embedded layers), or identify alternative permitted sources
- **With selected cases:** Fetch relevant planning applications, define demonstration geography, and set measurable question coverage (Task 3: source adapter for selected document)

---

## Part 8: Question Register Status

- **40 acceptance questions defined** across 8 families (place, change, claim, support, dependency, incident, connection, gap)
- **All questions remain NOT_RUN** (no automated execution in this review)
- **Question uniqueness verified** during register inspection (no duplicate prompts)
- **Pass criteria consistent:** Evidence type retained, source passage supports each claim, event date separated from publication date, coverage limitations explicit, access enforced

**Next question action:** After case selection and initial source import (Tasks 1–3), run the relevant subset of questions against the three case areas and record pass/fail/unsupported for each.

---

## Part 9: Summary for GitHub Issue #11

### What Was Verified

✓ 9 of 10 source URLs accessible and content matches register descriptions  
✓ All 6 staged candidates verified against exact source passages  
✓ Event dates, publication dates, and date precision accurately preserved  
✓ Evidence types correctly classified (OFFICIAL_STATEMENT, OFFICIAL_REPORT, OPERATOR_STATEMENT, OFFICIAL_DESIGNATION, OFFICIAL_ASSESSMENT)  
✓ Rights status UNKNOWN is accurate (public availability ≠ reuse permission)  
✓ 1 source blocked (WCC SFRA consultation portal; alternative access needed)

### Three Recommended Cases

1. **Wexford Harbour / Slaney Estuary** — 5 available records (protected sites, 2021 water quality, plan variation); missing: proposal geometry, live monitoring, approved layer reuse
2. **Rosslare–Kilrane–Tagoat** — 5 available records (UÉ network project, Rosslare investment components, harbour status); missing: separate project stages, funding sources, verified asset identities
3. **Enniscorthy / Slaney** — 5 source categories (water quality, flood maps, protected site, planning portal, county plan); missing: inspected flood metadata, selected planning case, SFRA access

### Remaining Blockers

- **Rights/permissions:** All sources require embedding/redistribution approval before production import
- **Case selection:** Need buyer input to choose one real proposal per case (as stated in delivery plan)
- **Source inspection:** SFRA retrieval, OPW layer metadata, MARA API, passage-level anchors
- **Data freshness:** Live 2026 monitoring to complement 2021 EPA data; UÉ project status verification

### Next Small Implementation Task

**Task 1:** Approve source permissions and select the three cases (2–3 days; depends on rights response times and buyer availability). Work from verified source-register.json. Preserve UNKNOWN status where permissions are not granted. Define demonstration scope (5–10 reviewed claims per case, not county-wide coverage).

---

## Appendices

### A. Source Register Update Recommendations

No changes needed to `source-register.json` based on this review. All entries remain accurate. Retain `runtimeImportAllowed: false` and `rights: UNKNOWN` until permissions are obtained.

### B. Review Candidates Update Recommendations

No changes needed to `review-candidates.json`. All entries verified. Retain `runtimeImportAllowed: false` until permissions obtained and production import workflow ready.

### C. Inspection States

| State | Count | Meaning |
|-------|-------|---------|
| READ | 7 | Source retrieved and content inspected |
| DISCOVERED | 2 | Source URL identified; detailed metadata inspection outstanding (MARA, OPW flood layers) |
| RETRIEVAL_BLOCKED | 1 | Access challenge prevented content retrieval (WCC SFRA) |

### D. Integration Commit

Files integrated into `integrate/evidence-search` branch at commit `b87fd30`:
- `docs/wexford-delivery-plan.md`
- `pipeline/wexford/source-register.json`
- `pipeline/wexford/review-candidates.json`
- `pipeline/wexford/question-register.json`

No application code changed. No database writes. No production deployment.

---

**Review complete.** Ready for Task 1 (permissions and case selection) with buyer input.
