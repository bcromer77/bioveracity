# BioVeracity

The memory of the physical environment: source-linked evidence reconstruction across places, government records, operators and communities.

## Repository status

Initial source import from Bazil Cromer's `bioveracity (19)(1).zip`, dated 7 September 2026. This repository is a development baseline, not a deployment or certification of the environmental claims in its existing corpus.

The Next.js application lives in `nextjs_space/`. Database records are not included. Runtime credentials remain outside Git. Existing dependency versions and application behaviour are preserved for baseline comparison; a reproducible dependency lockfile and clean staging build remain to be established.

## Local setup

Use Node.js satisfying `nextjs_space/package.json` (currently >=20.9). Review that file for package scripts. Configure a separate development PostgreSQL database using `nextjs_space/.env.example`; never point tests or seed scripts at production. Install dependencies with the package manager agreed for the project, generate Prisma Client, and validate database migrations before applying them. Do not run seed or migration commands automatically.

The archive contains Abacus-specific integrations for notifications, PDFs and Ask. Configure them only when required. Ask is feature-gated. A source import does not activate those services or live ingestion.

## Immediate backlog

1. Verify source passages before approving claims; an agency URL or asset identifier alone is insufficient.
2. Establish dependency locking, explicit type checks, staging and rollback; current Next config ignores build type errors.
3. Add place/reach identity, geographic/time filters and evaluated semantic retrieval to existing keyword search.
4. Implement school-mediated anonymised community questions and the proposed awards programme.
5. Connect reviewed signal ingestion and verify the specific Abacus deployment route.

## Import exclusions

Excluded runtime `.env`, TypeScript build cache, historical platform metadata/instructions and the old authentication smoke script. The historical instructions and smoke script contain credential-related material and are retained only in the supplied archive. Fresh project rules are in `AGENTS.md`. No automatic GitHub Actions deployment is configured.

## Commercial direction

Cambridge–Peterborough leads. Kilkenny–Carlow and Puglia are partner-development workstreams. Awards recognise observation and learning; sponsors fund participation without controlling findings. Institutional customers purchase scoped evidence services. No partners, awards launch or funding are implied confirmed.
