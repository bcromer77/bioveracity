# BioVeracity Place Spatial Memory + Network Map — implementation plan

Status: PROPOSED ONLY. No migration, deployment, production change, or Gate 2 interference.

## Objective

Make location a first-class part of BioVeracity evidence memory so that a place can remember **what happened, when, and where**, while independently controlling who may see exact location.

This must scale from Fodder (Partner #1) to 500+ venues and professional sites without inventing spatial precision or exposing sensitive wildlife locations.

## Governing rule

**Preserve the best defensible spatial evidence internally. Publish only the precision appropriate to the audience and sensitivity.**

Evidence precision and publication precision are separate concepts.

Never manufacture coordinates. A county record remains county-level. A polygon remains a polygon. A device GPS fix retains its reported accuracy. A surveyed/RTK point retains its supplied accuracy and method.

## Existing architecture to reuse

Inspection of the current release candidate shows spatial concepts already exist and must be reconciled rather than replaced:

- `Asset.latitude` / `Asset.longitude`
- `AssetArea`
- `ObservationEventRecord.geometry`, `crs`, `spatialUncertaintyMeters`, `placeScopeNote`
- `PublicOpportunity.locationType`, coordinates, coordinate source and precision
- `VenuePhoto.location`
- WildHub / WildVenueSetup place ownership and provisioning

Do not create a parallel spatial engine.

## Spatial state

Every evidence/observation object for which place is relevant must have an explicit defensible spatial state, for example:

- EXACT_POINT
- APPROXIMATE_POINT
- AREA_OR_POLYGON
- NAMED_SITE
- CATCHMENT
- COUNTY_OR_REGION
- NATIONAL
- UNKNOWN

Where available preserve:

- geometry / coordinates;
- CRS;
- source-reported accuracy or uncertainty in metres;
- capture/acquisition method (device GPS, RTK/GNSS, source dataset, manually placed, surveyed reference point, supplied polygon);
- source precision;
- place relationship;
- observed time separately from submitted/published/retrieved time;
- provenance.

Do not label ordinary phone GPS as 1 m accurate unless the captured accuracy supports that claim.

## Disclosure / sensitive-location policy

Spatial truth and spatial disclosure must be independent.

A record may retain a high-precision internal geometry while public rendering is reduced to:

- exact;
- approximate / deliberately generalised;
- named place only;
- hidden.

The policy must support audience-aware disclosure, at minimum:

- authorised custodian;
- authorised professional/internal evidence user;
- public visitor.

Sensitive wildlife (for example nesting birds) must fail closed. Public pages, exports, map APIs, search results, metadata, image EXIF and URLs must not leak restricted coordinates.

Changing public disclosure must not destroy the underlying source-linked spatial evidence.

## Fodder acceptance example

A visitor records a nesting-bird observation at Fodder.

The system may preserve internally:
- device coordinate;
- device-reported accuracy;
- observation time;
- location method;
- source/provenance;
- sensitivity classification.

Laura may choose an appropriate public treatment such as “Fodder in the Woods” or an approximate area. The exact point remains restricted if policy permits its retention.

Honeycomb may use authorised spatial relationships without revealing the exact point to unauthorised users.

## 1 m and survey-grade evidence

BioVeracity stores precision; it does not manufacture it.

Support ingestion of:
- ordinary phone/device fixes with reported accuracy;
- accurately established venue reference points;
- survey/GNSS/RTK positions where supplied;
- source polygons and lines.

A future mapped feature (tree, pond, plaque, habitat parcel, monitoring point) should be capable of becoming a stable spatial anchor so evidence can accumulate against that physical feature through time.

## Place map: design now for 500+ venues

Do not build a decorative map.

The map is a spatial expression of the evidence network.

The data model and APIs must allow a future network view containing hundreds or thousands of places without loading every observation or restricted geometry into the browser.

At minimum plan for:

1. canonical place geometry / representative public location;
2. place type and jurisdiction;
3. stable place identity and permanent QR destination;
4. public/private spatial disclosure;
5. viewport/bounding-box queries rather than fetch-all;
6. clustering / aggregation at low zoom;
7. server-side filtering and authorisation;
8. protected-location generalisation before data leaves the server;
9. temporal filtering so the map can eventually show change through time;
10. source/evidence layers with explicit native spatial precision;
11. no conversion of regional evidence into site evidence;
12. map provenance/retrieval date for evidential layers.

The network map should eventually answer questions such as:
- Where are BioVeracity Living Places?
- What evidence is associated with this place?
- What changed in this area over a selected period?
- Are records shifting spatially through time?
- Which places share relevant evidence/source relationships?

It must not imply causation from spatial proximity.

## QR + map relationship

Each provisioned place should ultimately have one stable BioVeracity place identity and permanent QR destination.

The QR, place page, custodian workspace and map feature must resolve to the same canonical place identity rather than maintaining separate hand-made identifiers.

The physical QR may remain unchanged while content, evidence and map layers evolve.

## Honeycomb

Spatial relationships become another Honeycomb dimension alongside time, source, subject, provenance and uncertainty.

Vectors may assist discovery. Exact distance, containment, intersection, nearest-feature and temporal/spatial calculations must be deterministic.

Examples:
- observation within a venue boundary;
- evidence within a catchment;
- distance from an observation to a known monitoring point;
- movement of recorded observations through time;
- records related by place but at different native precision.

## Privacy and safety tests

Acceptance must prove:
- exact restricted point never reaches public response payloads;
- map tiles/data endpoints do not leak restricted coordinates;
- EXIF/GPS stripping remains effective for public media;
- public generalisation is deterministic and cannot be reversed from client payloads;
- custodian permissions are scoped to the correct place;
- cross-place access is denied;
- exports obey disclosure policy;
- audit records explain spatial disclosure changes.

## Scale / performance acceptance

Before claiming 500-venue readiness, test with a synthetic non-production dataset large enough to exercise:
- 500+ places;
- many observations per place;
- viewport queries;
- clustering;
- time filtering;
- mixed point/polygon/site/regional precision;
- restricted geometries;
- mobile map performance.

No synthetic record may be presented as genuine evidence.

## Proposed delivery order

1. Complete Gate 2 first. Do not interrupt current QA release work.
2. Inventory/reconcile existing spatial models, PostGIS availability and WildHub place identity.
3. Define canonical spatial contract + disclosure contract.
4. Add only the minimum additive schema required; reviewed migration, isolated environment first.
5. Connect Fodder as the first real place.
6. Prove sensitive-location suppression and Laura/custodian controls.
7. Prove Honeycomb spatial retrieval deterministically.
8. Build bounded network-map API with server-side authorisation/generalisation.
9. Build nature-first map UI only after the evidence contract is proven.
10. Prove replication with a second place without bespoke code.

## Visual principle

The map must follow the BioVeracity visual language: warm light ground, botanical green, restrained gold, living fuchsia used sparingly, editorial calm and nature before interface.

Avoid generic SaaS GIS styling, decorative heatmaps and false precision. The map should reveal place and change, not advertise software.

## Definition of done

Report separately PROPOSED / IMPLEMENTED / TESTED / PUSHED / MERGED / DEPLOYED / VERIFIED LIVE.

Do not call this complete until Fodder can retain defensible spatial evidence, safely hide sensitive exact locations, retrieve authorised spatial relationships through Honeycomb, and appear as a canonical place in a map architecture demonstrably capable of scaling beyond a single venue.
