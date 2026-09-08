# Cambridge demo release gate

## Completed in this build

- River Cam WFD classification correction is auditable and dry-run by default.
- The classification event is assigned to 2022 with year precision and class `R`.
- Milton WRC to River Cam is stored as a verified, source-linked `AssetRelation`.
- Cambridge pages load discharge connections from the canonical relationship graph; no page-level relationship assertions remain.
- Prisma Client output is portable and no longer tied to an Abacus filesystem path.
- The incompatible animation dependency has been removed in favour of local CSS transitions.
- A reproducible `package-lock.json` and complete release test command are present.

## Verified commands

```sh
npm install --legacy-peer-deps
npx prisma generate
npm run typecheck
npm run test:release
npm run build
```

Result: 27 tests passed, TypeScript passed, production build passed.

## Controlled database correction

Run against an approved preview database first:

```sh
node --import tsx scripts/correct-cam-classification.ts
node --import tsx scripts/correct-cam-classification.ts --apply
```

The first command is a read-only dry run. Inspect its proposed asset, event and relationship changes before using `--apply`. The apply operation is transactional and does not delete records.

## Production boundary

Do not run the correction or deploy until the specific Abacus database target, deployment route and rollback checkpoint have been confirmed. After deployment, verify both Cambridge routes, their source links, classification label/date and Milton-to-Cam connection.
