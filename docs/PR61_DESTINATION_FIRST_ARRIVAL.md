# PR61 — Destination-first arrival

## Product principle

BioVeracity should recognise why a person arrived before asking them to understand BioVeracity.

A user should not create an empty workspace when a prepared place, case or venue already exists for them.

## The three initial journeys

### Cambridgeshire / institutional reviewer

1. BioVeracity prepares the institutional workspace and first case.
2. An OWNER creates an invitation tied to the officer's email, role and optional case.
3. The invitation link shows the destination before asking for an account.
4. Existing user: sign in -> accept -> open the invited case.
5. New user: create account -> return to invitation -> accept -> open the invited case.
6. A different signed-in email cannot accept the invitation.
7. Revocation or expiry prevents acceptance.
8. Workspace and case permissions continue to be enforced by the existing private-workspace service.

The officer is not asked to choose a persona or create a workspace.

### Niamh / professional investigator

The same invitation flow can target a pre-built planning/enforcement workspace or a specific case. The destination is therefore the investigation, not a generic dashboard.

### Fodder / venue owner

A returning user who owns a Wild Hub and has no private professional workspace is routed by `/start` directly to `/wild/studio`.

This keeps venue and professional experiences separate at the interface while retaining one identity system underneath.

## Smart arrival

Generic successful authentication returns through `/start`.

- one private workspace + one permitted case + no venue hub -> open that case;
- one private workspace + multiple/no cases + no venue hub -> open that workspace;
- venue hub(s) + no private workspace -> open venue studio;
- multiple product destinations -> show the normal workspace chooser rather than guessing;
- no prepared destination -> existing workspace starting experience.

Deep links and invitation callback URLs still win over `/start`.

## Invitation security

- raw invitation token is returned only at creation time;
- database stores SHA-256 token hash;
- invitation is tied to a normalised email;
- one-time acceptance;
- expiry;
- explicit revocation;
- OWNER-only creation/revocation;
- optional case-level target;
- role and export permission chosen before acceptance;
- create/accept/revoke actions enter PrivateWorkspaceAudit;
- a valid BioVeracity account alone never grants institutional membership.

## Authentication cleanup

- email is trimmed/lower-cased at registration and credential login;
- minimum password length is enforced by the server, not only the browser;
- Google buttons are hidden unless `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`;
- ordinary auth fallback goes through smart arrival rather than always opening a generic workspace.

## Pilot acceptance test

A BioVeracity owner prepares:
- workspace: Cambridgeshire BNG Evidence
- case: Waterbeach
- invitee: a new reviewer account

The reviewer must be able to:
1. open invitation;
2. understand where they are going before account creation;
3. create/sign into the invited email;
4. accept once;
5. land directly in Waterbeach;
6. see only the workspace/case they were granted;
7. retain no access after membership revocation.

An unrelated account must not be able to accept the link.

## Deliberate non-goals

- no production migration in this PR;
- no email-delivery provider is introduced;
- no council SSO/Entra integration yet;
- no automated domain-wide enrolment;
- no claim that invitation links have been deployed until production verification.

The pilot can provision invitation URLs manually while the end-user experience remains one-click and destination-first.
