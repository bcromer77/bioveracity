# Stripe billing engineering handoff

## Scope

This branch adds a deliberately small subscription-billing boundary. Stripe handles payment details; BioVeracity stores only Stripe customer/subscription references and the current billing state required for account display.

Billing state does **not** grant workspace, case, venue or institutional permissions. Existing membership and invitation checks remain authoritative.

## Safety gates

Billing is off unless `BIOVERACITY_BILLING_ENABLED=true`.

A live Stripe secret key is rejected unless `BIOVERACITY_BILLING_LIVE_ALLOWED=true`. This second gate must remain false during test-mode acceptance.

Each self-service plan also has its own enable flag and requires a configured Stripe Price ID. No amount or currency is accepted from the browser.

## Routes

- `GET /api/account/billing` — current user's billing state and currently enabled plan labels.
- `POST /api/billing/checkout` — authenticated, same-origin Checkout creation for a server-approved plan.
- `POST /api/billing/portal` — authenticated, same-origin Stripe Billing Portal session.
- `POST /api/billing/webhook` — raw-body Stripe signature verification and idempotent event persistence.

## Webhook events

The engineering path supports:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Other valid events are recorded as processed without changing billing state. Replayed events are ignored by event ID. Older subscription events cannot overwrite a newer stored subscription state.

## Account UI

The account page hides billing entirely while billing is disabled. When enabled, users see only server-approved plans. Prices are shown and confirmed in Stripe Checkout rather than copied into application code. Existing subscribers can enter the Stripe Billing Portal.

## Stripe dashboard setup required after merge

Use Stripe **test mode** first.

Create the required Products/Prices, configure the Billing Portal, and register:

`https://<deployed-host>/api/billing/webhook`

for the four webhook event types above.

Store the resulting test-mode secret key, webhook signing secret and price IDs in the deployment secret manager. Never commit them.

## Acceptance

Before any live-mode enablement:

1. CI/typecheck/build are green.
2. Additive billing migration is reviewed and applied in the approved environment.
3. Billing remains disabled until test secrets are present.
4. A signed-in test user completes Checkout.
5. Stripe webhook updates the same user's BillingAccount.
6. Account page shows the resulting subscription.
7. Billing Portal opens for that customer.
8. A cancelled subscription is reflected by webhook.
9. Existing workspace/case permissions are unchanged by all billing events.
10. Live key remains rejected while `BIOVERACITY_BILLING_LIVE_ALLOWED=false`.

No production deployment or live charging is performed by this PR.
