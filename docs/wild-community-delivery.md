# BioVeracity: one green-and-gold identity, distinct customer journeys

## Agreed offer

BioVeracity brings together the evidence and stories that help people understand a place.
Professionals understand a site and follow evidence. Visitors discover a place. Venues combine their approved content with wider-area discoveries through their own page and QR code.

Exact CTA: **Contact us for pricing**. Signage is paid upfront; community membership is monthly. Quotes define costs, content, updates, support, delivery and cancellation before commitment. No public numerical price or annual subscription. Cost physical fulfilment, onboarding and ongoing human review before quoting. Paid membership never certifies environmental performance or influences professional findings.

## Implemented

- `/professionals`: focused explanation with existing search, login and contact links.
- `/wild/partners`: offer, example, four benefits, assisted onboarding, upfront/monthly explanation, minimal enquiry and FAQ.
- `/wild/places/example-woodland-venue` and `/wild/places/example-craft-venue`: noindex concepts combining illustrative venue content with existing reviewed county topics.
- `/wild/q/[id]`: fixed internal redirect for known IDs; unknown returns 404.
- `/api/wild/qr/[id]`: SVG QR with four-module quiet zone and download. HTTPS origin comes from WILD_PUBLIC_ORIGIN, never the incoming host. Missing configuration returns 503.
- `/api/wild/enquiries`: bounded input, field validation, honeypot, per-email limit, retry UUID deduplication, existing Lead persistence and existing founder notification helper.
- Venue name and email required; website/message optional. No account or payment required to enquire.
- Shared public header and homepage entrances preserve search and private app routes; green/gold tokens leave evidence status colours intact.

## Boundaries

These venues are fictional examples, not real businesses or signed partners. Owner prose is illustrative and labelled. No unauthorised venue photographs, exact wildlife locations, sightings or public-access directions are invented. Confirm official naming and owner permission before publication as a member.

Assisted onboarding is the first release. Self-service owner editing/uploads, member publication/admin, billing, analytics and recurring content automation are not implemented. Do not relabel the concept registry as active membership without an approved publishing workflow. Stable venue IDs must never be reused.

Enquiry storage precedes notification. Notification failure does not roll back the stored lead, following the existing contact behaviour. Anonymous leads are not automatically visible in the account page, which filters by user ID. Production must verify notification delivery and an operator recovery path for notification failures.

The per-email rate count is basic protection, not a distributed IP limit: concurrent distinct requests may race it. Configure edge request limits before public promotion. Retried UUIDs are protected by database primary-key uniqueness.

## Verification

- Full explicit TypeScript check passed.
- Existing Wild Counties test passed.
- New isolated tests passed for validation, limits, unsafe website schemes, QR origin, unknown venues, download headers, saved acknowledgement, UUID retry, payload conflict, throttling and failed storage. No real database or notifications used.
- Next production build passed. Locally, the existing dangling yarn.lock symlink was temporarily moved then restored; generated Prisma client was copied from its existing absolute Abacus output path into local node_modules. Neither hosted configuration nor schema was changed.
- npm required legacy peer resolution for the existing cmdk/React mismatch. Added npm overrides mirror existing Yarn motion resolutions. QR library and its types added with npm lockfile.
- Browser render checks passed at 1440 px and 390 px on offer, professional and venue routes; no horizontal overflow in checked views.
- Browser form checks passed: failed save preserves fields; success appears only after acknowledgement. Requests intercepted; no email sent. Rendered SVG decoded to the expected configured canonical venue URL. Physical phone/print testing remains a release gate.

## Deployment

Bazil deploys. Stacked on draft #44 at c1ad805e7468709c222c51d3a8f19d85808b865e. Reconcile with actual deployed release and preserve subsequent work. Nothing is merged or deployed by this change.

Before release: confirm app/environment, release SHA, hosted build/dependency method and rollback; configure WILD_PUBLIC_ORIGIN and verify existing database/notification settings. No secrets in GitHub.

Before public promotion: agree supplier/service costs and content scope; verify a real enquiry reaches its operator; verify deployed QR URLs and phone scans of printed proofs; approve venue content. Automated decoding is not physical signage approval.
