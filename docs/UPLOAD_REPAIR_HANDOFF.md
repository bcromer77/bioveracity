# Upload repair — 10 September 2026

## Problem and scope

Both upload controls cleared an import error when their automatic evidence refresh
started. They also left the scanning/processing notice visible after failure. The
result looked like an upload was still running although the server had rejected it.

The repair separates refresh errors from action errors, clears processing notices
on failure, retains partial-batch counts, and resets the file input for retries.
Both controls continue to use the existing permissioned JSON import endpoint.
Successful imports still refresh evidence from the server.

The local scanner remains mandatory. Its failures now distinguish a missing
executable, rejected file, timeout and scanner/signature-database error. Unavailable
infrastructure returns 503; a rejected file returns 422. Private bytes are never
sent to an external scanner. Temporary files are removed on success and failure.

## Source baseline

`baseline/abacus-36-upload` preserves the application source supplied in
`bioveracity (36).zip`, applied to `feat/regional-population` at `30ef9cef`.
It excludes environment secrets and Abacus instruction files. The repair PR targets
that baseline so its diff contains only the upload repair. It does not propose
merging unrelated regional work or overwriting production with an older main branch.

## Verification

- Six React component tests exercise both actual upload controls and their effects,
  with controlled API responses and visual/navigation components stubbed. They
  check failures after refresh, same-file retry, partial failure, pending state and
  server-backed success. Four fail against the unmodified supplied source; all six
  pass with this repair.
- Five scanner tests cover unavailable, rejected, timed-out and successful scans,
  fixed limits, restricted file permissions and cleanup. The executable is injected
  in these tests; they do not certify a deployed scanner.
- Six isolated case integration tests pass, including parsing PDF/DOCX/TXT/CSV/EML,
  durable case records, reviewed PDF generation, source search and cross-user access
  denial. The HTTP test also checks that a scanner 503 preserves its explanation and
  writes no document. These use an isolated PGlite database and controlled scanner.
- Existing retrieval/workspace-client tests: 21 passed.
- Explicit `tsc --noEmit`: passed after generating Prisma types from a temporary
  schema with a local output path. No database connection, migration or seed ran.
- `node scripts/check-upload-runtime.mjs` correctly fails on this development host,
  which has no `clamscan`. This is not a production-host measurement.

Reproduce from `nextjs_space` using the pinned dependencies:

```sh
npm run test:uploads
node --test tests/retrieval.test.mjs tests/workspace-client.test.mjs
npm run test:case-files
npm run typecheck
```

## Abacus deployment handoff

Abacus's supplied notes explicitly say the preview scanner does not ship to the
production host. The live verification also failed to retain a synthetic upload;
the original screen hid the failure reason. The exact live server error has not
been independently captured. Do not describe this PR alone as a working live upload.

1. Confirm the Abacus application serving `bioveracity.com` and record its current
   rollback checkpoint. The notes identify Abacus's Deploy/checkpoint route; this
   session has not accessed that deployment console or changed the live release.
2. Apply this repair to that application's latest source. Provision `clamscan` and
   a current signature database in the actual application runtime, with permission
   to use its temporary directory. A scanner in the preview container alone is
   insufficient. Preserve the existing authentication, evidence permissions and
   runtime gates.
3. In that runtime, as the application user, run from the source release directory:

   ```sh
   node scripts/check-upload-runtime.mjs
   ```

   Include that script and `lib/workspaces/scan-file.mjs` in the diagnostic source
   directory if the standalone deployment omits source files. A nonzero exit blocks
   handover. Fix the reported runtime problem; do not bypass the scan.
4. Deploy using the confirmed Abacus route. In a clearly labelled private test case,
   upload a small text PDF; verify its filename and extracted passage; reload and
   verify both persist; ask a question that retrieves the passage; review an entry
   and download the selected case's audit PDF. Also try an invalid file and confirm
   its error stays visible and the same file can be selected again. Record the
   release/checkpoint and results. If this fails, keep the V1 handover blocked and
   use the recorded rollback checkpoint if the new release causes a regression.

This repair does not connect NBDC, EPA or OPW datasets, fetch planning objections,
anonymise resident letters, or establish AI conflict detection. Those remain
separate capabilities; do not promise them in Niamh's V1 invitation.
