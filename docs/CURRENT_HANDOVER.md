# Current handover

Snapshot: 9 September 2026. Refresh GitHub and obtain Abacus state before implementation.

## Three active actions
| Action | Owner | Status and completion evidence |
| --- | --- | --- |
| Finish and preserve parser production build repair | Abacus, current repair owner | Blocked in supplied transcript. Complete when full integration is pushed with SHA, actual production build and packaged parser runtime checks passing. No date promised. |
| Reconcile integration and commission Codex environment | Codex after repair handover | Pending; preserve all unmerged work, identify approved base, verify fresh environment and record exact checks. |
| Release acceptance and authorised deployment | Codex prepares evidence; Abacus executes authorised hosting step | Pending access/data/host controls, backup/rollback and hosted customer-flow checks. Production not authorised by this setup. |

## Observed GitHub state
- main: 1c8437abbf140ce7aee4016a7b34712b6bef9cb4.
- integrate/evidence-search: 8e19592d0175ed31cc65ce6b65c0ffddc76281bc; PR7 open into main.
- PR29 private-case integration: dc6ba9be9f31b23b6cf64592a5f33700f1164318; draft, includes work from PR26/27/28.
- PR30 issue3 scoped identity/dates: 8603af37f7b5f6661808611693f8a37df504e306; draft into integrate/evidence-search. Review this existing fix before creating another.
- Other open work includes PR1/2, PR5/6, PR10, PR16, PR18/19/20/21/22. PR16 Enniscorthy research remains outside the current integration scope. Do not mass-merge or close branches from this snapshot.

## Abacus evidence and missing facts
The supplied transcript reported a local integration commit beginning 9cf1430, not yet pushed/checkpointed/deployed at that time. This has not been independently verified against current Abacus state.
Development mode, type checks and 53 tests were reported passing; the production Turbopack build failed around the parser child-process path. Previous webpack-only checks did not establish Abacus production readiness.
Obtain current branch/full SHA, dirty diff, unpushed commits, exact failing command and runtime versions. Preserve changes before replacing code or restoring a checkpoint.
Current deployed SHA/checkpoint, production build success and hosted acceptance are unknown.
A credential appeared in the supplied transcript. Its revocation/replacement is required; no credential value belongs in this register and completion is unverified.

## Scheduled engineering
BioVeracity Evidence Fixes was paused on 9 September 2026 during this setup to prevent overlapping coding. Its existing PR30 is preserved.
Resume only after the repair handover and integration base are recorded, ownership is assigned, and its prompt is updated to review PR30 and these workflow rules. Do not create a duplicate issue3 fix.
The financial, signal and communications routines are separate. No new coding scheduler is created by these files.

## Setup adoption
This document and the workflow are delivered in a separate setup PR against main. They are not automatically present on existing feature branches; read the setup PR until merged and carry the rules into the reconciled integration.
