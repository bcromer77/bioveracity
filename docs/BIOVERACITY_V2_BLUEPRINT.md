# BioVeracity V2 — Every guest sees something different

Decision brief · 21 September 2026 · Proposed V2, not deployed functionality

## The product idea

Make every contribution easy, every interpretation traceable, and every season comparable. A guest brings a photograph; BioVeracity helps turn it into a useful observation. A venue receives an edited weekly view and chooses what to publish. Over time, those observations build a place’s visual history. Where a site has formal biodiversity obligations, an ecologist can connect appropriate evidence to habitat parcels, surveys and management actions.

Guest and staff contributions have equal standing. Photographic quality, scientific usefulness and publication permission are independent. A beautiful wide shot and a poorly composed photograph of a diagnostic leaf can both matter.

The valuable invention is the connection between capture, interpretation and the next useful observation. For example: “A second photograph of the underside would help distinguish these two possibilities.” Make the next useful action easier than filling in a form.

## What is already in Git

[Draft PR #70](https://github.com/bcromer77/bioveracity/pull/70) publishes the tested venue photo journal implementation on `feat/venue-weekly-photo-review`, based on `feat/identity-first-public-navigation`. Remote commit: `68891797410e4fabf6343097f9a34e5f9509b849`. The remote tree matches the tested local tree.

It includes account-free adult guest contributions, permission capture, owner review, separate editorial approval for public publication, JPEG/metadata downloads, dated chronology and an opt-in weekly email job. The job is provided with a scheduler example; production scheduling, provider acceptance and deployment have not happened. Feature and sending flags remain disabled by default. Local domain/UI tests, TypeScript, schema validation and production build passed. Browser acceptance remains outstanding; ESLint was blocked by a cached dependency mismatch.

This brief is a separate V2 proposal. No recognition models, long-term archive or BNG reporting claims were added to that PR.

## A photo editor’s workspace

The visual direction should feel like a carefully edited nature publication: generous photographs, restrained typography, clear credits and very little interface competing with the image. The private editing surface and public story serve different purposes.

| Surface | Layout and behaviour |
| --- | --- |
| Weekly email | One lead photograph, a compact contact sheet of supporting images, the week and contributor credits. Primary action: “Review this week”. Download and publication decisions happen in the authenticated workspace. |
| Private contact sheet | Equal-height rows that preserve image proportions; full-frame inspection on selection. Date groups, keyboard selection, multi-select, duplicate grouping and an accessible mobile equivalent. Avoid forced square crops that hide diagnostic details. |
| Selected photograph | Large image on the left; concise caption, photographer, capture date and place on the right. Expandable identification evidence. Persistent actions for selecting, requesting publication and downloading. |
| Compare | Two full frames, linked zoom, dates and location certainty visible. Compare a fixed viewpoint across seasons or examine alternative views of one organism. Different camera positions and seasons must be explicit. |
| Public story | One opening image followed by a deliberate rhythm of habitat views, organism details and guest perspectives. Captions explain what was observed; uncertain names remain uncertain. Publish individual frames or a curated set. |
| Map and timeline | The same filtered collection in spatial or chronological form. Exact points only when justified; otherwise show a parcel, venue area or uncertainty circle. Public locations may be deliberately coarser. |
| Ecologist view | Habitat parcel, target, due survey, related evidence and unresolved gaps. The same assets remain available without presenting a gallery as a completed survey. |

Keep three separate states visible when relevant: publication approval, identification review and suitability for a specified monitoring requirement. “Published” must never silently mean “verified”. Likewise, a venue should be able to keep a scientifically useful image private.

The long-term public experience starts with years, opens into seasons, then reveals individual contributions. Offer “same place, same season” comparisons. Preserve undated submissions in an explicitly undated group; do not substitute upload date for capture date.

## The simplest contributor journey

1. Scan the venue QR code or open its contribution link.
2. Choose photographs, take a photo or, in a later audio release, record a short sound.
3. Confirm the suggested place and date if available. “I don’t know” is acceptable. Existing photos may have been taken elsewhere.
4. Accept clear storage/publication permissions, optionally add a credit, and upload. No taxonomic knowledge or account is required for the basic adult journey.
5. Receive a receipt that permits correction/withdrawal and explains whether a name is suggested or reviewed. Optional follow-up can request one useful additional view.

Plan mobile HEIC support, resumable uploads and poor-connectivity recovery. Preserve V1’s adult contributor boundary until a separate child/school consent design exists. Machine-learning training permission must be a separate choice; V1’s venue-use permission does not authorise a training dataset.

## Recognition: build our workflow around established models

Yes, image and sound recognition are technically feasible. Start with existing, licensed foundation models and build BioVeracity’s own extraction, evidence, calibration and review workflow. Training a general biological model from scratch is not the first investment.

| Candidate | Proposed use | Decision boundary |
| --- | --- | --- |
| [BioCLIP 2, official repository](https://github.com/Imageomics/bioclip-2) | Biological image embeddings; candidate taxa; visual similarity | Its [model card](https://huggingface.co/imageomics/bioclip-2) specifies MIT licensing and identifies taxonomic imbalance. Benchmark on local, independently reviewed images before selecting it. |
| [BioCLIP 2.5 Huge](https://huggingface.co/imageomics/bioclip-2.5-vith14) | A second candidate for difficult image classification | Also listed as MIT; larger inference requirements. Compare measured accuracy, latency and cost against version 2. Newer does not automatically mean the right operating model. |
| [BirdNET Analyzer](https://github.com/birdnet-team/BirdNET-Analyzer) | Bird-call candidates with time segments for human listening | Code is MIT but model weights are CC BY-NC-SA 4.0. A commercial BioVeracity deployment needs suitable additional permission or a commercially compatible alternative. |

Do not equate a repository’s code licence with rights to its model weights or source photographs/recordings. Any reference collection needs per-asset rights, attribution and permitted uses recorded. Do not scrape community media into a commercial training set merely because it is publicly accessible.

Proposed processing: detect useful regions, assess blur/scale/exposure, compute embeddings, propose taxonomic candidates, use location and season as fallible context, then decide whether to suggest a name, use a broader group or abstain. Preserve alternative candidates, model version, input crop, raw score and calibration version. A similarity score is not a probability.

The mathematical frame is a joint inference over image/audio evidence and place/time context: estimate P(taxon | media, place, season, capture quality). Do not simply multiply classifier scores as if they were independent probabilities. Missing metadata remains missing, and geographical priors must not eliminate unusual visitors or newly arriving species.

Several insects may occupy one image; several images may describe one encounter. Separate media, encounters, organisms and identifications. Exact hashes identify identical files; perceptual similarity flags possible repeats. Neither proves that two photographs depict the same individual animal. One hundred photographs must not automatically become one hundred biological occurrences.

Evaluate with expert-reviewed local material, splits by encounter/site/date, difficult lookalikes and unknown taxa. Report accepted-label precision, coverage/abstention and reviewer time by taxonomic group. An overall accuracy figure can conceal failure on tiny insects. No accuracy claim has yet been established for BioVeracity.

## The Edwin Land insight

Design the capture process to acquire information that the current image lacks. For small insects, optical detail, focus, scale and useful angles are more important than making a blurry image look sharp. Offer optional macro stations at participating venues: stable support, scale reference, controlled illumination and multiple views, without encouraging disturbance or handling.

Polarisation is a worthwhile experimental track. [Research on a beetle using polarisation-resolved hyperspectral imaging](https://arxiv.org/abs/2412.16399) demonstrates specialised measurements of biological optical structure. It does not demonstrate universal insect identification from ordinary phone photographs. Standard RGB images do not preserve the full polarisation measurements needed to recreate that experiment.

A research prototype could compare ordinary macro images with calibrated polarised illumination/capture. Keep every raw measurement and test whether it actually improves expert-confirmed discrimination. Avoid generative enhancement of evidential details. Some records will remain identifiable only to a broader group; even expert recording systems distinguish plausible records from those that can be verified. [iRecord verification guidance](https://irecord.org.uk/help/records-verified) explicitly recognises insufficient photographic detail and uncertain location as limits.

## Cambridgeshire and the 30-year benchmark

The 30-year requirement is part of England’s BNG framework, not a blanket obligation on every venue. For applicable developments the baseline national gain is 10%, measured through the statutory biodiversity metric; off-site gains and significant on-site enhancements have long-term management obligations. Eligibility has changed during 2026, so record the applicable policy version for each site rather than hard-code assumptions from older guidance. [Defra’s current overview](https://www.gov.uk/guidance/understanding-biodiversity-net-gain)

“Cambridgeshire Council” must be resolved to the actual authority for a particular site. The County Council’s [Biodiversity Strategy](https://www.cambridgeshire.gov.uk/asset-library/Biodiversity-Strategy.pdf) promotes habitat improvement, connectivity and better understanding. Its [public strategy page](https://www.cambridgeshire.gov.uk/residents/climate-change-energy-and-environment/improving-the-natural-environment/biodiversity-and-greenspaces/biodiversity-strategy) expressly supports community wildlife surveys. These strategic aims do not themselves supply a universal site audit calendar.

Greater Cambridge Shared Planning serves Cambridge City and South Cambridgeshire. Its [September 2026 committee report](https://scambs.moderngov.co.uk/documents/s144148/BNG%20Rpt%20-%20Final.pdf) identifies the difficulty of monitoring dispersed on-site schemes and contrasts their risks with more systematically managed habitat banks. That supports a possible need for organised field evidence and reminders. It is not an endorsement of BioVeracity. The report contains inconsistent agreement totals; those totals are not used here.

Greater Cambridge’s [2024 pre-application advice](https://www.greatercambridgeplanning.org/media/r3ylsoqk/biodiversity-net-gain-preapplication-advice-note.pdf) stresses competent baseline/condition assessment and seasonal survey suitability. Use that methodological lesson, while treating its older eligibility guidance cautiously. Its [April 2024 committee update](https://democracy.cambridge.gov.uk/documents/s65686/Cam%20City%20Planning%20Committee%20Biodiversity%20Net%20Gain%20Update%20April%202024.pdf) also records investment in monitoring systems: integration with existing planning/GIS processes matters.

The controlling documents for an individual scheme are its approved plans, conditions, legal agreement and HMMP. Record the responsible authority/body, obligation trigger, required duration, survey/report dates and amendments. Do not start a statutory clock at first upload, and do not invent a universal year 1/3/5 reporting schedule. Monitoring must support assessment and adaptive management under the actual agreement. [Government HMMP guidance](https://www.gov.uk/guidance/creating-a-habitat-management-and-monitoring-plan-for-bng)

## Natural England reporting: concrete mapping

Natural England provides HMMP resources and both narrative and quantitative monitoring templates. These are guides; authority-specific requirements still apply. The following mapping was checked against the actual downloadable Word monitoring template, not inferred from a general biodiversity page. [JP058 resources](https://publications.naturalengland.org.uk/publication/5813530037846016)

| Template field/section | Proposed BioVeracity record |
| --- | --- |
| Cover and MR-T01 | Site/planning/register references; monitoring year; version, author and approval dates |
| MR-T02 | Survey organisation/person, dates, competency, completed methods, conditions and limitations |
| MR-B02–04 | Management progress, successes, challenges and urgent remedial issues |
| MR-F01 | Selected site photographs linked to originals, dates, viewpoints and contributors |
| Habitat target sections | Parcel-specific habitat, hedgerow and watercourse assessments against agreed targets |
| MR-B05–06 | Next actions and adaptive management, with accountable people and due dates |
| MR-T03–06 | Creation, enhancement, management and monitoring activity registers; delivery, liability and ecological sign-off |

Source: [Natural England Monitoring Report Template 1.1](https://publications.naturalengland.org.uk/file/4507840669286400). Mapping is a product proposal, not a claim of official certification. Companion habitat-condition tables and the quantitative workbook require field-level mapping in implementation; no claim is made that an export already conforms.

Citizen photographs are supporting material. Verified species presence does not alone demonstrate habitat condition, biodiversity-unit delivery or discharge of obligations. Scheduled, competent surveys remain separate. Keep an explicit “evidence missing” state; absence of photographs is not ecological absence.

## How V2 connects to the code

| Existing component | Proposed extension |
| --- | --- |
| `nextjs_space/lib/wild-hubs/photos.ts` and upload pipeline | Extract metadata before re-encoding; private original storage, asset hashes and derivative lineage. Keep the safe public derivative path. |
| VenuePhoto journal | Link media to canonical observation events without duplicating guest identity, permissions or venue ownership. |
| `nextjs_space/lib/observations/contract.ts` | Reuse time precision/basis, spatial uncertainty, effort, coverage, source and finding types. Add a versioned identification record and explicit reviewer authority. |
| `nextjs_space/lib/observations/store.ts` | Reuse source/revision provenance. Enforce venue/workspace permissions at every new caller; this internal store is not itself an access boundary. |
| Weekly digest job | Feed a curated contact sheet from authorised assets; retain opt-out, expiring previews and ambiguous-delivery reconciliation. |
| Publication review | Preserve existing approval controls while adding separate taxonomic and ecological-assessment decisions. |
| New habitat module | Versioned parcel geometry, baseline, target, HMMP/legal references, management actions, surveys and report snapshots. |

V1 retains resized JPEGs and strips EXIF/GPS. It cannot reconstruct discarded originals or metadata. Legacy images must remain labelled as processed assets; invite voluntary re-upload when original evidence is needed.

Store future originals in private object storage; relational records hold ownership, consent, lineage and workflow. Add spatial indexing and a vector index only where needed. Maintain exact hashes, derivative links and append-only interpretation revisions. A hash shows byte identity, not the truth of the photographed scene.

EXIF can be absent or edited. Keep its raw value, parsed value, timezone/precision and source; distinguish uploader corrections. Browser GPS at upload is not proof of capture location. Public derivatives strip sensitive metadata. Protect sensitive species locations and avoid automatically publishing people or incidental conversations.

Use stable event, location and taxon identifiers. Map exports to [Darwin Core terms](https://dwc.tdwg.org/terms/) such as eventDate, coordinateUncertaintyInMeters, basisOfRecord and identificationVerificationStatus. Standards-compatible exports do not imply an active iRecord/GBIF integration or automatic acceptance.

Long-term availability needs funded retention, tested restoration, integrity checks, export and migration plans, custody transfer when a venue changes hands, and a clear withdrawal/retention policy. Do not promise an immutable 30-year photo archive while also promising deletion on request without resolving those terms. Support customer-owned exports and independent custody arrangements for formal monitoring.

## A bounded route to proof

First finish hosted acceptance of PR70. Then pilot V2 with two willing venues and one habitat parcel whose manager and ecologist can supply an actual HMMP. A four-week pilot can test capture, editing and report assembly; it cannot validate thirty-year ecological outcomes or seasonal accuracy.

Build in this order: original/metadata preservation; contact sheet and comparison; image suggestions with abstention; canonical observation links and map; one real report evidence pack. Add commercial audio only after its licensing is resolved. Keep polarisation as a separate experiment.

Agree pilot gates before running it: upload completion on ordinary phones, correct tenant permissions, source traceability, expert-reviewed identification performance, reviewer minutes per submission and time to assemble the chosen report. Use a modest independently reviewed sample, include rejected and uncertain images, and avoid claiming rare-species performance from a small convenience dataset.

The first repeatable paid offer is a venue photo journal plus optional ecologist-supported evidence organisation, with limits on submissions, retained bytes and review time. Do not bundle unlimited identification or thirty-year custody into a small monthly fee. Illustrative labour only: 1,000 monthly images × 20% needing review × 1.5 minutes = 5 hours; at an assumed £40/hour that is £200 before storage, scanning, inference, support or editorial work. Measure actual rates before setting price or margin expectations.

Success means guests enjoy contributing, venues can publish with confidence, and professionals spend less time reconstructing where evidence came from. The defensible asset is the permissioned, longitudinal record and its review history—not a collection of unqualified AI species labels.
