# Council intelligence: commercial research and BioVeracity direction

Research date: 8 September 2026. Published offers are evidence of business models, not independently verified revenue, profitability or customer demand for BioVeracity.

## Comparable offers

| Provider | Published offer | Commercial lesson for BioVeracity |
| --- | --- | --- |
| Open Council Network | Free weekly updates for one council; Supporter £3.50/month or £35/year; Professional £50/month or £500/year; Enterprise from £5,490/year. Professional includes historical access, available transcripts and an AI meeting copilot. | Keep a useful public entry point; charge professionals for depth and ongoing monitoring. |
| Open Council Network research | Paid bulk exports scoped by councils and dates, with JSONL/Parquet, page attribution and stable document IDs; separate bespoke research support. | A reviewed, scoped historical evidence pack could be an early paid deliverable before nationwide live collection. |
| Open Council Network CivicOS | Council document workflows; constitution management described as available and committee management as in pilot. | Institutional workflows can expand value, but BioVeracity should first establish its environmental evidence service. |
| LandTech | Pro £150/month excluding VAT; Unlimited by enquiry. Combines planning, ownership, constraints and environmental data with professional workspaces; API by contact. | Buyers pay for decisions supported by connected data and workflows. Consultants and developers are potential customers even when councils are the data source. |
| Polimapper | Localised data visualisation and stakeholder tools for charities, associations, corporates and government; research services. No verified public price recorded here. | Place-specific evidence can help an organisation explain why an issue matters locally. Preserve separation between evidence and a customer's advocacy. |

Sources reviewed:
- https://opencouncil.network/account?section=membership
- https://opencouncil.network/about/researchers
- https://opencouncil.network/about/councils
- https://opencouncil.network/about
- https://land.tech/pricing
- https://www.polimapper.co.uk/

OCN's own pages differ on coverage: About says 175+ councils; CivicOS says 200+. Treat both as provider claims, not an audited coverage inventory. It is a possible supplier as well as a comparator. Assess licensed feeds or exports against direct council collection on coverage, extraction quality, update lag, provenance, permitted commercial reuse and cost. No purchase, access agreement or partnership is implied. Do not copy paid outputs or assume its summaries are original council evidence.

## BioVeracity's product

Councils are one institutional source layer in the chronological environmental repository. Link an actual passage in a council paper to the relevant river reach, catchment, port, operator, permit, measurement and reviewed community theme. A council boundary is not a catchment, and location within a council does not establish regulatory responsibility.

The core paid question is: what changed here, what evidence supports that, what did institutions decide, what remains unresolved, and what requires action next?

Initial customer hypotheses: environmental/planning consultancies preparing client evidence; infrastructure and port operators tracking place-specific change; institutional teams assembling adaptation evidence. Validate willingness to pay with a scoped paid pilot. No council budget or procurement route has been established by this research.

## Proposed commercial tests, not launched prices

1. Offer a Cambridge–Peterborough evidence pilot at a proposed £2,500–£5,000 for four weeks: named geography and question, agreed source coverage, source-linked chronology, gap register and final briefing. Price only after estimating retrieval, review and support time.
2. Test professional monitoring at £150–£300/month for a clearly bounded watchlist after reliable collection exists. Measure time saved and decisions supported; publish actual coverage and update lag.
3. Quote institutional and API work by geography, history, refresh frequency, users, data rights and analyst time. Avoid promising unlimited nationwide live coverage before measuring operating costs.

These are founder pricing experiments, not forecasts or competitor-equivalent functionality. Track paid conversion, repeat use, renewal intent, review hours per deliverable, retrieval failures and contribution margin after data/model/support costs. Sell the pilot before committing to expensive national backfills.

Awards can fund participation and build repeat community observations. Sponsors must not control findings, ranking or access private participant data. School-mediated anonymised themes remain soft signals; children are not inherently unbiased. Keep sponsorship revenue distinct from evidence conclusions.

## Build order and acceptance

This branch starts national breadth with an offline identity register: 413 principal councils and 15 separate UK strategic bodies from the sourced baseline. Cambridge–Peterborough remains the first detailed collection pilot. Kilkenny–Carlow remains a partner-development workstream, not a confirmed deployment.

Next bounded branch: inventory Cambridge, Peterborough, Cambridgeshire and CPCA meeting/consultation sources; implement a read-only adapter using reviewed fixtures; produce isolated staging documents. Acceptance: original source URL and passage locator, source version/hash, event date distinct from publication/retrieval date, idempotent re-import, revised-document history, pagination and retrieval failure checks. A scheduled meeting or proposed recommendation must not be represented as an adopted decision.

Then expand source discovery across the national register by platform family and jurisdiction. Prioritise agendas, minutes, supporting reports, consultations, climate/adaptation plans, environmental reports and spending/procurement notices. Verify budget status (proposal, allocation, award, expenditure) separately. Retain all coverage failures.

Connect authority entities to existing Asset/ChangeRecord architecture through explicit relations, not by treating every council as an environmental event or seeding fabricated asset histories. Date-version authority identities and boundaries before historical geographic joins. UK GSS codes identify areas; mySociety IDs are an upstream entity namespace. Irish IDs in this register are BioVeracity IDs, not official codes.

Better AI should be able to reanalyse preserved, permissioned evidence while keeping previous interpretations auditable. The value accumulates in source history, entity links, corrections and useful customer workflows. Model improvements alone do not establish truth or causation.

## Deployment boundary

No production data, app behaviour, database schema, runtime configuration or automatic deployment changes in this branch. No live collectors or new scheduled tasks. The existing AGENTS.md requires a confirmed Abacus deployment route and rollback before a production release. This directory is not yet connected to live search.
