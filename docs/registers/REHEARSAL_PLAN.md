# Rehearsal plan

Plan only. **No environment is created by this document.** No production database is copied, rebound or queried.

Alice, Bob and Charlie run here, later, or they do not run. They do not run on bioveracity.com while `docs/CURRENT_STATE.md` still says the production SHA is UNKNOWN.

## Two databases

Keep the split this candidate already assumes.

| Database | Role | Rule |
|---|---|---|
| Application | Users, workspaces, cases, billing tables, venues, identity | A new empty PostgreSQL database. Not the production application database. |
| Evidence | `EvidenceDocument` and the evidence-pipeline tables | A second new empty PostgreSQL database. Not the production evidence database. |

Do not create `EvidenceDocument` inside the application database in order to make `20260915_ellona_opportunity_watch` apply. That is the unresolved Ellona defect. The rehearsal records which migrations were applied to which database, and it stops rather than collapsing the two to get a green plan.

`Event.datePrecision` is still unresolved. A rehearsal that boots this candidate against migrations that lack the column must record the resulting error. It must not cherry-pick `156d29a67324a3ed5510079518189712d5ac81ff` unless that cherry-pick is a separate authorisation. Until then, a boot failure on that column is an expected BLOCKED result, not a reason to alter the candidate quietly.

## Other requirements

| Need | Rehearsal rule |
|---|---|
| Application | This candidate's SHA, built from that commit, with the SHA printed on a private status page or in the process environment under a non-secret name such as `BIOVERACITY_RELEASE_SHA`. If the running process cannot say its SHA, acceptance is BLOCKED. |
| PostgreSQL | Two empty databases as above. Versions not pinned here, because production's version is UNKNOWN. Record the version that was used. |
| File storage | A new empty bucket or directory. Not production object storage. |
| Scanner | Off, or a test key that cannot see production documents. If it is off, upload rows are BLOCKED. Do not borrow the production Cloudmersive key. |
| Email | Captured locally. `OPERATIONS_SEND_ENABLED` and digest send flags off. No message leaves the rehearsal. |
| Identities | Alice, Bob and Charlie, synthetic emails on a domain the rehearsal controls. No real customer. |
| Feature flags | Start with workspaces enabled only if the acceptance needs them, and record every flag that was turned on. Billing live, Stripe self-serve, Revolut, Google auth, scheduled jobs and ingestion stay off unless a single row in the contract requires one, and then only that one, recorded in the release register for the rehearsal. |
| Secrets | In the rehearsal host's secret store. Not in git, not in this plan, not in the acceptance evidence. |
| Public site | The rehearsal is not bioveracity.com. |

## Backup and restore

Before any acceptance row is marked PASS, take a backup of both rehearsal databases and restore them into a third pair of empty databases. Record the duration and the counts. Open one known synthetic document through the restored application. If the document cannot be opened, acceptance is not complete, even if the browser rows passed on the original rehearsal.

This restore is of the rehearsal. It says nothing about production backups. Production backup state stays UNKNOWN until the incident log says otherwise.

The restore helper in `docs/PRODUCTION_READINESS_HANDOVER.md` refuses a nonempty target and refuses the configured production identities. Use it only against the empty rehearsal restore targets. Do not point `RESTORE_DATABASE_URL` at production.

## Reset

To repeat the rehearsal: drop only the rehearsal databases and the rehearsal bucket, create empty ones, apply the recorded migration plan, and start again. Do not reset by restoring an old production dump over anything.

## What this plan does not do

It does not choose a cloud. It does not create accounts. It does not apply migrations. It does not decide the Ellona state. It does not authorise the date-precision cherry-pick.
