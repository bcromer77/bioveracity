# Cambridgeshire first visitor collection

15 September 2026. Built on feat/honeycomb-search at 47dcbf50cc07ead2fc42ad075f3631a9ad5982b3, not older main. PR48 is a separate pending marketing request. Reconcile both with the actual Abacus checkout before release.

## Delivered in this change

Twelve editorial place entries in nextjs_space/lib/wild-counties/cambridgeshire.ts. Each has a source URL, publisher, section locator, check date, locality, seasonal interest, access notes and a related-place connection. All summaries paraphrase reviewed primary publisher pages. No raw pages, photographs, business contact details, sightings or precise wildlife locations are imported. No paid APIs, background jobs or database changes.

Adds England as a supported editorial jurisdiction without changing the Irish biodiversity API filters. The 32 Irish county entries remain; Cambridgeshire & Peterborough is entry 33. The province field retains compatibility and uses East of England for this region. No new Ireland API call is made for Cambridgeshire.

/wild uses the existing topic-aware search function instead of matching only county names. /wild/cambridgeshire renders the 12 entries, source references using the existing on-site attribution component, and internal related-place anchors. Query examples: /wild?q=snowdrops, /wild?q=bluebells, /wild?q=Peterborough. This is substring discovery of authored content, not natural-language semantic retrieval or live phenology.

## Evidence boundaries

Source-reviewed means supporting publisher text was read during preparation, not independent ecological certification. Site-manager accounts and Natural England descriptions retain attribution. Connections are explicitly editorial comparisons unless the named source describes the landscape relationship. They do not assert continuous routes, distances, species movement or effects between sites. These entries are places of interest, not approved business members.

Seasonal interest is distinct from current observations. Hours, fees, bloom dates and access restrictions must be checked again before travel. Dates record source inspection, not observation or publication. Publication dates remain unknown where not established. No bulk licence grant is implied by public accessibility: retained text is our short editorial paraphrase. Natural England's linked publication states OGL v3 except third-party material. Other publishers' full text and images have not been licensed or copied.

The three entries derived from the shared Natural England NNR publication are deliberately concise. Wicken's inconsistent headline species totals are omitted. Anglesey specialist-tour dates are omitted from evergreen content. Gamlingay's no-parking/permissive-access restriction and Woodwalton's flooding/access limitations are retained.

## Content map

- Anglesey Abbey: snowdrops and cultivated varieties; linked to Botanic Winter Garden.
- Cambridge University Botanic Garden: winter light, stems and scent; linked to Anglesey.
- Wicken Fen: cuckoo/warbler and hobby/dragonfly relationships; linked to Ouse Fen.
- Fulbourn Fen: chalk water, orchids and grazing; linked to Barnack.
- Gamlingay Wood: soil, flowers and coppicing; linked to Holme Fen.
- Fen Drayton Lakes: quarry restoration and wetland edges; linked to Ouse Fen.
- Ouse Fen: developing reedbeds; linked to Fen Drayton.
- Nene Washes: seasonal inundation and waterfowl; linked to Ferry Meadows.
- Ferry Meadows: visitor access and managed water habitats; linked to Nene Washes.
- Holme Fen: birch and remnant fen habitat; linked to Woodwalton.
- Woodwalton Fen: fen survival and flood-storage access; linked to Holme.
- Barnack Hills and Holes: quarry history and limestone grassland; linked to Fulbourn.

## Hosted acceptance and next ingestion

No merge, deployment or production ingestion is claimed. Existing Asset/Event records and EvidenceDocument/Review records remain unchanged. This collection will appear on the Wild route only after integration and deployment.

Before release: full app typecheck/build, render /wild and /wild/cambridgeshire on desktop/mobile, search snowdrops, follow related-place anchors and expand source references. Confirm Irish county API behaviour is unchanged and that neither site cards nor studio imply confirmed membership. Confirm target Abacus SHA and rollback. The PR is stacked to preserve existing work.

Next evidence-search step: use the existing source register/intake/review workflow for approved source passages, preserving acquisition/display/embedding rights and dates. Do not copy these editorial review labels into EvidenceReview or auto-approve publisher text. A live query receipt is needed before claiming honeycomb evidence ingestion.

Next visitor-content step: verify public entrance coordinates and route accessibility, then add actual journey distances and licensed photographs. Research local farm shops, cafés, makers and hotels as private prospects; publish membership only with agreement. No business outreach was sent.

## Local verification

Passed existing Wild Counties architecture checks and added Cambridgeshire discovery/access/relationship checks using Node 24.19.0 with tsx 4.20.3 imported as a loader (the tsx CLI IPC socket is unavailable in this environment). Strict scoped TypeScript 5.6.3 checking passed for registry, content, types and tests. Both changed TSX pages compiled with esbuild 0.28.2. git diff --check passed. This is not a full app typecheck, production build, browser visual check or live-search test; those remain release gates.
