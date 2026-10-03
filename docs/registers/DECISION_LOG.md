# Decision log

Decisions of 3 October 2026. This records why. It does not record that the underlying production facts have been verified.

A decision here is an operating decision. It is not a deployment and it is not a test result.

## D-2026-10-03-01 — Production stays write-frozen

- **Decision.** No production deployment, migration, account, upload, train, flag change, database rebind, or environment change until the running commit and the migration ledger are established.
- **Reason.** The running commit and the ledger are UNKNOWN. A write would land in an unidentified database.
- **Evidence.** `docs/CURRENT_STATE.md`. No production ledger was read.
- **Consequence.** Recovery work is read-only, plus this documentation commit.
- **Revisit.** When the host's SHA and `_prisma_migrations` are in the incident log as REPORTED, and then only after they are independently checked.

## D-2026-10-03-02 — Customer candidate

- **Decision.** The customer candidate is `3c08ab229a2e4c76c9b8b17137951b8e700c017f`. It is not deployed and not accepted.
- **Reason.** It is the last commit on this line that contains the customer journeys built through 22 September and does not yet contain the club and Revolut commit that follows it.
- **Evidence.** Parent of `4f0daec0ed18b8bf5d740246a1bfefa0e6d31034` is this SHA. GitHub `validate` succeeded. Browser acceptance has not been run.
- **Consequence.** Later work is not merged in to make the candidate "more complete".
- **Revisit.** After production identity is known, and only by a separate decision.

## D-2026-10-03-03 — Date precision is identified and not applied

- **Decision.** `Event.datePrecision` is a known schema/migration mismatch. Commit `156d29a67324a3ed5510079518189712d5ac81ff` is not cherry-picked and not applied.
- **Reason.** The repair sits five commits later, on the club line. Applying it now would mix the recovery with later work, and production compatibility is not known.
- **Evidence.** `docs/registers/MIGRATION_REGISTER.md`.
- **Consequence.** The candidate is not database-compatible until this is reconciled on a non-production copy.
- **Revisit.** After the production ledger is read, on an isolated database, by a separate authorisation.

## D-2026-10-03-04 — Ellona stays unresolved

- **Decision.** Do not choose among the three possible production states of `20260915_ellona_opportunity_watch`, and do not mark it applied.
- **Reason.** The ledger and the presence of `EvidenceDocument` in the application database have not been read.
- **Evidence.** The migration SQL and the release helper, as recorded in the migration register.
- **Consequence.** No migration plan is applied.
- **Revisit.** When those two facts are read.

## D-2026-10-03-05 — Alice and Bob are not run on production

- **Decision.** The first two-tenant acceptance runs on an isolated non-production database, or it does not run.
- **Reason.** Production identity is unknown. A test account would be a production write.
- **Evidence.** Acceptance register: every row NOT RUN.
- **Consequence.** No synthetic customer is created on bioveracity.com under this decision.
- **Revisit.** When the rehearsal plan is authorised against a named isolated database.

## D-2026-10-03-06 — Pull request 105 stays outside recovery

- **Decision.** Commercial-property work is not part of this recovery. Pull request 105 is not modified.
- **Reason.** Recovery is identity, documentation and later acceptance. A new product would hide the unknown production state.
- **Evidence.** This commit does not touch that work.
- **Consequence.** No commercial schema is added here.
- **Revisit.** After a customer candidate has been accepted on a known database. Not before.

## D-2026-10-03-07 — No infrastructure move during recovery

- **Decision.** No MongoDB migration and no Google Cloud migration while production is unidentified.
- **Reason.** A new host would copy the unknown ledger. It would not name it.
- **Evidence.** `docs/CURRENT_STATE.md`. Production SHA UNKNOWN.
- **Consequence.** Infrastructure is not configured by this commit.
- **Revisit.** After BioVeracity is reproducible: known SHA, known ledger, rehearsed restore, and a passed isolated acceptance.

## D-2026-10-03-08 — Documentation is part of done

- **Decision.** A material implementation, migration, deployment, incident or acceptance fact is not done until it is in the repository record. Chat is not that record.
- **Reason.** The fortnight before this commit had to be reconstructed from conversations and branch names.
- **Evidence.** This commit. `AGENTS.md` carries the standing rule.
- **Consequence.** Later changes update the relevant register in the same commit.
- **Revisit.** If a register is found to duplicate a better canonical file. Do not open a second current-state file.

## D-2026-10-03-09 — Old Belvedere is a pilot name, not a product

- **Decision.** Old Belvedere is the historical pilot and development context for the Sports Clubs capability inside BioVeracity. It is not a separate product. The filename `docs/OLD_BELVEDERE_LAUNCH_HANDOVER.md` stays as it is wherever that file already exists. This commit does not add, move or rename it.
- **Reason.** The filename had been misread as a separate product. Inclusion in the candidate is decided from commits, not from the filename.
- **Evidence.** The handover file is not in this commit. It is touched by `4f0daec0ed18b8bf5d740246a1bfefa0e6d31034` and `af12f341986e17959e96b884dc2a53bf18b57b97`, both after this candidate. The sports-club venue type is `423215bd3b331502ae44bda5d172ca21dfe7dd3d`, also after this candidate.
- **Consequence.** Sports Clubs stays outside the candidate because those commits are not in it. Not because the pilot name was discarded.
- **Revisit.** A later decision may bring Sports Clubs forward. This decision does not.
