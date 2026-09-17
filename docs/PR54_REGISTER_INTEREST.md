# PR54 — Register interest

## Objective
Give interested people a lightweight way to raise their hand without creating an account, workspace, WildHub, subscription or payment relationship. This is demand capture, not a new product build.

## States
1. **Interested** — form submitted; no account created.
2. **Invited** — BioVeracity deliberately invites/provisions through existing routes.
3. **Paying** — future Stripe work. Stripe is out of scope here.

## Required implementation
Add a restrained **Register your interest** action only where it naturally fits existing public BioVeracity/Wild Counties pages. Reuse existing layouts/components; no redesign.

Use one reusable form collecting only: required name; required email; optional organisation; required controlled interest category (Wild Counties/business, professional/ecologist, planning/development/BNG, community/school, other); optional short message. Capture a controlled originating surface such as wild/professionals/bng/general so demand can be attributed. Do not trust arbitrary source strings.

Inspect existing enquiry/contact schema, routes, admin surfaces, rate limiting and email patterns before coding. Reuse them if they cleanly fit. Otherwise add one small additive interest-lead model/migration. Minimum persistence: id, createdAt, name, normalised email, optional organisation, category, optional message, controlled source, simple new/interested status.

Submission must never create or mutate User, PrivateWorkspace, PrivateCase, WildHub, publication, evidence, subscription or payment records.

Use server-side validation/length limits, email normalisation, existing CSRF/origin conventions, and existing rate-limit/anti-spam patterns where available; otherwise the smallest bounded protection. Link existing privacy information where appropriate. Lead data must not be public.

Success copy should be simple: **Thanks. You're on the list.** BioVeracity is opening gradually to businesses, professionals and people working with places and nature. We'll get in touch when there's something relevant for you. Do not promise dates, pricing, certification or acceptance.

Give an authorised administrator the smallest useful way to inspect leads and source/category, preferably by extending an existing admin/enquiry view. Simple table/export is enough. Do not build a CRM.

## Founder notification email — required
Every successfully persisted Register your interest submission must attempt a founder notification email to the configured interest-notification recipient. In production that recipient must be **bazil.cromer@ripplexn.com**.

Prefer a single environment/config value such as `INTEREST_NOTIFICATION_EMAIL=bazil.cromer@ripplexn.com` rather than scattering or repeatedly hard-coding the address. Reuse the repository's existing safe configured email delivery pattern; do not introduce a second mail system.

The notification should contain only the useful lead context: name, email, organisation if supplied, controlled interest category, controlled originating surface/page and optional message. Do not include secrets or unrelated account/environment data.

Persistence is the source of truth and must happen before the notification attempt. A temporary email-provider failure must **not** lose or roll back an otherwise valid lead and must not falsely tell the visitor that their interest was not registered. Record/log the notification failure using the existing safe server-side observability pattern so it can be diagnosed without exposing provider details to the visitor.

A visitor confirmation email is optional and is not a release blocker. The founder notification is required.

## Out of scope
Stripe; pricing/checkout; automatic accounts/workspaces/WildHubs; invitation automation; CRM; lead scoring; nurture/newsletter; homepage redesign; PR53 studio changes; BNG/HMMP/evidence/search; Ellona; auth changes; new AI/LLM behaviour.

## Acceptance
Anonymous visitor can open and submit; valid submission persists exactly one lead with controlled source/category; after persistence a founder notification is attempted to the configured production recipient `bazil.cromer@ripplexn.com`; notification includes name/email/organisation/category/source/message as available; simulated email-provider failure leaves the persisted lead intact and still returns the normal successful registration state; invalid/oversized input rejected server-side; spam/repetition bounded; no product/account/payment records created; authorised admin can inspect and unauthorised visitor cannot; existing public pages and PR53 behaviour unchanged except deliberate interest entry point; relevant tests/typecheck/build pass.

## Delivery constraints
Work only on `feat/register-interest` / PR54. Keep diff small. No opportunistic refactors, redesign, merge or deployment. If architecture conflicts materially, stop and report rather than creating a parallel system. Report exact files, migration, tests/build, environment requirements and remote SHA. Distinguish implemented/tested from deployed/live.