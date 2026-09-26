# Luogo — Optimal Next Question Engine

## Purpose

Luogo is a bounded evidence-gap assistant for BioVeracity. Its job is **not to invent an answer**. Given a place, case, project or observation and the evidence already held by BioVeracity, it proposes the smallest useful next question or evidence request that could reduce a material ambiguity.

The product principle is:

> **Do not ask more questions. Ask the next question that changes what we can responsibly know.**

This PR is deliberately downstream of the evidence/provenance work in PR #79. It must reuse BioVeracity evidence classes, geography, chronology, provenance and explicit unknown/conflicting states rather than creating a parallel truth system.

## Non-goals

Luogo must not:
- diagnose ecological causation from correlation;
- create opaque truth/health/risk/confidence scores;
- claim that missing evidence means an event did not occur;
- fabricate observations, dates, coordinates or source content;
- treat a human answer as equivalent to regulator/measurement evidence;
- flood visitors or staff with questionnaires;
- automatically publish user answers as verified evidence;
- make regulatory/compliance determinations;
- expose private workspace evidence across accounts.

## Core question

For the current decision or investigation:

**What is the smallest additional piece of information or evidence that would most usefully distinguish between the material explanations still consistent with the evidence?**

## Inputs

Luogo should operate only from explicit structured context:
- place/project/case identifier;
- authorised workspace;
- geographic scope and precision;
- time window;
- current evidence records and evidence classes;
- source provenance;
- known observations;
- explicit unknowns;
- conflicting records;
- coverage/source-health state;
- user objective/question where supplied.

## Evidence states

Preserve distinctions between at least:
- observed/present;
- looked for and not detected;
- evidence not located in reviewed sources;
- no search/observation effort recorded;
- source not checked/stale;
- conflicting evidence;
- unreviewed evidence;
- unknown.

Never silently convert one state into another.

## V1 deterministic candidate generation

Before any LLM wording step, deterministic code should identify candidate gaps such as:
- missing date/time precision;
- missing or ambiguous location;
- missing source/document reference;
- missing observation method/effort;
- conflicting dates;
- conflicting geography/entity identity;
- stale expected source;
- missing before/after observation around a material change;
- insufficient geographic resolution;
- unit/method incompatibility;
- unresolved entity;
- evidence class unclear.

Each candidate must include:
- gap type;
- evidence records that created the gap;
- why resolving it could matter;
- acceptable answer/evidence type;
- provenance references;
- whether a human can reasonably answer it;
- whether an authoritative source should be queried instead.

## Selection policy

V1 must be explainable and bounded. Do not pretend to solve general information theory.

A candidate may be selected as the next question only when:
1. it relates directly to the user's current place/case/question;
2. answering it could alter a material interpretation, evidence state or retrieval path;
3. the information is not already present;
4. BioVeracity can explain why it is asking;
5. the requested information is proportionate;
6. the system knows how the answer will be stored and classified.

Prefer authoritative retrieval over asking a human when the answer should exist in an authoritative source.

If no question would materially improve the evidence state, Luogo should say so rather than manufacture engagement.

## LLM boundary

An LLM may:
- turn a deterministic candidate into concise natural language;
- classify an incoming human answer for review;
- explain why a question is being asked;
- help decompose a user's investigation question.

An LLM must not:
- invent the candidate gap;
- manufacture source evidence;
- assign unsupported probabilities;
- decide ecological/legal causation;
- silently promote a human answer to verified evidence.

The deterministic layer remains authoritative for gap identity, source references, state transition and persistence.

## User experience

Luogo should feel like a restrained expert, not a chatbot interrogation.

Example:

**Luogo asks**
> Was this photograph taken at the lower pond on 24 September, or elsewhere on the site?

**Why I'm asking**
> The photograph is dated, but its location is only recorded at site level. Confirming the pond would allow it to be compared with the lower-pond chronology.

Possible actions:
- answer;
- attach/source evidence;
- not sure;
- skip;
- this question is wrong.

The user must be able to see what evidence triggered the question.

## Human-answer lifecycle

A human answer is new evidence, not retroactive proof.

Store:
- question;
- deterministic reason code;
- triggering evidence references;
- who answered;
- role/context where appropriate;
- answer;
- answeredAt;
- geography/time precision supplied;
- evidence class;
- review status;
- provenance;
- correction/supersession history.

Answers should enter the existing reviewed evidence lifecycle where practical. Do not automatically publish.

## Privacy and safeguarding

- enforce workspace isolation server-side;
- minimise personal data;
- do not solicit unnecessary sensitive information;
- preserve existing child/community safeguards;
- rate-limit prompts;
- allow skip/not sure;
- no dark patterns or forced contribution;
- no public attribution without explicit product/legal basis.

## Evaluation fixtures

Create fixed evidence scenarios with expected next-question behaviour:

1. Photo with date but ambiguous sub-site location.
2. Species not observed, but no search effort recorded.
3. Two documents give conflicting event dates.
4. County statistic presented alongside site evidence: Luogo must not ask a question that implies county data is site measurement.
5. Expected regulator source is stale: prefer source retrieval, not asking visitor.
6. Observation has precise location/time but unclear method.
7. Evidence already sufficient: ask nothing.
8. Multiple gaps: select one material next question and explain why.
9. Human answers “not sure”: preserve uncertainty.
10. Cross-workspace evidence exists: must not leak or use it.

## API/UI foundation

Proposed authenticated interfaces, adapted to existing conventions:
- `POST /api/v1/luogo/next-question`
- `POST /api/v1/luogo/questions/:id/answer`

A response should include:
- question id;
- question text;
- reason code;
- concise why-this-matters explanation;
- triggering evidence references;
- requested evidence/answer type;
- allowed responses;
- expiry/staleness where relevant.

Do not expose hidden model reasoning.

## Metrics

Measure usefulness, not engagement:
- questions generated;
- questions answered/skipped/not-sure;
- answers accepted/rejected after review;
- gaps resolved;
- questions later determined unnecessary/wrong;
- authoritative retrieval substituted for human question;
- median questions per investigation.

Do not optimise for number of questions asked.

## Definition of done

This PR is not done because an LLM can generate a plausible question.

Required evidence:
1. deterministic gap detector passes fixtures;
2. question selection is reproducible for fixed evidence;
3. every question cites the evidence/gap that triggered it;
4. authoritative-source gaps route to retrieval rather than humans where appropriate;
5. human answers remain reviewable evidence and do not auto-publish;
6. `not sure` and `skip` preserve uncertainty;
7. cross-workspace isolation tests pass;
8. no arbitrary truth/confidence/health score introduced;
9. relevant typecheck/tests/build pass;
10. one end-to-end demo shows evidence -> gap -> one next question -> answer -> reviewed evidence state;
11. existing Niamh/customer journeys remain unaffected;
12. no production deployment without explicit approval.

## Handoff

Report:
- branch + full SHA;
- changed files;
- migrations;
- env var names only;
- deterministic rules implemented;
- LLM use, if any;
- fixtures/tests and exact results;
- security/isolation results;
- deployed/not deployed;
- blockers.

## Relationship to PR #79

PR #79 establishes the source-linked regional evidence foundation. Luogo consumes that evidence state. It should not block PR #79, and PR #80 should not be merged ahead of required #79 contracts unless compatibility is explicitly proven.

## Product principle

**Luogo does not try to sound intelligent. It identifies what BioVeracity does not yet know, and asks for the smallest defensible piece of evidence that could change that.**
