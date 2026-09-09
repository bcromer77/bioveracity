# Natural England: Cambridge–Peterborough connector

## Delivered scope

Read-only SSSI boundary adapter, reproducible command-line snapshot collection and offline regression tests. No API key is required. No database migrations, seed changes, UI changes, deployment, scheduled collection or Natural England partnership are implied. SSSI units and conservation advice remain subsequent integrations, not activated services.

The WGS84 discovery envelope is west -0.55, south 52.0, east 0.55, north 52.75. It includes neighbouring areas: it is NOT the exact Cambridge–Peterborough administrative boundary or a catchment polygon. Returned polygons are geographic context, not proof of pollution, ecological condition, downstream connectivity or site ownership.

## Run (Node 22+)

From nextjs_space:

```sh
node --test tests/natural-england.test.mjs
node scripts/natural-england-snapshot.mjs /tmp/bioveracity-natural-england
```

Keep snapshots outside the source repository and production database. Each successful run writes a new timestamped JSON snapshot; previous snapshots are never overwritten. Stable site IDs and content hashes support comparison across successful snapshots. Retrieval failure returns a nonzero exit; never replace the last successful snapshot with an empty result or infer removal from a failed run. Retention in approved persistent evidence storage is a separate release step.

## Provenance and safeguards

- Official catalogue: https://naturalengland-defra.opendata.arcgis.com/
- Dataset service: https://services.arcgis.com/JJzESW51TqeY9uat/arcgis/rest/services/SSSI_England/FeatureServer/0
- Item/licence: https://www.arcgis.com/sharing/rest/content/items/f10cbb4425154bfda349ccf493487a80?f=json
- Validate the publisher item, service URL and OGL v3 declaration on every collection; preserve exact attribution and metadata.
- Preserve every request URL, retrieval time, response hash, raw selected attributes and WGS84 geometry.
- Preserve source last-edit timestamp separately from event and publication dates, which remain unknown. Do not generate a historical designation event from a snapshot.
- Query IDs first; fetch bounded batches and reject missing, duplicate, truncated or malformed records and source edits during collection.
- Schema, HTTP or licence failures fail closed. No community/child material is collected.

## Validation and handoff

Live service collection tested 9 September 2026: 189 site records in this discovery envelope, including Cam Washes, Nene Washes, Ouse Washes and Wicken Fen. This is not an administrative-region count. Source layer last-edit time was 19 August 2026. See runtime output for the current count and metadata rather than treating this note as live data.

Nine offline tests cover pagination, provenance, stable hashes, invalid scope, HTTP/ArcGIS errors, schema and licence drift, truncation, identity mismatch, changing source version and scoped empty results. Connector and CLI also pass explicit TypeScript checkJs type checking. Full application build is not asserted: these standalone files add no runtime dependency to the Next app. GitHub PR checks are offline; they do not contact production.

Next release gate for Abacus: review this PR, choose approved evidence storage and refresh cadence, map SSSI reference IDs to place records without overwriting baselines, expose source/attribution/date precision in the existing place map, and test unavailable/stale states. Confirm the specific preview, deployment and rollback route before release. Do not describe this connector as active on bioveracity.com until that release is verified.

Commercial purpose: help a Cambridge discussion demonstrate which protected sites are in a selected area and inspect their provenance alongside other agencies' records. Neither access nor reuse constitutes endorsement, a partnership or a regulatory conclusion.
