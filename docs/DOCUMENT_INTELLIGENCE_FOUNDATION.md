# Document intelligence: first implementation

## Purpose

Help a reviewer ask three different questions without confusing them:

1. Do passages within this report appear to disagree?
2. Does this report appear to disagree with another document in the selected case?
3. Was wording about a topic the reviewer expected located in the extracted text?

This adapts DocVault's useful workflow ideas: document-specific analysis, source
references, paired comparisons and coverage questions. It does not transplant its
MongoDB, external parsing, embeddings or LLM implementation. In particular, it does
not inherit the behaviour that converted AI failures into "no contradictions", or
the organisation-wide comparison scope.

## Implemented

The workspace has a document selector, a reviewer-selected coverage checklist and a
Check document action. Results include expandable exact source quotations, document
identifiers and hashes, passage locators and character offsets. A snapshot hash
identifies the source inputs; it is not a certificate of authenticity.

The existing private evidence endpoint accepts:

```json
{
  "action": "analyse",
  "documentId": "an-imported-document-in-this-case",
  "checkIds": ["bats", "flooding", "survey_limits"]
}
```

`GET ?action=intelligenceChecks` lists the available questions. Both operations
require current case access and the existing runtime flags. The actor comes from
the session. Analysis reads only this case's persisted passages, including labelled
earlier document versions. Other accessible cases are deliberately excluded.

There are no database migrations, new credentials or AI API calls. Analysis does
not modify source records, accept draft events or add suggestions to audit exports.
It is recomputed on request; findings are not durably saved as analyst decisions.

## What these results mean

**Possible internal contradiction / document conflict:** narrow wording rules find
opposing bat-observation or flood-observation statements, such as "No bats were
recorded" and "Bats were observed". These are unreviewed comparisons, not established
contradictions. Dates, place, species, survey scope, methods, amendments and quoted
claims still need checking. Identical source bytes do not count as separate conflict
evidence. Conditional/uncertain language is conservatively skipped.

**Coverage question:** looks for specified terms in the selected report, not every
case document. A mention does not establish adequate coverage. No match means only
that these terms were not located in the extracted text; it does not establish that
the original report omitted the issue, breached a requirement, or that an animal or
event was absent. The checklist is chosen by the reviewer, not represented as a
statutory or professional standard.

**Partial/unassessable:** missing text and parser warnings remain visible. A PARSED
document can still omit scanned pages, tables or images; source inspection remains
necessary. Network/database errors produce an error response, never a clean report.
Changing report, checklist or evidence revision invalidates the displayed analysis.

## Bounds and known limits

- At most 100 documents, 1,500 passages and 3.6 million extracted characters.
- At most 1,000 recognised statements are compared; truncation is explicit.
- At most 30 comparisons and three excerpt references per coverage question are
  displayed. Counts and truncation indicators remain in the response.
- Statements over 1,000 characters are skipped with a partial-analysis indicator.
- The statement rules do not understand arbitrary prose, tables, numbers, negation,
  chronology or biological taxonomy. Many real conflicts will not be detected.
- No NBDC, EPA, OPW or planning records are fetched. An uploaded document with a
  source URL is not automatically a verified external record.
- No semantic model, general claim extractor or formal completeness assessment is
  enabled. This is an initial text-checking implementation for review.

## Validation

Run from `nextjs_space` with the pinned project dependencies:

```sh
npm run test:intelligence
npm run test:uploads
npm run typecheck
```

The intelligence suite covers exact citations, within/across-document comparisons,
negation and hypothetical statements, missing-topic language, OCR limitations,
identity checks, copied source bytes, bounded results, snapshot changes and inert
document instructions. Its isolated PGlite HTTP journey tests persisted imports,
same-case isolation, revoked access, unchanged evidence records and database errors.
React tests check request selection, visible errors and stale-response suppression.

## Next development step

Use a labelled ecological example set to define the next extraction contract:
each proposed claim must have an exact quote plus known/unknown place, time, species,
measurement unit and survey scope. Validate those fields against source passages
before comparing claims. An external model, if later introduced, must be opt-in for
private data, cost-bounded, restricted to authorised sources and explicit about
failure. Model confidence is not evidence quality.

Then add reviewer decisions and test true conflicts against counterexamples: different
years, different survey areas, resident allegations, changed methods, missing annexes,
tables, duplicated observations and revised reports. A broader AI extraction step
must not be advertised as enabled by this initial implementation.

## Handoff

This is a separate draft branch stacked on PR #36's upload repair. It is prepared
for review, not merged or deployed. Do not let it delay the live upload verification
for Niamh's V1. Before any release, confirm the application serving bioveracity.com,
the Abacus deployment route and a rollback checkpoint. A future live check must use
labelled synthetic documents and confirm that sources and findings remain confined
to the selected private case.
