This directory contains Cloudflare Pages Functions — the dynamic edge routes of an otherwise static site (`/grapher/[slug]`, thumbnails, data downloads, `/api`, donations).

Read [README.md](./README.md) before working here. It covers:

- File-based routing plus [`_routes.json`](../_routes.json) (which paths are served dynamically); itty-router is sometimes used inside a route file for sub-routing.
- Local development: copy `.dev.vars.example` to `.dev.vars`, then `make up.full` (whole stack) or `yarn startLocalCloudflareFunctions` (functions only). The compatibility date lives in [`wrangler.jsonc`](../wrangler.jsonc) (authoritative for local, preview and production alike — not the Cloudflare dashboard); `functions/test/wrangler.e2e.jsonc` has its own copy to keep in sync.

This is a separate yarn workspace with its own `package.json` and `tsconfig.json` — code here runs on Cloudflare's edge runtime, not Node, so check API availability before importing server-side utilities.
