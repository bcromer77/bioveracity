# Cambridge Living Stream — demonstration brief

**Status:** PROPOSED ONLY — demo work after Gate 3 is resolved  
**First demonstration place:** Coldham's Brook, Cambridge  
**Base:** `release/production-developer-platform-v1` @ `913547cc0c9d88265a0a6e65d13b1f535578ec92`

## Purpose

Demonstrate to a Cambridge custodian how the existing BioVeracity Living Place architecture can give a stream a persistent, evidence-linked memory.

This is not a separate Cambridge product. Reuse the Fodder/WildHub/Living Place primitives and make the minimum reusable additions needed for a river expression.

**Core proposition:** *What if Coldham's Brook had a memory?*

## Hard release boundary

This PR is deliberately isolated from Gate 3.

Do not deploy it. Do not migrate any database. Do not alter QA or production. Do not change secrets, V1 flags, ingestion schedules or API keys. Do not release Scout records. Do not merge until Gate 3 and the production baseline work are explicitly cleared.

## Public demonstration journey

Design the public experience around:

1. **Meet the stream** — place-first hero; nature before interface.
2. **What people noticed** — community observations and photographs, with evidence class visible when needed.
3. **This season** — genuine dated observations and defensible seasonal milestones.
4. **Through time** — chronology rather than a dashboard.
5. **What changed?** — deterministic, evidence-linked changes; never invented causation.
6. **Restoration story** — interventions and public evidence in chronological context.
7. **Follow the water** — upstream/downstream and catchment context only where spatial evidence supports it.
8. **Help this stream remember** — simple public contribution flow: photo/observation/date/location/anonymous-or-credit, subject to moderation and sensitive-location rules.

Intended journey:

`QR → STREAM → MEMORY → CONTRIBUTION → REVIEW → CHRONOLOGY → INTELLIGENCE`

## Custodian expression

Provide a separate, quiet custodian view showing only useful work:

- new community observations;
- authoritative evidence updates;
- items awaiting review;
- meaningful evidence changes;
- underlying evidence/provenance;
- unresolved gaps.

Include a demonstration **Weekly Place Intelligence Edition** in the established BioVeracity botanical report language:

**COLDHAM'S BROOK**  
**PLACE INTELLIGENCE · WEEK XX**  
*What the stream remembers this week*

Suggested sections:

- The week in one sentence
- Firsts & changes
- What people noticed
- Through time
- Restoration chronology
- Wider catchment
- What remains unknown
- Evidence & provenance

The weekly edition is a chapter in the place record, not an ephemeral marketing email.

## Evidence rules

Every displayed datum must be either:

1. genuine source-linked evidence; or
2. unmistakably labelled **DEMONSTRATION** content.

Never manufacture monitoring measurements, species observations, historical records, ecological conclusions, causal explanations or precise coordinates.

Preserve distinctions between:

- community observation;
- photograph;
- identification;
- custodian editorial decision;
- authoritative/public evidence;
- structured measurement;
- protected/sensitive spatial evidence.

Publication does not upgrade evidence class.

Statements such as first/lowest/highest/earlier/later/new must be computed deterministically against the available BioVeracity record and qualified to that record. Example: “First snowdrop recorded in this place's BioVeracity record this season,” not “the first snowdrop appeared.”

## Spatial and privacy rules

Evidence precision and publication precision are separate.

Preserve the best defensible source precision internally. Public disclosure may be exact, approximate, generalised, named-place-only or hidden. Sensitive wildlife locations fail closed. Never manufacture GPS precision.

## Visual direction

Reuse the canonical BioVeracity client-facing grammar:

- warm white/light ground;
- botanical green;
- restrained archival gold;
- living fuchsia botanical mark;
- generous whitespace;
- editorial/natural-history typography;
- photography and nature before interface;
- otter/nature character retained where appropriate.

Avoid generic SaaS cards, KPI dashboards, glassmorphism, gradients, AI motifs, fake-live indicators and decorative maps.

## Reuse requirement

Before implementation inspect the existing Fodder/WildHub implementation, PR 57 work, permanent QR/place routes, contribution/moderation flow, owner/custodian access, evidence classes, photo safety and spatial work. Extend existing primitives; do not create parallel place, contribution, user or evidence systems.

The same architecture must remain capable of expressing woodland, wetland, river, club, venue, estate and infrastructure places without separate engines.


## Multi-user place stewardship

A BioVeracity Place must support more than one authorised custodian/guardian. This is a reusable place capability, not a Cambridge-specific account system.

A family, club committee, estate team, council team or venue staff group may collectively care for the same Place while retaining individual user identities.

Requirements for later implementation:

- one canonical Place may have multiple individually authenticated members;
- do not create shared passwords or one family email/login;
- invite additional members to an existing Place;
- use explicit place-scoped roles/permissions (minimum design: owner/admin, custodian/editor, contributor/viewer as warranted by the existing model);
- every contribution, moderation decision, rights action, publication, acknowledgement and configuration change retains the acting user's identity and audit trail;
- a user may belong to multiple Places without data leaking between them;
- removing a member must not delete the Place memory or provenance of actions they previously took;
- account recovery, Terms/privacy acceptance and rights records remain per person where legally/technically appropriate;
- family/team members can all collect observations and photographs into the same Place memory;
- sensitive evidence and exact locations remain permission-controlled;
- public visitors do not need to become custodians merely to contribute through an allowed guest flow.

Before implementation, inspect the existing user/workspace/WildHub ownership and collaborator models and extend the smallest proven model. Do not introduce a duplicate tenancy or identity system.

Acceptance must include at least: two authorised users for one Place can sign in separately, contribute to the same Place, see the appropriate shared custodian queue, retain distinct attribution/audit identities, and cannot access another Place unless separately authorised.

## Demo acceptance

Return:

- exact branch and full SHA;
- files changed;
- routes;
- reused components;
- new reusable components;
- screenshots for mobile and desktop;
- exact list of genuine evidence versus demonstration-only content;
- test/build results;
- confirmation of zero QA/production/database/secret changes;
- blockers.

Human acceptance: an Alistair-style council custodian should understand within 30 seconds that BioVeracity can preserve the stream's baseline, restoration chronology, public observations and authoritative evidence as one defensible memory of place.

## North star

**Give the stream a memory.**

The technology disappears. The evidence does not.
