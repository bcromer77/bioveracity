# Managed launch for the first 50 venues

## Scope and truthful completion boundary

This release prepares the operational path for 50 independently owned venue pages.
It does not promise 50 customers, acquire consent, send setup links, create live
customer records, enable a feature flag, start billing or deploy production.
Existing self-service, editorial review, scanned photos, public pages and QR routes
are reused. No unrelated user permissions are modified.

The launch desk is `/admin/wild/launch`. Administrators are checked against the
current User record on every service operation. Ordinary venue owners cannot list,
prepare, edit or issue setup links for other places.

## Operator journey

1. Verify the representative and agree what is being supplied. Use a stable venue
   reference, email, name, county, type, story and optional HTTPS website.
2. Enter one place or download the blank CSV from the launch desk and import up to
   50 rows. Quoted commas, line breaks and escaped quotes are supported. Preview
   the names, counties and emails, then confirm authority and prepare the batch.
3. An exact repeat of the same reference/details is idempotent. A conflicting
   reference aborts the whole batch. Edit an unaccepted prepared record explicitly
   if details or recipient are wrong; that invalidates old links.
4. Prepare each setup link when ready. Copy it and share only with its confirmed
   representative using the separately authorised communication channel. No email
   provider is activated by this feature. The URL uses WILD_PUBLIC_ORIGIN, never a
   preview origin inferred from a request. Confirm that setting before sharing.
5. The representative opens the link, signs up/signs in using the intended email,
   confirms authority and receives a private hub with a twelve-month editable
   starter plan. The exact hub opens directly in the studio. Existing owners with
   one hub also land straight in it rather than a blank creation form.
6. The owner corrects/personalises the story and seasonal entries, uploads approved
   photos through the existing scanner, selects images and approves submission.
   Starter text is editorial scaffolding, not researched venue ecology.
7. A separate authorised reviewer inspects every submission at `/admin/wild`.
   Only approval publishes. The launch desk then exposes the guest-page and QR
   download links. Printing, shipment and physical plaque supply are separate.
8. Scan the actual QR on a phone, inspect the public page, and agree the support
   contact and content update schedule with the venue.

One account still has a three-hub limit. Fifty distinct owner accounts are supported
by the exercised workflow; this PR does not silently remove the cap for venue groups.
Accepted setup records cannot transfer ownership. Existing hubs are not automatically
claimed or relinked; the new managed flow creates new private hubs only. Existing
Fodder/Nicolas Mosse records must be inspected before creating another setup.

## Setup links and account handling

Links last seven days. Only token hashes are stored; raw links are returned once to
the issuing administrator. Reissue invalidates the previous token; revoke prevents
acceptance; edit clears links and requires reissue. Accepted-owner retries return
the same hub while the link remains valid. No billing state grants access.

The token travels in the URL fragment, is moved into this browser tab's session
storage, and is removed from the address bar. It is never appended to login/signup
callback URLs. The owner must use the same browser/tab across authentication;
reopening the original valid link recovers from a closed tab. Storage-disabled
browsers receive an actionable error. A different-account sign-in link supports
email mismatch recovery. This provides token possession plus account-email binding,
not independent business identity verification.

Preparation, edits, link issuance, revocation and acceptance record actor/time in
WildVenueSetupEvent. No raw token is written to that audit. Customer emails and
setup information are administrator-only and responses use private/no-store headers.

## What the dashboard does and does not establish

The desk shows prepared / awaiting owner / expired / revoked / owner preparing /
awaiting review / changes requested / published, with counts of photos, plan year,
public link and QR link. Listings paginate at 50 and show total stored photo bytes.
A published row may still have draft edits; the guest page remains the approved
snapshot until another review. Publishing is not proof of payment or customer use.

The county feed currently supports Republic of Ireland counties. Down and
Cambridgeshire do not have this guest-page feed connected. The desk explicitly
marks unsupported coverage. A supported county is not proof that the latest fetch
succeeded; open the public sample and inspect its source status. Historical county
records never establish wildlife presence at the venue. Do not sell automatic
venue-specific monitoring or completed national coverage on the strength of this PR.

## Capacity and delivery limits

The isolated test exercises one batch of 50 fictional venues through private owner
claim, review and public publication, with access checks. It is a functional test,
not a 50-concurrent-user benchmark or proof of hosting capacity.

Current limits: 12 processed photos per hub, at most 1.5 MB each. Fifty fully loaded
hubs can therefore contain 900 MB of photo bytes before database overhead, backups,
replication and unrelated records. Confirm actual database headroom, scanner quota,
backup policy and serving capacity in Abacus before accepting that volume. The
photo-byte display is visibility, not a global spending or storage cap. The county
feed already caches per county for 15 minutes within each process and deduplicates
in-flight requests; cold workers can still each call upstream.

Human effort remains a delivery cost. At an illustrative 15 minutes per venue,
50 places consume 12.5 hours, before revisions, customer contact and physical
signage. Record actual setup/review/support time for the first five. Invoice handling
can remain external; no prices, VAT treatment, Stripe products or charge activation
are changed here.

## Abacus release and acceptance handoff

- Base: PR65 integration merge `a36399b` on clarity/usability-release. Record the
  exact reviewed PR head and eventual merge SHA; do not deploy from main.
- New additive migration: `20260921_venue_launch`, creating WildVenueSetup and
  WildVenueSetupEvent. Existing WildHub/photo/publication/review migrations must
  already be present and reconciled. Inspect actual migration history: preview and
  production share a database, so preview writes are production writes.
- Confirm a new recoverable snapshot before any migration. Stop if the new tables
  already exist outside expected migration history. Preserve all customer records.
- Run full typecheck and the actual Abacus build/checkpoint gate. This PR's GitHub
  workflow also runs the new batch tests, existing venue/photo/UI/QR checks and
  production build.
- Keep billing flags off and Stripe unchanged. WILD_HUBS_ENABLED must remain under
  controlled deployment configuration until the venue journey is verified.
  WILD_PUBLIC_ORIGIN must be the intended HTTPS public origin before issuing links.
- Use an isolated database for fabricated fixtures. Verify admin, owner A, owner B
  and anonymous roles; signup and existing-account login; wrong-email/expired/
  revoked links; response-loss retry; studio auto-open; scanned photo; submission,
  rejection/resubmission/approval; actual QR decode; guest page and unpublish.
- Inspect owner and guest views at 390px and desktop width. Confirm that no Google
  signup button appears when Google authentication is disabled.
- For existing Fodder, inspect its owner/hub identity and use its existing studio
  path. Do not change Laura's permissions or create a duplicate place automatically.
- After hosted acceptance, release a first group of five agreed venues, review
  delivery time and failures, then expand towards 50. Enabling the flag exposes
  existing self-service as well as this flow; the 50-row intake cap is not a global
  cap on customer registrations. Provide a named operator for reviews/support.
- Record deployment SHA, migration receipt, snapshot/checkpoint, flag state and
  each acceptance result. None of these live outcomes is established by local CI.

Rollback: disable venue features if needed, revert application through the approved
Abacus route and preserve added tables, setup records, photos and hubs. Do not roll
back the shared database after new customer activity merely to undo a UI release.

## Local validation receipt

- 5 onboarding tests passed, including the full 50-place functional batch, setup
  link lifecycle, admin/owner isolation, duplicate-place and three-place guards.
- 6 venue UI tests passed, including direct/sole-place opening, rejecting another
  owner's requested place, and token handoff through login with explicit acceptance.
- 4 existing venue tests passed, covering photos/scanning/metadata removal,
  same-origin enforcement, review, publication, edits and revocation.
- Full `tsc --noEmit --incremental false` passed; Prisma schema validation passed.
- Actual `npm run build` / Next Turbopack production build passed after replacing
  the local Abacus-only yarn.lock symlink with the CI lockfile for validation.
  The existing parser.ts:58 dynamic-filesystem tracing warning remains. Build
  success does not replace the separate full typecheck or hosted Abacus gate.
- No production database was accessed. No live user was invited or changed.
