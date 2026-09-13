# Rosslare commitments: seed and search handover

Status: prepared and tested in isolation; not delivered to a hosted review queue or live search.

Related work: [Issue #38](https://github.com/bcromer77/bioveracity/issues/38), [ports report PR #39](https://github.com/bcromer77/bioveracity/pull/39), and [ingestion register #4](https://github.com/bcromer77/bioveracity/issues/4).

## What is ready

`data/ports/rosslare-ore-commitments.seed.json` contains ten distinct source representations accepted by the existing `validateEvidence` contract. Each has a stable representation ID and a short quotation anchor with an exact section and printed/PDF page locator. The source is the [Rosslare ORE Hub EIAR Non-Technical Summary](https://www.pleanala.ie/publicaccess/Case%20Documentation/323952/Applicant%20Documents/Application%20Docs/05.%20EIAR/Vol%201%20-%20Non-Technical%20Summary/Non-Technical%20Summary.pdf). Sections 4.2.3 and 4.3.3 were read on 13 September 2026.

The packet also contains proposed review claims, ten follow-up questions and two related conditional conclusions. These fields are analyst preparation, not source quotations or completed reviews. The existing sender submits only `records`; it does not ingest the additional commitment relationships into a graph or expose them in a new UI. The current search can retrieve the proposed claim text after a real review and source-permission decision. No application code has been changed.

The seed retains only twenty quoted words in total, with brief paraphrases and source references. It does not retain the full PDF. The acquisition flag applies only to these limited quotation anchors; it is not a blanket licence for the underlying report. Display, export and external embedding permissions remain unresolved in `source_registration_draft`, whose `permittedUses` is deliberately empty. The short anchors identify passages; reviewers must read the complete paragraphs at the source, not approve a claim from a two-word anchor alone.

All claims retain applicant attribution and `Implementation unverified.` Event and publication dates remain unknown. Application lodgement is not publication of the PDF and must not become implementation of a mitigation. No EPA comparison, monitoring result, spatial intersection or completion claim has been invented.

## Existing integration contract

Implementation reference inspected: `feat/document-intelligence-foundation` at `b530f8103d5b6f3127c36e29c37be46088fd947a` (PR #37), which includes the existing evidence intake, review, source register and search. This patch is stacked there to avoid changing the older `main` application. This is a repository snapshot, not a verified deployed SHA. Reconcile it with the user's current deployed release before integration; do not deploy the whole stack simply to obtain this data packet.

- Intake: `POST /api/ingest/evidence`, authenticated by `x-bioveracity-evidence-key`, enters `PENDING_REVIEW`.
- Source/version identity: the URL, content kind and per-commitment representation ID give ten separate document keys. Repeating unchanged records gives stable hashes and the existing duplicate path.
- Review: proposed fields do not contain `sourceChecked`, `claimSupported` or `publicationPermitted` attestations. An authenticated administrator must make a real decision.
- Search: current reviewed records also need public sensitivity, permitted reuse, a linked source register and the relevant permitted-use token. A verified claim alone is insufficient.
- Keyword search includes title, publisher, reviewed claim and excerpt. It works independently of embedding availability. Vector retrieval has not been tested for this packet and no model calls were made.

## Hosted execution

No `BIOVERACITY_EVIDENCE_ENDPOINT`, ingestion key, `DATABASE_URL` or dedicated evidence database connection was available in this task. Do not paste credentials into the report or commit them. Use the approved host's existing secret configuration.

After confirming the actual release and permitted use of the retained material, the existing sender can deliver this packet. From repository root, with the two `BIOVERACITY_EVIDENCE_*` delivery environment variables already configured and `PORTS_RECEIPTS_PATH` pointing to persistent private storage outside the repository:

```bash
python pipeline/deliver_evidence.py \
  --records data/ports/rosslare-ore-commitments.seed.json \
  --receipts "$PORTS_RECEIPTS_PATH" \
  --limit 10
```

This is a manual host handover, not an activated job. Confirm ten acknowledgements and retain remote IDs privately. The sender can acknowledge an existing record on retry; acknowledgement is not publication. Failed deliveries remain eligible for retry.

Then review the original source paragraphs, record the actual source licence/permission basis and attribution, classify only the uses authorised, link the source register, and accept or amend each proposed operator statement. Do not copy synthetic test permissions, reviewer identities or attestations into real records. If source reuse is not permitted, keep the items out of public search and retain only the allowed catalogue references.

After approval, the hosted acceptance queries are `Rosslare turbidity`, `Rosslare concrete` and `Rosslare wastewater`. Each should return the respective qualified claim and its original source locator. Also check a date filter does not invent completion dates. Record the deployed SHA, intake counts, permission/review decisions and actual returned IDs before reporting live completion.

## Verification

`nextjs_space/tests/rosslare-seed.test.ts` validates the packet against the actual intake/review contracts and executes the application's parameterised keyword-search SQL against isolated PGlite PostgreSQL.

It checks ten unique stable identities; pending and unlicensed records remain hidden; synthetic approved records yield ten qualified hits; topic queries select the correct records; source locators and unknown dates survive; a different project filter does not match; restrictions and source-use withdrawal remove hits; and fabricated quotation support is rejected.

The test uses synthetic review/source permissions solely in memory. It does not demonstrate real rights approval, HTTP ingestion, production database access, embeddings, authentication behaviour or a deployed UI.

Run from `nextjs_space` after installing the selected branch's dependencies and generating its Prisma client for an isolated environment:

```bash
node --import tsx --test tests/rosslare-seed.test.ts
```

Task verification used Node 24.19.0, PGlite 0.5.8, Prisma/client 6.7.0, tsx 4.20.3 and TypeScript 5.6.3. Dependencies and a temporary Prisma generation path were held outside the repository; the application schema and lockfile were not changed. A scoped strict TypeScript check covers this test and its imported evidence modules; no full application build or production check is claimed.

## Next owner

Codex has prepared the packet and isolated search proof. The host operator must run authorised intake and actual review/source classification against the confirmed release. Deployment remains with Bazil. This work adds no scheduler, spend or automatic public verification.
