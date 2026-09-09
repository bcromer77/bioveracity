# Development workflow

## Roles
Codex: ordinary code changes, tests and reviewable pull requests.
GitHub: durable source, dependency locks, configuration templates, migrations, tests and work register.
Abacus: existing hosting/deployment route. It temporarily retains the current parser build repair.
Bazil: commercial priorities and production release authority.

One owner implements a task at a time. A handover records scope, branch, full SHA, uncommitted/unpushed changes, commands/results, blocker and next owner. Do not assume a fork, checkpoint, GitHub branch and deployed app are the same version.

## Save and review
Push at meaningful increments, before a handover and at session end. Use a bounded branch and PR. Preserve incomplete work as a clearly labelled draft.
Commit source, lockfiles, schema/migration files, placeholder environment examples, tests and operating instructions.
Keep credentials, runtime environment files, installed dependencies, build output, live databases and private customer/case documents outside Git. Inspect the staged diff; gitignore does not remove already tracked content.
Review current branch heads and dependencies before choosing a base. Reconcile the existing integration work before normalising future changes onto main.
A push is a saved version. A merge changes a branch. A deployment changes the hosted application. Verify each separately.

## Acceptance and release evidence
Record the exact tested SHA, Node and package-manager versions, lockfile and working directory.
Run explicit TypeScript checks and meaningful tests for changed behaviour.
Use the actual Abacus production build command and bundler. A webpack build does not prove the current default Turbopack build works.
For the parser repair, test the child process from the packaged production output, with dependencies present, successful parsing and timeout/failure behaviour. An opaque path that merely passes compilation is insufficient.
Use isolated development data. Never seed, migrate or point tests at production by implication.
Before a release, record the deploy route, target environment, authorised migration plan, backup/restore evidence, rollback and hosted acceptance results.
Private features stay disabled until access isolation, identity/MFA, scanner/container/quota controls, data/key handling and hosted acceptance requirements have been verified.

## Codex environment commissioning — pending
Repository: bcromer77/bioveracity. Application directory: nextjs_space.
Select the reconciled approved branch explicitly. Pin compatible Node and the same package-manager version as Abacus; PR29 requires Node >=22.13.
Install from the selected branch's lockfile without rewriting it; configure only isolated development credentials.
The current Prisma generator contains an absolute Abacus output path. Establish and test a portable generation strategy before declaring a cloud environment ready; do not silently alter the hosting contract.
Do not put seed/migration/deploy commands into automatic setup. Maintenance must accommodate the actual selected branch.
Commission with a fresh checkout, dependency install, Prisma generation, type checks, targeted tests and the actual production build. Record results here.
Cloud environment configuration, enforced branch protection and automated CI gates have not been installed by this documentation change. Main was unprotected at inspection. Configure required checks only after the checks exist and pass.

## Commercial completion
For changes adding recurring costs, record the billable unit, expected volume, variable API/storage/review cost, support time and usage limit. Label assumptions. Contribution is not net profit.
Prioritise the smallest paid customer outcome over unrelated expansion.
