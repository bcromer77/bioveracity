# Private workspace dashboard — bounded first slice

Implements the metadata-only interface for #24 and #25. This is not the completed evidence workspace. No production deployment or migration is included.

## Delivered

- Authenticated `/workspace` and a signed-in account-menu entry.
- List/create private workspaces; list/create cases and read case sites through the companion backend's authorised API.
- Planning, farmer, ESG, freight/trade and general templates change the guiding question, not ownership rules.
- Up to 20 named sites at case creation, without inferred coordinates. No client-side persistent storage or private content in URLs.
- Loading, empty, validation, denied, expired-session and feature-disabled messages. Never inserts demonstration cases after an API failure.
- Account/workspace/case keyed component lifetimes, cancelled reads and cancellation checks before applying responses.

## Backend dependency

The separate private-workspace backend must land before this is functional. Main alone has none of these endpoints:

| Request | Shape |
| --- | --- |
| GET `/api/workspaces` | `{workspaces:[{id,name,createdAt}]}` |
| POST `/api/workspaces` | `{name}` → `{workspace:{id,name,createdAt}}` |
| GET `/api/workspaces/:workspaceId/cases` | `{cases:[{id,workspaceId,title,template,createdAt}]}` |
| POST same | `{title,template,sites:[{name}]}` → `{case:{...}}` |
| GET `/api/workspaces/:workspaceId/cases/:caseId` | `{case:{...,sites:[{id,name,latitude,longitude}]}}` |

Templates: `PLANNING`, `FARMER`, `ESG`, `FREIGHT`, `GENERAL`. HTTP 401 requires sign-in, 403/404 share unavailable guidance, 503 reports disabled installation. Private reads and writes require server-enforced membership, irrespective of UI state. Do not enable solely because the dashboard renders.

## Intentionally absent

Document/email imports, timeline extraction, semantic search, satellite sliders, sharing/invitations, PDF exports and CBAM calculations are not provided by this slice. Controls for these features are not presented as working. No child submissions are collected. No grant eligibility, regulatory compliance or emissions figure is inferred by choosing a template.

## Verification

Run in `nextjs_space`:

```
node --test tests/workspace-client.test.mjs
node node_modules/typescript/bin/tsc -p tests/tsconfig.workspace-ui.json --pretty false
```

Nine tests exercise request options, error boundaries, template payloads, limits, date formatting and source-level remount/cancellation guardrails. Source-level guards are not substitutes for browser interaction tests or backend isolation tests. Scoped typecheck covers the new UI, page and its imports. Full-project typecheck in the available local dependency installation fails on missing `framer-motion` imports in existing `components/ui/animate.tsx` and `components/ui/task-card.tsx`; it must be rerun in the deployment-equivalent environment.

Before enabling: use two test accounts and an isolated database; create a workspace and three-site case, refresh and inspect details; deny the other account direct GET and POST; switch account/workspace during slow reads; disable the feature and confirm an honest unavailable state. No deployed-browser or end-to-end database test is claimed here.
