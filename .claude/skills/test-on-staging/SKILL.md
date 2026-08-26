---
name: test-on-staging
description: Test a change on a branch's staging server without a browser — inspect or patch a chart's config remotely, pick the right preview link to share, and know why /search 404s there. Use when testing on staging-site-<branch>, reading or changing a chart config on a remote server, or pointing someone at a chart on staging.
metadata:
    internal: true
---

# Testing on staging

- `yarn tsx devTools/callAdminApi.ts get <chartId> --branch <branch>` / `set <chartId> '<jsonPatch>' --branch <branch>` / `unset <chartId> <field> --branch <branch>`: inspect or change a chart's config on any `staging-site-<branch>` (or `--host` for local/prod) without the browser.
- Auth is `ADMIN_API_KEY` in `.env` — one shared key works against **every** staging server (not per-branch), since `admin_api_keys` ships in the private data dump every staging build restores from (see `db/exportMetadataTables.ts`). It's the same key etl already uses; no need to mint a new one.
- Don't wait for the static-site rebake (~10-13 min) to check or share a chart — `http://staging-site-<branch>/admin/charts/<id>/preview` reflects both chart-config edits and pushed code changes within ~1-3 min. Default to this link (not the public `/grapher/<slug>` page) whenever pointing someone at a chart on staging.
- A branch's `/search` and `/api/search` 404/500 with "index does not exist" unless the PR carries the `staging-algolia` label (like `staging-typesense`/`staging-bake`) — that label is what triggers the per-branch Algolia reindex during bake, and it isn't applied by default. Staging and production Algolia data also live in **separate Algolia applications**, so don't probe a staging index with production's `appId`/key to check whether it exists; test through the deployed `/search` or `/api/search`, which uses whatever env that deployment is configured with.
