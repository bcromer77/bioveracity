# Irish river Honeycomb seeds — Nore, Blackwater, Slaney, Shannon, Dodder

## Objective
Create five real, source-linked, end-to-end river examples so a normal BioVeracity user can search a river by name and immediately reach a useful Honeycomb/evidence experience. This is a bounded data/retrieval task, not a redesign.

Target rivers:
- River Nore
- River Blackwater (Munster / Irish Blackwater — disambiguate explicitly)
- River Slaney
- River Shannon
- River Dodder

## User acceptance test
A signed-in user should be able to enter an ordinary query such as `River Dodder`, `Dodder Dublin`, `River Nore`, `Blackwater river Cork`, `River Slaney` or `River Shannon`; resolve the intended river/place without knowing H3, dataset names or internal IDs; open/search the relevant Honeycomb geography; and receive real source-linked evidence associated with that river/corridor.

The experience must support human questions such as:
- What has changed on the River Dodder?
- What evidence do we have around the River Nore?
- What has been recorded about water quality/ecology on the Slaney?
- What evidence overlaps this part of the Shannon?

Do not manufacture a narrative answer when evidence is absent. Empty/partial coverage must remain visible.

## Source rules
Use authoritative/public sources already supported by BioVeracity wherever possible. Inspect existing Ireland connectors and source registry before adding anything. Prefer canonical EPA Ireland river/water-quality/WFD monitoring evidence and other existing authoritative connectors. Add IFI/local-authority/OPW or other public evidence only where it is source-linked, rights-compatible and materially useful.

Every seeded record must retain source organisation, original source URL/reference, observed/event date where supplied, received/ingested date, geography/provenance, evidence type/status and original text/metadata needed by the existing evidence architecture. Unknown dates stay unknown. Do not infer ecological truth from absence or conflicting reports.

Do not create fictional observations, species, measurements, trends, locations or dates. Do not hand-write five attractive demo answers. The seeded records must pass through the same evidence/review/index/search path used by normal BioVeracity data.

## Geography / river identity
Inspect and reuse the existing spatial/H3 architecture. Give each target river a canonical searchable identity plus conservative aliases. Blackwater must be explicitly scoped to the Munster/Irish Blackwater so it cannot silently resolve to another Irish Blackwater. Shannon may require bounded river/corridor handling rather than pretending one point represents the whole river.

River matching must be geography-aware. Do not associate a record with a river merely because the river name appears in unrelated prose. Preserve location uncertainty where source geography is imprecise.

Generate/derive H3 coverage using the existing supported resolution and geometry rules. Do not invent cells manually. Evidence should enter Honeycomb through existing spatial indexing/membership logic so nearby/cross-source evidence can be discovered honestly.

## Retrieval
Inspect the current public/professional search, evidence eligibility, lexical/semantic fusion and Honeycomb entry points before coding. Reuse them. The five river names and sensible aliases must resolve even if vector search is unavailable; semantic search may improve questions but must not be the only way to find a named river.

If the current UI has no clean route from named-place search to Honeycomb, implement the smallest reusable bridge rather than a five-river special-case UI. No homepage redesign and no new parallel search product.

## End-to-end definition of done
For **each** of the five rivers prove:
1. canonical river identity/geography exists and is searchable;
2. at least one real authoritative source record has been ingested through the normal evidence path;
3. source provenance/original link is retained;
4. evidence is eligible/indexed according to existing review rules (do not bypass review safeguards merely to make a demo work);
5. spatial indexing places it into the appropriate Honeycomb geography;
6. ordinary river-name search resolves the intended river;
7. a Honeycomb/evidence query returns the seeded source-linked record where relevant;
8. clicking/opening evidence can reach the original/source detail using existing provenance UI;
9. vector/embedding failure does not make the named river undiscoverable;
10. no evidence from another river leaks into the result merely through ambiguous naming.

Add regression coverage for all five names plus Blackwater ambiguity, spatial false-positive protection and semantic-unavailable fallback.

## Scope guardrails
Do not change Wild Counties partner studio/PR53, Register Interest/PR54, auth, payments, BNG/HMMP, Ellona, homepage design, publication workflow or unrelated Prisma models. Reuse existing models/connectors/indexers before adding schema. No destructive migration. No fabricated demo fixtures in production data.

If live source ingestion requires credentials/environment variables that are unavailable in development, implement and test the deterministic source adapter/seed path with captured rights-compatible source fixtures where repository conventions permit, but report the production ingestion blocker explicitly. Do not label fixture-only behaviour as live data.

## Delivery
Work only on `feat/irish-river-honeycomb-seeds`. Keep changes bounded. Run relevant Honeycomb/evidence/search tests, typecheck and production build. Do not merge or deploy. Report:
- exact files changed;
- any schema/migration (prefer none);
- authoritative source(s) used for each river;
- record counts per river;
- H3/geography method;
- exact user searches tested;
- source-link/provenance checks;
- test/typecheck/build results;
- environment variables or live-ingestion blockers;
- remote head SHA;
- clearly separate implemented, tested, and actually populated/live.
