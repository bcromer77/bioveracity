# GitHub Issue #11 Update — Source Review Complete

**Status:** Task complete  
**Branch:** `integrate/evidence-search`  
**Commits:** `b87fd30` (register integration), `93e5cf1` (findings)  
**Findings document:** [`docs/wexford-source-review-findings.md`](https://github.com/bcromer77/bioveracity/blob/integrate/evidence-search/docs/wexford-source-review-findings.md)

---

## What Was Verified

✅ **9 of 10 sources accessible** and content matches register descriptions  
✅ **All 6 staged candidates verified** against exact source passages  
✅ **Event dates, publication dates, and date precision accurately preserved**  
✅ **Evidence types correctly classified** (OFFICIAL_STATEMENT, OFFICIAL_REPORT, OPERATOR_STATEMENT, OFFICIAL_DESIGNATION, OFFICIAL_ASSESSMENT)  
✅ **Rights status UNKNOWN is accurate** — public availability does not establish reuse permission  
⚠️ **1 source blocked:** WCC SFRA consultation portal (alternative access needed)

### Source Verification Summary

| Source | Provider | Status | Key Finding |
|--------|----------|--------|-------------|
| wcc-plan | Wexford County Council | ✓ Verified | "Variation No. 1, adopted 13th July 2026" |
| epa-slaney | EPA / Catchments.ie | ✓ Verified | May 2024 report, "based on data up to 2021" |
| ue-tagoat | Uisce Éireann | ✓ Verified | €6.7m, Kilrane→Rosslare, spring 2027 |
| rosslare-plan | Rosslare Europort | ✓ Verified | €350m (5 components: masterplan, digitisation, BCP, N25, ORE) |
| npws-slaney | NPWS | ✓ Verified | SAC 000781 (Carlow, Wexford, Wicklow) |
| npws-harbour | NPWS | ✓ Verified | SPA 004076 (Wexford) |
| mara-map | MARA | ✓ Verified | ArcGIS link identified; layer metadata pending |
| opw-flood | OPW | ✓ Verified | Portal accessible; scenario/date inspection outstanding |
| wcc-planning | Wexford County Council | ✓ Verified | Planning search portal accessible |
| wcc-sfra | Wexford County Council | ✗ Blocked | Consultation portal verification challenge |

---

## Three Recommended Demonstration Cases

### 1. Wexford Harbour / Slaney Estuary
**Buyer decision:** "What environmental and planning evidence affects this harbour/estuary proposal?"

**Available evidence (5 records):**
- Protected-site designations (SAC 000781, SPA 004076)
- Water-quality status (harbour waterbody: Moderate, at risk; 2016–2021 data)
- County plan variation (2026-07-13)

**Missing before demonstration:**
- Proposal geometry (which development?)
- Live 2025–2026 monitoring (EPA uses 2021 data)
- Approved layer reuse permissions
- Passage-level source anchors

---

### 2. Rosslare–Kilrane–Tagoat
**Buyer decision:** "Which infrastructure dependencies affect wastewater-dependent development delivery?"

**Available evidence (5 records):**
- UÉ Tagoat project (€6.7m, Tagoat → Kilrane → Rosslare, spring 2027 forecast)
- Rosslare €350m investment (5 separate components)
- Rosslare Harbour waterbody (HMWB, under review)

**Missing before demonstration:**
- Separate project stages (completed vs. forecast milestones)
- Funding and approval sources
- Verified asset identities (does "Rosslare WWTP" match EPA records?)
- Individual Rosslare component status

---

### 3. Enniscorthy / Slaney
**Buyer decision:** "What flood, water, and planning evidence must be considered together for a site near Enniscorthy?"

**Available evidence (5 source categories):**
- Slaney water-quality assessments (2016–2021 data)
- OPW flood-map layers (national and community-scale; scenario pending)
- Protected-site designation (SAC 000781)
- Planning portal search
- County plan (2022–2028 + Variation 1)

**Missing before demonstration:**
- Inspected flood layer metadata (AEP scenario, climate scenario, date)
- Selected public planning case
- SFRA access (blocked; alternative route needed)
- Site-specific intersection (waterbody/flood/protected boundary)

---

## Remaining Blockers

### High Priority
- [ ] **Rights/permissions:** Seek embedding/redistribution approval from WCC, NPWS, EPA, OPW
- [ ] **Case selection:** Choose one real public proposal per case with the buyer (as stated in delivery plan)

### Medium Priority
- [ ] Retrieve WCC SFRA (consultation portal blocked)
- [ ] Inspect OPW flood-map layer metadata (scenario, climate, date, defences)
- [ ] Inspect MARA layer catalogue and API
- [ ] Identify one real planning application per case area
- [ ] Extract passage-level anchors (PDF page/section) for each candidate

---

## Next Small Implementation Task

**Recommendation:** **Task 1** from delivery plan — **Approve source permissions and select the three cases**

**Why this task first:**
- No source import, adapter work, or map implementation can proceed without:
  1. Knowing which sources are permitted for embedding/export
  2. Knowing which real proposals anchor each demonstration
  3. Defining measurable scope (5–10 reviewed claims per case, not county-wide)

**Concrete deliverables:**
1. Rights status updated per source (GRANTED / DENIED / CONDITIONALLY_GRANTED / REMAINS_UNKNOWN)
2. One real current proposal identified per case (with buyer)
3. Demonstration scope confirmed (claim count, geography, acceptance criteria)

**Estimated effort:** 2–3 days (depends on rights response times and buyer availability)

---

## What This Enables

✅ Honest map showing 2021 water quality, protected sites, operator plans, and county policies  
✅ Explicit coverage gaps (no live 2026 data, no proposal-specific analysis)  
✅ Source-linked evidence (once passage anchors extracted)  
❌ Cannot yet anchor to a real buyer proposal  
❌ Cannot show live measurements  
❌ Cannot embed layers or export evidence briefs without permissions

---

## Related Files

- **Findings:** [`docs/wexford-source-review-findings.md`](https://github.com/bcromer77/bioveracity/blob/integrate/evidence-search/docs/wexford-source-review-findings.md)
- **Delivery plan:** [`docs/wexford-delivery-plan.md`](https://github.com/bcromer77/bioveracity/blob/integrate/evidence-search/docs/wexford-delivery-plan.md)
- **Source register:** [`pipeline/wexford/source-register.json`](https://github.com/bcromer77/bioveracity/blob/integrate/evidence-search/pipeline/wexford/source-register.json)
- **Review candidates:** [`pipeline/wexford/review-candidates.json`](https://github.com/bcromer77/bioveracity/blob/integrate/evidence-search/pipeline/wexford/review-candidates.json)
- **Question register:** [`pipeline/wexford/question-register.json`](https://github.com/bcromer77/bioveracity/blob/integrate/evidence-search/pipeline/wexford/question-register.json)

---

**No production import, no embeddings, no monitoring — documentation and verification only.**
