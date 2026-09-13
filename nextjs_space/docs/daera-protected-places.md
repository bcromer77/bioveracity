# DAERA protected-place evidence seed

This adapter creates a review-queue payload from official DAERA protected-area profiles. The first bounded fixture covers Strangford Lough SAC, SPA and Ramsar records and can enrich a future Killyleagh/Fodder place experience.

## What it does

- preserves the DAERA publisher, source URL, designation, supporting passage, claim and date precision;
- leaves publication dates unknown where DAERA does not display one;
- exports schema 2.1 JSON for the existing ingest review flow;
- keeps public publication disabled until human review.

Run from `nextjs_space`:

```bash
yarn export:daera --place=strangford-lough --out=/tmp/strangford-lough.json
yarn test:daera
```

The export command does not call DAERA, write the application database, publish a page or deploy code. A live retriever can be added only after the upstream machine-readable resource schema and licence have been captured in a tested fixture.

## Badge boundary

DAERA records designate and describe places. They do not approve, certify, list or endorse nearby businesses. “BioVeracity Evidence-Linked Place” is the proposed public wording.

A business may display that mark only after BioVeracity has recorded:

1. verified business identity and page ownership;
2. permission and provenance for uploaded media;
3. at least one human-reviewed, source-linked local story;
4. a visible review date, corrections route and evidence limitations;
5. no unresolved safety, privacy, copyright or misleading-claim blocker.

The mark must never imply regulatory compliance, superior environmental performance, verified biodiversity improvement or DAERA endorsement. Suspension or removal must remain possible when evidence becomes stale or a material correction is unresolved.

## Scaling to business listings

DAERA is an environmental evidence source, not a business directory. A large listing inventory therefore requires a separate, permissioned business-onboarding or official-directory source. Listings can exist as drafts, but the BioVeracity mark is earned record by record after review. For Fodder, the first page should connect the business’s own licensed photographs and observations to the wider Strangford Lough evidence without claiming that species were observed on Fodder’s property unless the submitted record supports that claim.

