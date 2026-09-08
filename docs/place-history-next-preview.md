# Place History: mobile fix and source repair handoff

## This change

Below the desktop breakpoint the regional view now follows normal document flow. The outer fixed viewport and nested history/chronology scroll areas are desktop-only; replay follows the content on mobile. Desktop retains its map and evidence arrangement. Labels become Event to explore, Days before and after, and Date uncertain.

## Preview acceptance

Check at 375px and 390px widths: one main vertical page scroll; map and evidence both reachable; expanded history cards scroll with the page; replay does not cover cards; long event titles do not widen the viewport; original-source links and select controls remain usable. At 1280px check the desktop map, evidence rail and replay still fit. Capture screenshots. Explicit local TypeScript check performed; browser visual confirmation remains outstanding. No production deployment.

## Next bounded evidence task

The supplied March Water Recycling Centre screenshot contains two 27 July 2025 pause records without source links. Read the actual stored records and their ingestion history. Locate and read the original supporting documents before assigning URLs or day precision. Determine whether records represent the same event, complementary assertions or different sources. Do not deduplicate by matching date/title alone, and do not count shared-source records as independent corroboration. Prepare an idempotent dry-run correction with old/new values and retained provenance; production writes require the existing project approval gate. If a source cannot be established, retain the gap and avoid presenting the record as verified.

## Physical evidence follow-up

After one event has complete provenance, attach a suitable permitted rainfall series with station identity, observation period, units, quality flags and completeness checks. Missing observations are not zero rainfall. Keep station rainfall distinct from catchment estimates. The current PR does not add weather data, repair database records or enable monitoring.
