# Incident log

Append corrections. Do not rewrite an entry when a new fact arrives. Add a dated note.

No credentials, connection strings, tokens or customer data belong in this file.

## INC-2026-10-03-01 — Production commit and database binding are not established

**Status: OPEN**

This is the record of the Abacus credential and database-binding event, as far as this repository can currently carry it. The triggering action, the databases touched, and Abacus's explanation were not reconstructed from memory. Where a timestamp is missing, it is missing.

### Observed by us

- **2026-10-03T09:46:34Z.** An external `GET https://bioveracity.com/place/dodder` returned HTTP 500. The HTML title was `Place — BioVeracity`. Response headers did not name a git commit. This observation does not identify the running SHA.
- **2026-10-03.** Customer candidate `3c08ab229a2e4c76c9b8b17137951b8e700c017f` contains no `app/place` route. Whether that candidate is what the host is running is UNKNOWN.
- **2026-10-03.** Reading the candidate showed `Event.datePrecision` in the Prisma schema and no migration for it in that commit.

### Reported, not independently observed

- **19 September 2026 document.** `docs/CURRENT_STATE.md`, now under the historical heading, says a report supplied by Bazil said Abacus deployed `7b240dab00826c8d2a52c1c4582449d744dec2e5` and applied three migrations. The same file's older section says those migrations were not applied and names a different checkpoint. Neither was checked against the host for this incident.
- **3 October 2026 authorisation.** The instruction for this documentation commit says Abacus has been asked, read-only, for: the current production SHA; the current production database binding; `_prisma_migrations`; whether `EvidenceDocument` exists; the Ellona status; whether the requested rebind happened; the current backup and recovery status. This file records that the ask was stated. It does not record that a reply arrived. Delivery to Abacus was not observed here.

### Reported by Abacus

No Abacus reply is in this record as of this commit.

### Still unknown

- The action that triggered the incident, and when it happened.
- Which databases were involved.
- Whether a rebind was requested and whether it happened.
- The running commit.
- The application database identity and the evidence database identity.
- The contents of `_prisma_migrations`.
- Whether `EvidenceDocument` is in the application database.
- Which of the three Ellona states in the migration register is true.
- Abacus's explanation.
- The current backup configuration, the last successful backup, and whether a restore has ever been completed.

### Historical backup evidence — not today's configuration

`docs/PRODUCTION_READINESS_HANDOVER.md` in this candidate describes an isolated restore helper. It says the host must obtain a fresh encrypted archive through existing backup controls. It also says a full production database rebuild and backup, media and key restoration had not been performed at the time of that document. No backup filename, checksum, timestamp or restore duration is stored here. That document is not evidence of the current host backup configuration.

### Containment

The operating decision is a production write freeze. See `docs/registers/DECISION_LOG.md`. This commit does not change a host control, and it does not prove the host is enforcing the freeze.

### Recovery actions taken

Documentation only. No production read of the ledger. No migration. No rebind. No account. No deploy.

### Resolution

None. Leave this incident open until the unknowns above are either answered with evidence or explicitly closed as unobtainable.
