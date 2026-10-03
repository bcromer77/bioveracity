# Acceptance contract

For an independent tester. Not for the author of the candidate to mark accepted.

**Do not execute this contract until a rehearsal environment is separately authorised.** Do not run it against bioveracity.com while production identity is unknown. Do not repair failures. Report them.

Use synthetic names and synthetic files only. No real customer data.

The candidate under test must be named by full SHA in the evidence of every row. If the running SHA is not the candidate, stop and mark the run BLOCKED.

Results are PASS, FAIL or BLOCKED. "Looks okay" is not a result.

## Common rules

- **PASS** — the expected result happened, and the evidence file shows it.
- **FAIL** — a different result happened.
- **BLOCKED** — the precondition is not true, so the step cannot be judged. A blocked scanner, a blocked mailbox, or an unknown SHA is BLOCKED, not a pass.

Evidence for every row: the SHA, the UTC time, the URL or request, the HTTP status where there is one, and a screenshot or saved response body. For PDFs, the opened file, not only the download.

Desktop width and a 390-pixel-wide viewport are both required for A-07, A-08, A-09 and A-18. A control that cannot be reached without horizontal scrolling is a FAIL for that viewport.

## Alice

### A-01 Signup

- **Precondition.** Rehearsal is isolated. `Alice` has no account. Terms control is visible.
- **Action.** Create an account with a synthetic email, a password, and the terms accepted. Choose professional evidence.
- **Expected.** Account exists. The purpose choice does not make Alice an administrator. A second signup with the same email returns HTTP 409 and `An account with this email already exists`. That 409 is the candidate's current behaviour. Record it. Do not describe it as harmless.
- **PASS.** Both the created account and the 409 are evidenced.
- **FAIL.** Signup succeeds without the terms, or the second signup is silent, or Alice receives an admin role.
- **BLOCKED.** Signup cannot be submitted because the rehearsal is not booted.

### A-02 Verification

- **Precondition.** `AUTH_REQUIRE_VERIFIED_EMAIL` is known.
- **Action.** If the flag is off, do not invent a verification step. Record the flag value and skip. If the flag is on, open the verification link and confirm it explicitly.
- **Expected.** When the flag is on, the session starts only after the explicit confirmation. The token is not left in a query string that the page then ignores.
- **PASS.** Flag-off skip is recorded, or flag-on confirmation is evidenced.
- **FAIL.** A flagged-on account is usable before confirmation.
- **BLOCKED.** The flag value cannot be read.

### A-03 Login

- **Precondition.** A-01 passed.
- **Action.** Sign in with Alice's password.
- **Expected.** An authenticated session for Alice only.
- **PASS.** A page that only an authenticated Alice can see is shown, and the evidence names her workspace after A-07.
- **FAIL.** Login fails with the correct password, or a session is created for a different account.
- **BLOCKED.** A-01 did not pass.

### A-04 Logout

- **Action.** Log out.
- **Expected.** A following request for Alice's workspace is refused.
- **PASS.** The workspace URL does not render Alice's case.
- **FAIL.** The case remains visible.
- **BLOCKED.** There is no session to end.

### A-05 Password recovery

- **Precondition.** Mail in the rehearsal is captured locally and is not delivered to a real inbox.
- **Action.** Request a reset for Alice. Open the captured link. Set a new password. Sign in with it. Confirm the old password fails.
- **Expected.** Exactly one password change. An invalid or altered link does not change the password (this is also F-05).
- **PASS.** New password works, old password does not, bad link does not.
- **FAIL.** The old password still works after a successful reset, or a bad link changes it.
- **BLOCKED.** No captured message, and no other authorised way to read the link.

### A-06 Account

- **Action.** Open the account page after logging in again with the new password.
- **Expected.** The page is Alice's. It does not show Bob.
- **PASS.** Alice's email is visible. Bob's is not.
- **FAIL.** The other tenant appears, or the page is an error.
- **BLOCKED.** Login failed.

### A-07 Workspace

- **Action.** Create a workspace named `Alice workspace alpha`.
- **Expected.** The saved name is shown. Log out, log in, and the same workspace is still there.
- **PASS.** The name survives a new session on desktop and at 390 pixels.
- **FAIL.** The name is replaced with a generic persona, or the workspace is gone.
- **BLOCKED.** Workspace creation is refused because `PRIVATE_WORKSPACES_ENABLED` is off. Do not turn the flag on inside the test. Mark BLOCKED and name the flag.

### A-08 Case

- **Action.** Inside that workspace, create a case titled `Alice case alpha`.
- **Expected.** The title survives logout and login.
- **PASS.** The title is still there.
- **FAIL.** It is missing, or it is Bob's title.
- **BLOCKED.** A-07 blocked.

### A-09 PDF upload

- **Precondition.** Scanner behaviour for the rehearsal is the one in `REHEARSAL_PLAN.md`.
- **Action.** Upload one synthetic PDF under 3 MB.
- **Expected.** The UI reports a scan, then either an imported document or a visible scan/processing failure. It does not say the file was stored if the scan failed.
- **PASS.** One document id is recorded, or a visible failure is recorded and no document id exists.
- **FAIL.** A silent success, a stored file after a failed scan, or a file over the limit accepted.
- **BLOCKED.** No scanner is configured and the rehearsal plan said uploads require one. Do not point the rehearsal at a production scanner key.

### A-10 TXT

- Same contract as A-09, with a `.txt` file containing the unique sentence `Alice alpha sentence for search`.

### A-11 CSV

- Same contract as A-09, with a small `.csv`.

### A-12 DOCX

- **Action.** Upload a `.docx`.
- **Expected.** Refused. The workspace copy in this candidate says DOCX is blocked.
- **PASS.** No document is stored. The refusal is visible.
- **FAIL.** A document id is created.
- **BLOCKED.** The control cannot be reached.

### A-13 Processing

- **Expected.** The imported file has a visible state. A failure remains a failure.
- **PASS.** State is recorded and is not described as "no change" unless a second identical attempt found the same document.
- **FAIL.** A processing error is shown as an empty successful case.
- **BLOCKED.** A-09, A-10 and A-11 are all blocked.

### A-14 Evidence

- **Expected.** Alice can open the imported text and see `Alice alpha sentence for search`.
- **PASS.** The sentence is on screen and tied to the file name.
- **FAIL.** The sentence is missing, or text from another tenant is shown.
- **BLOCKED.** No import passed.

### A-15 Provenance

- **Expected.** The file name, and any source URL Alice entered, are visible with the evidence.
- **PASS.** The file name is visible.
- **FAIL.** The evidence has no file identity.
- **BLOCKED.** A-14 blocked.

### A-16 Search

- **Action.** Search for `Alice alpha sentence for search`, then for a sentence that exists only in Bob's file.
- **Expected.** Alice's sentence is returned. Bob's sentence is not.
- **PASS.** Both halves are evidenced.
- **FAIL.** Bob's sentence appears, or Alice's sentence is missing after a passed import.
- **BLOCKED.** Search control unavailable.

### A-17 Report

- **Action.** Generate the case report.
- **Expected.** A report object or PDF response for `Alice case alpha` only.
- **PASS.** The response is tied to Alice's case id.
- **FAIL.** The report contains Bob's case title or file name.
- **BLOCKED.** No evidence was imported.

### A-18 PDF visual inspection

- **Action.** Download the PDF. Open it. Read it. Do not judge it from the HTTP status alone.
- **Expected.** The file opens as a PDF. The case title `Alice case alpha` is printed. The footer contains `BioVeracity` and a page count. Bob's title and Bob's unique sentence are absent. Record the page count and every heading you can read.
- **PASS.** All of those are true on desktop and at 390 pixels for the download action.
- **FAIL.** The file does not open, the title is missing, or the other tenant's words are present.
- **BLOCKED.** No PDF bytes were returned.

### A-19 Return session

- **Action.** Log out. Log in. Open the case, the document and the PDF again.
- **Expected.** The same ids are still there.
- **PASS.** Document id and case title match the earlier evidence.
- **FAIL.** They differ or they are gone.
- **BLOCKED.** A-18 did not pass.

## Bob

### B-01 to B-03

Repeat A-01, A-03, A-07 and A-08 as Bob, with `Bob workspace beta`, `Bob case beta`, and the sentence `Bob beta sentence must stay hidden`. Same pass, fail and blocked rules, with the names swapped.

### B-04 Bob cannot read Alice

- **Precondition.** Both cases exist. Tester has Bob's session and Alice's case id, document id and report URL from Alice's evidence.
- **Action.** While logged in as Bob, request Alice's workspace URL, case URL, document URL, search URL, original-file URL, report URL and PDF URL. Also call the same paths as HTTP requests with Bob's session cookie.
- **Expected.** Each request is refused. No Alice title, sentence or file name in any body.
- **PASS.** Every refused response is saved, and a search of those bodies finds no Alice sentence.
- **FAIL.** Any Alice sentence, title or file bytes are returned.
- **BLOCKED.** Alice's ids were not recorded.

### B-05 Alice cannot read Bob

The same contract, with the sessions swapped.

## Charlie

### C-01 Invite

- **Precondition.** Charlie has an account. Alice is owner of `Alice case alpha` and of a second case `Alice case gamma`.
- **Action.** Invite Charlie to `Alice case alpha` only, as REVIEWER.
- **Expected.** Charlie can open alpha. Charlie cannot open gamma. The UI does not claim an email was sent if no mail was captured.
- **PASS.** Both cases evidenced.
- **FAIL.** Charlie can open gamma, or Charlie can open nothing Alice invited.
- **BLOCKED.** Invitations are disabled and the rehearsal was not authorised to enable them.

### C-02 Access

Covered by C-01. Do not give it a separate pass if C-01 failed.

### C-03 Revoke

- **Action.** Alice removes Charlie from alpha.
- **Expected.** An audit entry exists for the removal. Charlie's session can no longer open alpha.
- **PASS.** Refusal is saved after revocation.
- **FAIL.** Charlie can still open alpha.
- **BLOCKED.** C-01 blocked.

### C-04 and C-05 Scope of revocation

- **Expected.** Alpha is refused. Gamma stays refused, because Charlie was never invited to it. If a later rehearsal invites Charlie to gamma as well, revoking alpha must leave gamma working. This candidate's handover says other case access remains intact. Test that only if gamma was actually granted.
- **PASS.** The granted case is gone and the ungranted case was never visible. If both had been granted, only the revoked one is gone.
- **FAIL.** Revocation removes a case that was not revoked, or removes nothing.
- **BLOCKED.** C-03 blocked.

### C-06 Pending invite

- **Action.** After revocation, use any still-pending invitation link for alpha.
- **Expected.** It does not restore Charlie.
- **PASS.** Alpha stays refused.
- **FAIL.** Alpha opens again.
- **BLOCKED.** No pending link exists to try. Record that, and do not treat it as a pass of the restore path.

## Ordinary failures

### F-01 Wrong password

- **Expected.** No session. The message does not say whether the email exists, unless the candidate's code does say so. Record the exact message.
- **PASS.** No session.
- **FAIL.** A session starts.
- **BLOCKED.** Login page unavailable.

### F-02 Oversized file

- **Action.** Upload a file larger than 3 MB.
- **Expected.** Refusal. No new document id.
- **PASS.** Error visible, id absent.
- **FAIL.** A document id is created.
- **BLOCKED.** Upload control unavailable.

### F-03 Duplicate

- **Action.** Upload the same TXT bytes again.
- **Expected.** The existing document is reused, or the UI says it was reused. There is one document, not two.
- **PASS.** One id.
- **FAIL.** Two ids for the same bytes.
- **BLOCKED.** The first upload did not pass.

### F-04 Failed source

Execute Railway B in `RAILWAY_TEST.md`. A failure must not be shown as "no change", "nothing found", or a successful empty result.

### F-05 Bad reset link

Covered by A-05. A missing mail capture is BLOCKED for this row, not a pass.
