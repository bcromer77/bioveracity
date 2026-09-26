# Codling self-service evidence workflow and source connections

26 September 2026. Internal engineering handover, not a client assurance report.

## Delivered in this increment

A bounded, read-only MARA determination-metadata adapter using the existing ingestion contract and transport, with sixteen synthetic offline tests. A scoped strict TypeScript check and those tests passed. The existing CI workflow is amended to run the new tests against this PR's base branch; the remote result must be checked separately.

This is NOT a complete self-service release. There is no new customer-facing endpoint, login expiry, UI, persistence, source schedule or model-drafting feature in this increment. No customer data, credentials, paid API calls, invitations, charges, production migrations or deployment were used or performed.

The branch preserves `docs/CODLING_PRIVATE_REVIEW_REQUEST.md` at parent `15e7f7a3680e9f0e4c416e6750d75b5169e08a5c`, based on PR77 `64b0d8d3759c17381f8c2aede0d1602d4f4079dc`. The earlier request branch had no PR in the directly inspected collection. Its access controls remain requirements, not implemented functionality. Do not create competing access work.

## Customer outcome

A customer contributor adds a permitted document or approved public source. The service prepares searchable passages and proposed connections to a selected question. A nominated reviewer checks those connections and their interpretation. The authorised issuer prepares either a technical brief or a separately approved stakeholder explanation, with source versions and review history attached.

The customer must be able to repeat this without the founder researching and laying out every issue. Self-service removes founder intervention; it does not remove specialist review. A read-only prospect grant is not contributor, reviewer or publication authority.

Initial scope remains one agreed sub-item of FIR 6(g). The approved report's ten working days is a bounded service-delivery period after sources, permissions and a reviewer are available. It is not an engineering estimate for the complete software described here.

## Source connections

### MARA register: adapter written; hosted query not established

Official entry point:
https://www.maritimeregulator.ie/our-work/mara-geoportal/data-downloads/

Published service:
https://services-eu1.arcgis.com/wTJ77B55ryKaMXuv/arcgis/rest/services/MARA_MAC_MUL_Determined_Applications/FeatureServer

Layer 0 is determined MACs; layer 1 is determined MULs. The published schema identifies the register reference, site reference, authorisation status/type and nullable date fields. The adapter requests only those fields plus OBJECTID, one bounded page, an exact reference and no geometry. It retains raw register dates rather than inventing observation dates, legal effective dates or confirmed operational triggers.

The public service directory was readable. Exact-record JSON requests were not retrievable in this research environment. Successful hosted access, the exact mapping of Codling's instrument identifiers into GIS register identifiers and source freshness remain UNVERIFIED. This does not establish that MARA is unavailable or that a permission is absent. No fixture purports to be a Codling record. Do not silently invent identifier aliases.

The service copyright field is empty. No reuse licence is inferred. `acquisition_permitted` stays false under the shared contract until the existing authorised acquisition/reuse process resolves permission. No scheduler registration or automatic public indexing is added. Registry metadata does not replace the operative licence, MAC, amendment or correspondence.

### MARA documents: approved document list and uploads

https://www.maritimeregulator.ie/application/mul230034/

The application catalogue links the licence, determination and supporting material. No complete dossier API or automated submission API was established by this review. Use an approved source manifest of specific documents and permitted customer uploads. A page update is not automatically a changed legal obligation. Record exact bytes where permitted, source URL, checksum, version, retrieval failures and dependencies requiring review.

### ACP and applicant material: catalogue discovery plus customer upload

https://www.pleanala.ie/en-ie/case/320768
https://codlingwindparkplanningapplication.ie/fir-response/

These identify the case and response materials. No documented complete planning-dossier API was established. Use a bounded approved source list, with upload when retrieval is unavailable or not permitted. Do not bypass access restrictions or run an uncontrolled crawl. Keep original application, request and response versions separate; discovery does not approve a passage or determine technical adequacy.

### NPWS boundaries: official services verified; adapter not written

https://www.npws.ie/maps-and-data/designated-site-data/download-boundary-data
https://services-eu1.arcgis.com/Jhij7i46ouO8Cc0N/arcgis/rest/services/NPWSDesignatedAreas/FeatureServer/
https://dservices-eu1.arcgis.com/Jhij7i46ouO8Cc0N/arcgis/services/NPWSDesignatedAreasWFS/WFSServer?service=wfs&request=getcapabilities

The official site links REST and WFS services. The REST service lists SPA (0), pNHA (1), NHA (2), SAC (3), reference system 2157 and CC BY 4.0 attribution. Confirm individual layer schemas before writing queries. Retain site identity, original geometry, coordinate system, source scale, transformations and version. Current public boundaries must not overwrite the exact layers filed with a historical application. A display overlap does not establish an impact or legal applicability. Apply the published legacy-boundary caveats.

### Customer private records: upload first

Reuse encrypted private-case intake, passages, revisions and reviews. A later SharePoint or Drive connection must use the customer's authorised tenant, limited folder selection, protected tokens and revocation/deletion handling. The founder's personal connected accounts are not a substitute. No customer connection or consent request has been created.

## Application operations to implement next

Extend the existing workspace/case API routes and services; do not create a parallel Codling document pipeline. These are proposed operations, NOT endpoints shipped by this increment. Reconcile their paths with the existing route map before implementation.

| Operation | Server contract | Customer outcome |
| --- | --- | --- |
| Source selection and refresh | Fresh identity, case permission and any timed grant; server-stored approved source selection; bounded durable idempotent job. No arbitrary client URL or SQL. | Add or refresh a source without founder intervention. |
| Intake status | Authenticated queued/running/partial/failed/needs-review/completed states. Separate last attempted retrieval from last successful retrieval and review. | See what loaded, failed or needs review. |
| Question-to-passage link | Validate that document, passage and version belong to this case. Store source type, proposed link and attributable review outcome. | Review the question beside the source passage. |
| Change review | Compare known versions, preserve issued records and identify dependent findings. | Decide whether earlier wording remains supported. |
| Draft briefing | Select internal or external audience and a permitted evidence snapshot. Only that selection is used for drafting. | Produce an editable source-linked draft. |
| Approve and issue | Recheck role, exact versions, disclosure choices and expected revision; retain stable report and manifest. | Customer's authorised colleague approves and issues. |
| Sharing and expiry | Named project/output-specific grant, rechecked on every protected asset/citation/export request. | Share selected work for an approved period. |

The browser calls BioVeracity, not providers with embedded credentials. Implement actor/case quotas, file/processing limits and explicit spending ceilings. Prevent duplicate jobs, exports and notifications across restarts. Never execute a URL or instruction merely because it appears inside an uploaded document. New network fetching needs destination validation, redirect policy, private-network protection and response/time caps, not a general fetch proxy.

## Identity and disclosure

Implement the preserved private-review request using existing identity. Do not assign the global DEMO or ADMIN role to expose one project. Confirm the proposed fixed 14-day period before issuing a real grant. Server time, not a browser clock or repeat login, controls expiry. Protect HTML, PDF, source passages, direct files, HEAD/Range, caches and prefetch paths. A public asset with a private front page is not protected access.

Distinguish viewing, contributing, reviewing, issuing and publishing. External drafting uses only the evidence approved for the external audience, not the full private corpus with a later instruction to redact it. Contact details, private commentary, sensitive locations and excluded layers must not leak into the text, map, source links or generated files. Expiry prevents future requests; it cannot recall authorised downloads or screenshots.

## Drafting and retrieval

Reuse existing retrieval and case evidence boundaries. Semantic similarity proposes a connection, not proof. Any external model provider must have approved data handling and receive only the permitted case/audience evidence. Existing credentials or spend budgets have not been verified; no paid call was made here. The customer should not need to buy separate AI or data accounts for the initial service.

Source documents are untrusted data, never executable instructions. The drafting model cannot grant access, alter a source, approve its own finding or publish. Each draft finding must carry real passage identifiers. Reject nonexistent or out-of-snapshot citations; a qualified reviewer checks whether the passage supports the wording. A manual, selected-citation brief remains the fallback when drafting is unavailable.

## Acceptance and release sequence

1. Private access: complete and test the preserved access request on a confirmed host/base. Prove wrong-account, signed-out, exact-expiry, revocation and direct-file denial.
2. Customer document journey: upload, parse, select a question, review passages and issue a technical brief using separate synthetic contributor/reviewer identities. Include duplicate intake, failed parsing and stale revision conflicts. Check actual source-pack sizes against current case limits of 100 documents, 50 MiB and 1,500 passages. GIS validation is separate.
3. Source refresh: host-probe the MARA lookup and establish exact project mappings and source-use permission before enabling ingestion. Add source status and controlled retries through existing infrastructure. NPWS and catalogue adapters each need their own tests; an unavailable source is not 'no change'.
4. External issue: create a separately approved stakeholder explanation and test exclusion of private material. Both outputs must reopen the correct source version. A changed underlying record flags dependent explanations for review.
5. Controlled release: full app types/build/CI, isolated hosted database/storage, mailbox and recovery acceptance, approved assets, named reviewer/issuer and explicit deployment authority. Record blocked tests as blocked.

The decisive customer test is: a contributor adds a second document version; the reviewer checks the changed evidence; the issuer produces internal and stakeholder briefs; both open the correct source passages; an unrelated account is denied; an expired guest loses future access. Measure actual founder intervention and customer effort, not endpoint response codes alone.

## Protected work and ownership

This repository is public. Do not commit the private report, HTML payload, prospect contacts, customer files or credentials. Synthetic fixtures only. Preserve the white 19-page watermarked Revision 03 report unchanged as a demonstration. Preserve the approved fuchsia/coastal introduction without its diagonal watermark. A real reviewed deliverable is a new authorised issue, not removal of a watermark from this demonstration.

Codex owns implementation. Abacus supplies the hosting project, isolated QA URL, full deployed SHA, migration-history reconciliation, actual build, recovery and rollback evidence. Bazil confirms intended host, recipient, access period and customer reviewers. Earlier AeroVeracity naming remains unresolved: recording development here does not deploy to either application. Preserve PR70-77 ancestry and unrelated BNG/branding work. Do not treat this branch as the production release candidate without reconciliation.

## Verification recorded

- The shared helpers used in the isolated test run were byte-matched to GitHub blobs `056b1b2866655b4520f4ac788a2dbcfcce77f6db` (connectors-scotland.ts) and `997bb97ecb32078b0ed4c8f46f9533d5778d28e9` (evidence-contract.ts).
- Strict TypeScript compilation of the adapter/test and imported helpers passed.
- Sixteen synthetic offline tests passed, zero skipped: query boundaries, field projection, date preservation, identity/version hashes, input rejection, failure handling, pagination, size cap and permission-resolver ordering.
- Resolver-order tests are not database-backed tenant or timed-grant acceptance. These remain required.
- Exact-source JSON lookups were not retrievable here. Service schema discovery is not a working end-to-end source refresh.
- Full application build, production deployment, mailbox delivery, database migrations and hosted customer journey were not performed. CI is wired, not claimed green until its actual result is known.
