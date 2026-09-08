# Prisma migrations

The `0000_init` migration is a from-empty baseline generated from the current
schema and marked as **already applied** to the existing database (which was
originally created with `db push`). It captures the schema for repository
hygiene and for any non-Abacus CI/CD or fresh environment.

## Deploy procedure (fresh / self-managed environment)
1. `yarn prisma migrate deploy` — applies pending migrations in production (do not use `db push`).
2. `yarn prisma generate`.
3. Seed bootstrap/demo data (optional): `SEED_ADMIN_EMAIL=... SEED_ADMIN_PASSWORD=... yarn prisma db seed`.

## Note on the Abacus hosting pipeline
The Abacus deploy pipeline runs `yarn prisma generate` and manages the schema
through checkpoint packaging; it does not invoke `migrate deploy`. These
migrations therefore serve repo hygiene and portability, not the Abacus deploy
path. Keep schema changes additive-only to protect the shared database.

## Adding future migrations
Run `yarn prisma migrate dev --name <change>` against a **local/test** database,
commit the generated folder, then `migrate deploy` in the target environment.
Do not run `migrate dev` against the shared production database.
