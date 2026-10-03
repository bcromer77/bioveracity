# Prisma migrations

The `0000_init` migration is a from-empty baseline generated from the current
schema and marked as **already applied** to the existing database (which was
originally created with `db push`). It captures the schema for repository
hygiene and for any non-Abacus CI/CD or fresh environment.

## Apply procedure

Do not use `yarn prisma migrate deploy` or `prisma db push` as the way to update a shared or production database. The numbered instruction that used to say that has been removed. It would have bypassed the release helper.

The controlling procedure is `yarn db:release` from `nextjs_space`, first without `--apply`. Read `docs/PRODUCTION_READINESS_HANDOVER.md` before any apply. Per-migration status is in `docs/registers/MIGRATION_REGISTER.md`. This file does not say what production has applied.

`yarn prisma generate` is still required for the client. It does not change a database.

## Note on the Abacus hosting pipeline
The Abacus deploy pipeline runs `yarn prisma generate` and manages the schema
through checkpoint packaging; it does not invoke `migrate deploy`. These
migrations therefore serve repo hygiene and portability, not the Abacus deploy
path. Keep schema changes additive-only to protect the shared database.

## Adding future migrations
Run `yarn prisma migrate dev --name <change>` against a **local/test** database,
commit the generated folder, and apply it later only through `yarn db:release`
after `docs/registers/MIGRATION_REGISTER.md` is updated. Do not run `migrate dev`
or `migrate deploy` against the shared production database.

## Readiness review correction (PR 72)

A blind `migrate deploy` is **not safe for this mixed
history**. Private case files sort before workspace foundation, and the Ellona
migration references EvidenceDocument although production evidence is isolated.
Use `yarn db:release` to inspect dependency order/checksums and read
`docs/PRODUCTION_READINESS_HANDOVER.md` (repository root) before any application.
No existing historical migration was renamed or rewritten. A schema created by
`db push` needs actual hosted reconciliation, not automatic mark-as-applied.
The sentence above about `0000_init` having been marked applied is historical
documentation. It is not a current production ledger.
