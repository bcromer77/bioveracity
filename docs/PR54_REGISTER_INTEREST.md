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

Only add email confirmation/founder notification if a safe configured email pattern already exists and is trivial to reuse. Email is not a release blocker; persistence is source of truth.

## Out of scope
Stripe; pricing/checkout; automatic accounts/workspaces/WildHubs; invitation automation; CRM; lead scoring; nurture/newsletter; homepage redesign; PR53 studio changes; BNG/HMMP/evidence/search; Ellona; auth changes; new AI/LLM behaviour.

## Acceptance
Anonymous visitor can open and submit; valid submission persists exactly one lead with controlled source/category; success is human; invalid/oversized input rejected server-side; spam/repetition bounded; no product/account/payment records created; authorised admin can inspect and unauthorised visitor cannot; existing public pages and PR53 behaviour unchanged except deliberate interest entry point; relevant tests/typecheck/build pass.

## Delivery constraints
Work only on `feat/register-interest` / PR54. Keep diff small. No opportunistic refactors, redesign, merge or deployment. If architecture conflicts materially, stop and report rather than creating a parallel system. Report exact files, migration, tests/build, environment requirements and remote SHA. Distinguish implemented/tested from deployed/live.