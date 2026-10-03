# Release register

**No current BioVeracity production release has yet been independently identified by full Git SHA as of 3 October 2026.**

This file records deployments. It does not record intentions. A branch name containing `deployed` is never sufficient evidence.

Every future entry must contain all of the following. If one is missing, write UNKNOWN. Do not invent it.

- release ID
- full Git SHA
- branch or tag
- target environment
- deployment timestamp, UTC
- operator or system
- previous SHA
- application database fingerprint, never a connection string or credential
- evidence database fingerprint, never a connection string or credential
- migrations planned
- migrations actually applied
- feature-flag changes
- test suite run
- result
- smoke test
- rollback target
- evidence links

## Entries

### R-000 — no verified current release

| Field | Value |
|---|---|
| Release ID | R-000 |
| Full Git SHA | UNKNOWN |
| Status | No production release independently identified |
| Evidence | Public HTTP responses on 3 October 2026 did not include a commit. See `docs/CURRENT_STATE.md`. |

### Reported historical claims — not verified, not current

These are claims found in repository documents. They are REPORTED. They disagree with each other. They are not deployments recorded by this register.

| Source | Date on the document | Claim | Class |
|---|---|---|---|
| `docs/CURRENT_STATE.md`, section now labelled historical | 19 September 2026 | A report supplied by Bazil said Abacus deployed `7b240dab00826c8d2a52c1c4582449d744dec2e5`, applied the three `20260919_*` migrations, and left Wild Hub and billing flags disabled. The same document said this was not an independent inspection. | REPORTED |
| `docs/CURRENT_STATE.md`, older snapshot in the same file | 19 September 2026 | Production checkpoint `b692e9a`. The three `20260919_*` migrations not applied. `2ae2d01514ce5ccde5546532cefee269e8f019ad` not deployed. | REPORTED |
| Branch `gate3c/deployed-b776a6c` | n/a | The name contains "deployed". | NOT EVIDENCE |

No operator, database fingerprint, smoke test or rollback proof is attached to any of these claims.
