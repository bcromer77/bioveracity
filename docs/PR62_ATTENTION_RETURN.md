# PR62 — Attention & Return

## Product constitution

**BioVeracity should earn the right to interrupt someone.**

Most notification systems optimise for frequency. BioVeracity should optimise for trust.

The behavioural inversion is deliberate:

> The fewer messages we send, the more valuable each message should feel.

A train arriving is not, by itself, a reason to email a passenger.

## Default behaviour

### Immediate email
Reserved for:
- a review or decision requiring the user's action;
- a material evidence change;
- a monitoring milestone that genuinely needs attention;
- a degraded source that affects the user's evidence position;
- security/access events.

### Digest
Used when:
- another non-critical email was already sent in the previous 24 hours;
- several useful changes can be bundled;
- routine activity is explicitly requested by the user.

### In-product only
Used when:
- the change is useful but does not justify an interruption;
- the user has disabled the relevant email category.

### Quiet weekly summary
Default home for routine background change.

## Attention budget

For non-critical email, the initial rule is deliberately conservative:

- no more than one non-critical interruption per user within 24 hours;
- subsequent events are bundled;
- critical security/access events may bypass the budget;
- this is a starting product rule, not a permanent numerical truth.

The system records why a notification was scheduled so we can later ask:

> Why did this person receive this message?

and answer deterministically.

## Defaults

- Something needs me: ON
- Something important changed: ON
- Quiet weekly summary: ON
- Routine arrivals by email: OFF

The account page exposes only these four human choices. It does not expose source-by-source technical switches.

## Measurement

Do not optimise for number of emails, opens or raw return visits.

The useful measure is **useful return**:

notification -> relevant place/case -> meaningful action

Examples:
- reviewed evidence;
- resolved a question;
- acknowledged a milestone;
- created a report.

## Privacy and evidence language

Email should contain enough context to explain why the message matters, but sensitive evidence should stay behind authenticated access. The canonical action is a local BioVeracity path, not an external URL.

## Deliberate release boundary

This PR creates:
- the attention event model;
- user preferences;
- deterministic interruption/bundling decisions;
- pending delivery records;
- preference UI;
- tests.

It does **not** introduce a production email provider or claim that email delivery is live.

Provider integration should be a small follow-on once the event policy is accepted, so changing SMTP/provider infrastructure cannot change the attention rules.
