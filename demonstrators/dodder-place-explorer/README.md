# River Dodder — compare

Work label PR102. This is a draft reference, not a claim that GitHub will number it 102.

Status: NOT INTEGRATED into `nextjs_space`. NOT DEPLOYED. Do not merge. Production write-freeze remains. No database change. No ingestion. No billing.

## Source of truth

Copied from an app-builder sandbox that is not this repository. Sandbox branch `cambridge-freeze` / also present unchanged on `pr104-salmon-demonstrator`.

Sandbox commit for these files: `7962ea5f2c00e265b94b06bfa927fe4d66ca4dd0`.

An earlier remote branch `demonstrator/dodder-place-explorer` (tip `b8dbd8917f81fafe517934fa9cf8c08e755d4bda`) is based on `main`, has no pull request, and is behind these files for `place-explorer.tsx` and `dodder.ts`. It was not force-pushed. This branch is the review copy, taken from `release/qa-pr70-pr72`.

## What it does

Shows what was knowable on 24 October 2011, what the latest located evidence shows, which comparisons are refused (Waldron's Bridge estimated flow versus Anglesea Road level; a rain day versus a rain month), and which records were not located.

## Not done

- No Next.js route.
- `src/styles.sandbox.css` is the sandbox sheet at the Cambridge freeze. Do not import it globally. Class names such as `.hero-grid` and `.panel` will collide with the Next app.
- Imports use `@/` and will not resolve inside `nextjs_space` until Codex moves them.
- Enquiry writes `localStorage` key `bv-enquiry-demo` with `transmitted: false`. It is not connected to PR #101.
- No automated test is committed. This push did not re-run a browser.

## Gaps to preserve

Original Met Éireann warning, a recent Waldron's Bridge series, a January 2026 OPW flood-event form, a Phase 3 planning reference, an adopted council decision, and the definition of quality code 31.
