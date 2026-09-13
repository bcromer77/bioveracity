# Wild Counties architecture

## User promise

A visitor can search across all 32 counties for wildlife, habitats and useful places to eat, stay, visit or shop. Nature claims remain connected to their publisher, source URL and geographical scope. A nearby business is never presented as evidence that a species occurs on its premises.

## First bounded release

- `/wild` registers all 32 counties and provides a server-rendered search.
- `/wild/[county]` is the canonical county route.
- County Down and Kilkenny contain small, reviewed foundation fixtures.
- The other 30 county pages explicitly state that evidence collection is planned.
- Fodder and Nicholas Mosse are labelled pilot candidates. No partnership, approval or environmental performance is implied.

## Data contract

`WildCounty` owns county identity, province, jurisdiction, aliases, readiness, reviewed topics and business candidates. `WildTopic` preserves a public source, publisher, evidence scope, review state and caveat. `BusinessCandidate` is discovery inventory only; it cannot become a participating place without a separate approval workflow.

The production evolution should move these records into governed storage with:

1. stable county, topic, place and business identifiers;
2. source passage/locator, publication/event/retrieval dates and date precision;
3. reviewed draft, published, corrected, suspended and withdrawn states;
4. geometry with source and precision, not inferred proximity;
5. media rights, attribution and sensitivity controls;
6. auditable business consent and badge state;
7. search indexing only after publication eligibility is established.

## Badge boundary

“Wild [County] Participating Place — powered by BioVeracity” means the business participates in an evidence-linked local discovery experience. It does not mean regulator approval, legal compliance, superior environmental performance, a guaranteed wildlife sighting or endorsement by the public source publisher.

## Abacus handoff

This change is code architecture only. Before production deployment, confirm the exact Abacus application, environment, build command, environment variables, domain routing and last-known-good rollback commit. Run the explicit TypeScript check, the Wild Counties test, a production build and mobile/desktop visual checks for `/wild`, `/wild/down`, `/wild/kilkenny` and one planned empty county. Deployment and live verification are separate authorised steps.

