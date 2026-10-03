# Acceptance register

Nothing in this file has been executed for the 3 October 2026 baseline. Every customer-journey row is **NOT RUN**.

A local or unit test does not satisfy a browser-acceptance row. A GitHub check run does not satisfy one either.

People, when a rehearsal is later authorised:

- Alice — Organisation A
- Bob — Organisation B
- Charlie — invited collaborator on Alice's case, then revoked

Do not create these people on production. Do not create them at all until the rehearsal plan is authorised.

## Layers

| Layer | Status on 3 October 2026 | What would count |
|---|---|---|
| Implementation present in the candidate | VERIFIED by reading the tree. See `CUSTOMER_CANDIDATE.md`. | The file exists. Not a passing test. |
| Local automated tests | NOT RE-RUN. `docs/QA_REMEDIATION_HANDOVER.md` reports local PostgreSQL and UI tests for this commit, and says hosted browser acceptance had not occurred. That report is REPORTED. It was not repeated. | A named command, a date, and a result, re-run and recorded. |
| GitHub `validate` on this SHA | VERIFIED earlier check-run success. Not re-run today. | The check URL in `CURRENT_STATE.md`. Not browser acceptance. |
| Hosted QA | NOT RUN | A named non-production URL and a release-register entry. |
| Independent browser acceptance | NOT RUN | A row below moved from NOT RUN by the independent tester, with evidence, on an isolated environment. |
| Production verification | NOT RUN | A known production SHA. Forbidden until identity is established. |

## Alice — Organisation A

| ID | Step | Status |
|---|---|---|
| A-01 | Signup | NOT RUN |
| A-02 | Email verification, only if `AUTH_REQUIRE_VERIFIED_EMAIL` is on in the rehearsal | NOT RUN |
| A-03 | Login | NOT RUN |
| A-04 | Logout | NOT RUN |
| A-05 | Password recovery | NOT RUN |
| A-06 | Account page still shows Alice after a new login | NOT RUN |
| A-07 | Workspace created and still present after logout and login | NOT RUN |
| A-08 | Case or site created and still present | NOT RUN |
| A-09 | Upload of a PDF within the stated limits | NOT RUN |
| A-10 | Upload of a TXT within the stated limits | NOT RUN |
| A-11 | Upload of a CSV within the stated limits | NOT RUN |
| A-12 | DOCX rejected, as this candidate's workspace copy says it is blocked | NOT RUN |
| A-13 | Processing reaches a visible evidence state, or a visible failure that is not "no change" | NOT RUN |
| A-14 | Evidence row tied to the uploaded file | NOT RUN |
| A-15 | Provenance or source visible for that file | NOT RUN |
| A-16 | Search finds Alice's text and does not find Bob's | NOT RUN |
| A-17 | Report generated | NOT RUN |
| A-18 | PDF downloaded and opened visually | NOT RUN |
| A-19 | Session still holds the case after logout and login | NOT RUN |

## Bob — Organisation B

| ID | Step | Status |
|---|---|---|
| B-01 | Signup as a distinct organisation | NOT RUN |
| B-02 | Login | NOT RUN |
| B-03 | Own workspace and case | NOT RUN |
| B-04 | Bob cannot read Alice's workspace, case, document, passage, search hit, original file, report or download | NOT RUN |
| B-05 | Alice cannot read Bob's workspace, case, document, passage, search hit, original file, report or download | NOT RUN |

Direct URL and API attempts are required for B-04 and B-05. A hidden link is not a pass.

## Charlie — collaborator

| ID | Step | Status |
|---|---|---|
| C-01 | Alice invites Charlie as REVIEWER or CONTRIBUTOR | NOT RUN |
| C-02 | Charlie can open only the invited case | NOT RUN |
| C-03 | Alice revokes Charlie | NOT RUN |
| C-04 | Charlie loses that case | NOT RUN |
| C-05 | Charlie keeps any other case Alice did not revoke | NOT RUN |
| C-06 | A pending invitation cannot restore the revoked access | NOT RUN |

## Failures that must stay failures

| ID | Step | Status |
|---|---|---|
| F-01 | Wrong password does not start a session | NOT RUN |
| F-02 | File over 3 MB is refused and nothing is stored | NOT RUN |
| F-03 | A second upload of the identical file does not create a second document | NOT RUN |
| F-04 | A missing or failed source stays visibly failed. It does not become "no change", "nothing found", or empty success | NOT RUN |
| F-05 | An expired or invalid reset link does not change the password | NOT RUN |

## Not claimed

Desktop and mobile layout: NOT RUN.
Backup restore preserving these rows: NOT RUN.
Railway A and Railway B: NOT RUN. Defined in `RAILWAY_TEST.md`.
