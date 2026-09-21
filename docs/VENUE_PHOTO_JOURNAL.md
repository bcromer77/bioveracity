# Venue photographs: weekly review and a record through time

## Implementation and base

This change starts at `08ebd74d052bab8d6fc2aff97f12c0072616a921` on
`feat/identity-first-public-navigation`, which includes merged PR69's transactional
email boundary and PR66's venue onboarding. The older `clarity/usability-release`
branch does not contain the same email baseline. Do not deploy this from main or
silently rebase it onto the older integration branch.

The feature is implemented behind two new disabled flags. This document does not
claim production deployment, email activation, scheduled delivery or a live guest
journey. Existing fictional example pages remain examples. Real guest contributions
attach to a published, owned `WildHub`, not to a seed example or an inferred nearby venue.

## Storyboard to working journey

| Storyboard | Code and behaviour |
| --- | --- |
| Start with your place | Existing PR66 setup and Wild Hub studio; owner and public hub IDs are preserved. |
| Everyone notices different things | Opt-in photo form on the published hub. Guests need no account; contributors confirm they are adults. |
| Give each photograph its place | Description, photographer credit, general location and nullable date photographed. Receipt/upload time is separate; EXIF/GPS removed. |
| Bring their views together | Private venue journal at `/wild/studio/[hubId]/photos`. Guest images do not consume the owner's twelve-image gallery. |
| Review this week's contributions | One weekly email per opted-in hub, to its current owner account email, with up to twelve private previews and the total number of new contributions. |
| Publish or download | Owner chooses individual photographs for public use; independent editorial approval publishes them. Processed JPEG and date/credit JSON downloads are available privately. |
| Seasons become years | Journal browses by year photographed; published record orders known dates newest first. Unknown dates remain labelled. No ecological absence or verified-species claim. |

The original owner gallery remains unchanged and is not copied automatically into
the new journal or emails. This prevents inventing dates or guest consent for old
images. The guest upload form is the new journal's intake; venue staff can also
contribute there under the same explicit permissions. Imported API records are
context, not guest photographs, and are not attached to this email.

## Boundaries and consent

- Owner must enable contributions and weekly email in the journal.
- Global account `weeklyDigest=false` suppresses these emails too.
- Contributors grant this venue and BioVeracity permission to store/review the
  photo, include a private email preview, publish it with credit on the venue's
  BioVeracity page, and download it for that purpose. This is not a licence for
  unrelated advertising or unrestricted reuse.
- All contributions pass the existing malware scanner and JPEG re-encoding path.
- Received photos are private. Owner publication request sets `REVIEW`; a different
  administrator records a review and sets `PUBLISHED` or `REJECTED`.
- Editor roles are refreshed from the database. A stale session cannot retain
  review authority. Old revisions cannot approve cancelled/withdrawn submissions.
- Venue unpublication hides the public journal and all its image routes.
- A contributor receives a secret withdrawal receipt in a URL fragment, not an
  authentication credential. The server stores only its hash. Explicit withdrawal
  removes stored image bytes and public/owner/email access; the metadata/audit
  record remains. Owner withdrawal does the same. Existing copies in email clients
  or on a recipient's device cannot be recalled.
- Email thumbnail links are bearer capabilities limited to the digest's selected
  photos, current venue owner/email and eight-day expiry. They return 480px previews,
  not full downloads. Weekly opt-out, rejection or withdrawal disables previews.
  Email clients may cache images. Do not enable click/open tracking for these links;
  configure hosting to redact the `token` query parameter from request logs.
- Downloading or publishing requires a signed-in owner, never just an email link.
  GET links cannot publish content; scanners following email links have no write effect.

## Capacity and ongoing work

Pilot limit: **200 contributions per hub**, with at most 1.5 MB per processed photo
and twelve scan attempts per hub per hour. A withdrawn entry still counts towards
the pilot record limit. No automatic pruning or silent replacement of earlier
observations occurs. At the limit, new contributions stop with an explicit message.

Worst-case additional image bytes: 300 MB per venue; 15 GB for fifty venues,
excluding database overhead and backups. Scan costs and independent editorial
review time must be measured in a five-venue pilot. These limits are deliberately
not a claim of unlimited multiyear storage. Before expansion, plan object storage,
backup/restore, archive/export, contributor corrections and record retention.

## Weekly schedule and delivery behaviour

Run `yarn photos:weekly` in `nextjs_space` each Monday at **09:00 UTC** through the
existing Abacus application's scheduler. A cron definition is provided at
`ops/venue-photo-digest.crontab.example`; replace the checked deployment path and
runtime executable with the host's actual values. No scheduler has been installed
by this PR. Do not use ChatGPT reminders as application delivery infrastructure.

The window is the previous Monday 00:00 UTC through the current Monday 00:00 UTC,
selected by contribution receipt time. A photo from an earlier year uploaded this
week appears this week, with its original date still shown. An empty week sends a
brief no-new-photographs message and a link to the existing record.

A unique `(hubId, weekStart)` database claim prevents duplicate weekly attempts.
The transport is PR69's configured Resend provider. Abacus provider delivery is
not used because that adapter currently treats notification-disabled as success.
Missing provider configuration fails before any claim. Transport errors/timeouts
set `UNKNOWN`, because a provider may have accepted a message before a timeout.
The job does not blindly retry these messages. Crashed `SENDING` claims also require
operator reconciliation with provider logs. Never delete claims or resend without
establishing whether the first attempt delivered. A repeated run processes only
unclaimed venues in the current completed week; it does not backfill older weeks.

The script prints counts only and exits non-zero for unknown delivery. Set up job
failure alerts and review stuck `SENDING`/`UNKNOWN` rows before claiming reliable
weekly service. This first release is at-most-one automatic attempt per venue/week,
not an exactly-once delivery guarantee.

## Release handoff for Abacus

1. Confirm the exact application, imported full commit, deployed baseline and
   rollback checkpoint. Preserve the current database and take a recoverable backup.
2. Review/apply the additive `20260923_venue_photo_journal` migration after existing
   Wild Hub and attention migrations. Reconcile actual migration history first;
   existing known migration-chain gaps are not repaired by this PR.
3. Keep both new flags false while building and validating. Set the existing
   `APP_BASE_URL` to the actual HTTPS application origin; use the existing verified
   Resend sender/provider configuration. No new mailbox or sender is invented.
4. In a preview environment with isolated accounts/data, enable
   `WILD_HUBS_ENABLED=true` and `WILD_PHOTO_JOURNAL_ENABLED=true`. Publish a fictional
   test venue; enable its contributions and weekly email; keep the send flag false.
5. Verify mobile upload, real scanner failure/clean responses, receipt withdrawal,
   cross-owner denial, editorial approval, public chronology and image/credit
   downloads. Test the actual QR destination and login return to the journal.
6. Enable `WILD_PHOTO_DIGEST_SEND_ENABLED=true` **in preview only** with an agreed
   test recipient. Run the job; inspect the actual message, images and review link;
   rerun to establish no duplicate. Test opt-out, expiry and withdrawn images.
7. After hosted acceptance and release approval, deploy production, opt in the
   agreed pilot venues, enable outbound delivery and install the Monday schedule
   with alerts. Record the scheduler ID/timezone and the first real delivery result.
8. Rollback: disable the send flag/schedule first, then journal flag; retain the
   additive tables/data. Do not roll back by deleting submitted photographs.

## Local verification

Local results before PR creation:

- Seven isolated SQL/domain/email tests passed, including the actual migration.
- Three UI interaction tests passed (year filters, permission-bearing uploads,
  publish requests, private downloads and explicit withdrawal).
- Four existing Wild Hub tests, seven existing Wild Hub UI tests and ten transactional email tests passed.
- Full TypeScript check passed against a freshly generated local Prisma client.
- Prisma schema validation passed.
- Actual Next.js 16.3.3 Turbopack production build passed using the repository CI
  lockfile locally. Existing `parser.ts:58` dynamic tracing warning remains.
- Disabled delivery runner exits without contacting the database or provider.
- Browser visual testing could not run: browser executable absent and the download
  timed out. Hosted/mobile visual acceptance remains required.
- ESLint could not initialise with the cached dependency tree: its dependency
  requests `zod/v4/core`, which the cached Zod package does not export. The project
  dependency versions were not changed to mask this environment issue.

See the PR for any subsequent CI results. `test:venue-photos` uses isolated PGlite
and executes the actual additive SQL; it exercises owner isolation, consent/date
validation, scan/storage limits, independent review, unpublication, withdrawal,
weekly selection, preference suppression, private thumbnail scope/expiry and
ambiguous-send duplicate prevention. It is not a multi-connection PostgreSQL load
benchmark or evidence of hosted Resend delivery.
