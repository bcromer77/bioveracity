# Irish ports: source reconciliation handoff

This is a review queue, not an authorised production import. No numerical baseline has been overwritten by this work. Keep historical throughput/capacity separate from proposed investment, forecast capacity and project milestones. Use the existing `CapitalProject` relation as the development pipeline; do not introduce a duplicate `futureProjects` database model. Record distinct events against it when their dates and sources are established.

## Passages inspected

| Item | Primary source and supporting location | Supported distinction / remaining gap |
| --- | --- | --- |
| Rosslare ORE Hub | [Port authority release](https://www.rosslareeuroport.ie/en-ie/news/2025/rosslare-europort-to-submit-planning-application-for-ore-hub/), dated 3 December 2025; opening paragraphs and paragraph beginning “Subject to planning” | Operator announces intent to lodge the following week; €220m is a proposed development cost. Early 2027 construction and early 2029 delivery are conditional targets. This passage does **not** establish the seeded 10 December submission date. Find the actual application/register entry before publishing a lodged milestone. |
| GREEN DRIFT / Berth 3 | [Iarnród Éireann project page](https://www.irishrail.ie/en-ie/about-us/iarnrod-eireann-projects-and-investments/green-drift), “What the project will deliver”, “Green Drift” and “Programme” sections | Berth extension, ramp modernisation and shore-power infrastructure are proposed works. €38.5m describes the joint GREEN DRIFT programme, not Rosslare-only spend. Major Rosslare works are expected Q4 2026; completion expected 2028. The inspected passage does not state €19.2m CEF support. Preserve quarter/year precision; page publication date was not established. |
| Dublin ABR2 | [Dublin Port release](https://www.dublinport.ie/dublin-port-company-launches-public-consultation-on-alexandra-basin-redevelopment-2-abr2/), dated 6 March 2026; opening and scope paragraphs | Supports consultation launch for a reduced proposed application. Keep ABR2 distinct from the original ABR permission, MP2 and 3FM. This is not proof ABR2 consent was granted or works completed. |
| Cork strategy 2026–2030 | [Port of Cork release](https://www.portofcork.ie/port-of-cork-unveils-ambitious-five-year-plan-to-power-sustainable-growth/), introductory strategy and infrastructure/planet paragraphs | Supports an operator strategy covering 2026–2030 and planned infrastructure/environmental ambitions. Current passage does not support the seeded €100m CORE1 value. Do not infer operational achievement from aspirations. Exact publication date was not established. |

These are statements by the publishing operators. Reading them verifies what was stated, not independent delivery, environmental outcomes or funded capacity. Reuse permissions still require the applicable source/dataset checks.

## Outstanding source acquisition

- **DFDS / Brittany Ferries:** no route-change passage inspected in this review. Locate the specific operator announcement and affected route; separate announcement, scheduled start and confirmed service operation. Do not change a historical sailing count from a future timetable.
- **Shannon Foynes MAC:** current enrichment uses a secondary article. Find the MARA decision, consent identifier, holder, authorised area/activity and grant date before promoting a statutory milestone. A MAC is not by itself evidence that all other permissions are held or construction has begun.
- **Waterford MAC / Belview:** the existing candidate is [the port's September 2025 announcement URL](https://www.portofwaterford.com/2025/09/09/landmark-application-for-offshore-renewable-energy-terminal/). Its supporting passage was not re-inspected in this review. Resolve the enrichment's January 1 event date against the September 9 date elsewhere in the same script; locate the actual planning and MARA records. The generic planning homepage is not an adequate claim citation.

## Small next task for the developer

1. Audit existing port rows read-only. List record IDs, current text/dates and missing provenance. Do not execute the legacy enrichment script to repair them.
2. Prepare a proposed correction diff for each claim, preserving the previous version and distinguishing event date, publication date and actual retrieval time. Do not stamp historical event dates into `detectedAt`.
3. Populate source URL, publishing body, supporting passage location and genuine retrieval metadata only after inspection. Leave unknown dates unknown; the new port eligibility gate intentionally withholds incomplete records.
4. Add reviewed proposals as separate `CapitalProject` records, retaining baseline metrics unchanged. Represent forecast dates as forecasts with their original precision.
5. In isolated preview data, confirm each eligible dated project/permit marker has a matching source-linked card; selecting and scrubbing filters the correct cards. Check free/institutional history boundaries and Leaflet desktop/mobile behaviour.

Do not use a source's existence as a substitute for passage review. Do not silently replace conflicting values, auto-republish withheld ChangeRecords, invent sources, or deploy this reconciliation without the explicit production workflow.
