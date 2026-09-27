# BioVeracity — Outreach Front Door & Audience Routing Plan

**Status:** PROPOSED ONLY — communications/front-end plan.  
**Release boundary:** Do not merge or deploy until Gate 3 / production baseline work is explicitly cleared.  
**Purpose:** Prepare BioVeracity for high-volume, highly targeted outreach without turning the public site into a catalogue of sectors.

## North star

**Give every place a memory.**

The homepage owns one proposition. Outreach explains why that proposition matters to a particular recipient. The website then gives that person an unmistakable door into the relevant BioVeracity experience.

Do not create hundreds of sector-specific landing pages. Build a small number of durable audience routes that can support hundreds of individually relevant outreach programmes.

## Public-marketing restriction

**Do not mention Fodder in generic public marketing surfaces.**

No Fodder name, family details, photographs, logo, partner status, testimonial or implied endorsement may appear on the homepage or generic audience pages unless separately and explicitly authorised.

## Proposed public audience doors

### 1. Places & Communities

For clubs, hotels, cafes, estates, visitor attractions, wetlands, community organisations and other custodians of a physical place.

Core proposition:

> **Your place. Every season.**

Build a lasting record of wildlife, grounds, community observations and environmental improvements around a place. Keep photographs, changes and source-linked evidence together for visitors, members, future custodians and appropriate funding/grant evidence.

Do not claim that BioVeracity obtains grants, guarantees grant eligibility or certifies environmental performance.

### 2. Ecology & Professionals

For ecologists, planners, consultants and land/environment managers.

Core proposition:

> **Understand a site. Follow the evidence.**

Bring scattered environmental records and authorised private documents together while preserving source, date, geography, uncertainty and review status.

### 3. Infrastructure & Environment

For major projects, ports, utilities, developers, environmental/sustainability teams and long-duration infrastructure programmes.

Core proposition:

> **Know what the evidence showed then, what it shows now, and what changed in between.**

Connect environmental reports, engineering studies, monitoring, commitments and later evidence to the places and periods they concern.

Do not imply compliance certification, causation, or unsupported ESG scoring.

### 4. Councils & Public Bodies

For planning, biodiversity, monitoring, enforcement and other public-sector teams.

Core proposition:

> **What was promised here?**

Preserve what was known, required, monitored, subsequently evidenced and still unresolved across long-lived places and commitments.

### Public exploration

Wild Counties / Living Place experiences remain the public exploration expression. They should not force commercial prospects to decide whether they are a "Wild County".

## Homepage rule

Do not redesign the current otter-led homepage merely for outreach.

Protect:
- the otter hero;
- "The otter hasn't come back. When did it leave?";
- the place-memory proposition;
- nature before interface;
- the existing emotional distinction from generic environmental SaaS.

Improve only the information architecture required to make the audience doors obvious.

Every destination's first screen should answer:

1. **What is this?**
2. **Who is it for?**
3. **What can I do here?**
4. **What should I click next?**

## Signed-in terminology

Review the distinction between "My venues" and "My places".

The target conceptual model is:

### Your Places

Places the authenticated person is authorised to care for, observe or manage.

A Place is persistent and is not synonymous with one user's account. Multiple individually authenticated family members, staff, committee members or other authorised custodians may contribute to the same Place subject to place-scoped permissions and audit history.

### Your Professional Work

Private cases, investigations, evidence review and reporting.

Do not implement a duplicate identity or tenancy system. Inspect and extend the smallest proven existing account/workspace/WildHub model.

## Outreach-to-site continuity

High-volume outreach must remain targeted rather than becoming generic bulk messaging.

Target operating path:

```
BUYER SCOUT
→ RESPONSIBLE PERSON
→ PLACE / PROJECT
→ EVIDENCE BURDEN
→ RELEVANT BIOVERACITY DOOR
→ PERSONALISED OUTREACH
→ RELEVANT EVIDENCE NOTE
→ RESPONSE
→ HONEYCOMB MEMORY
```

The first sentence of outreach should begin in the recipient's world, not with a generic description of BioVeracity.

Examples of audience framing:

- club/grounds custodian: the long-term memory of grounds, improvements, wildlife and evidence useful to future committees or appropriate funding applications;
- wetland/fen/estate custodian: baseline, intervention, observation and what changed through time;
- infrastructure/environment lead: environmental evidence accumulating across years, sources, commitments and teams;
- council/public body: long-duration commitments outliving the people and systems that first recorded them.

These are communication patterns, not permission to invent facts about a prospect.

## Contact-context continuity

The generic Contact page is currently too context-free for scaled outreach.

Design the smallest mechanism that can preserve why a visitor arrived (audience/use-case context) without creating separate account systems or a complicated form.

Requirements:
- same BioVeracity contact mechanism;
- preserve campaign/use-case context where appropriate;
- no sensitive tracking by default;
- no misleading pre-filled claims;
- clear consent/privacy handling;
- recipient can still navigate normally outside the campaign path.

## Communications acceptance

Before scaled outreach begins, demonstrate at least one complete communication journey for each of the four audience doors:

1. targeted outreach;
2. correct public destination;
3. recipient understands relevance in the first screen;
4. CTA matches the outreach;
5. contact/enquiry retains appropriate context;
6. no Fodder disclosure;
7. no unsupported grant, compliance, causation or environmental-performance claim.

## Front-end acceptance

When implementation is authorised later:

- preserve the current homepage's nature-first visual identity;
- avoid generic SaaS navigation;
- avoid proliferating sector pages;
- mobile navigation must remain understandable;
- signed-out and signed-in routes must be clear;
- account/place terminology must align with multi-user Place stewardship;
- no cross-Place information leakage;
- accessibility checks;
- production build/typecheck/regressions;
- screenshots of desktop and mobile audience journeys;
- exact branch/SHA/tree/files/tests reported.

## 500-programme principle

**500 outreach programmes do not require 500 propositions.**

They require a small number of excellent public doors and hundreds of evidence-grounded reasons for the right person to walk through the right one.

## Definition of done

Report separately:

**PROPOSED → IMPLEMENTED → TESTED → MERGED → DEPLOYED → VERIFIED LIVE**

This document is PROPOSED ONLY until Gate 3 and the production baseline are explicitly cleared.
