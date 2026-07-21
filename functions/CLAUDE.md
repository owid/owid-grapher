This directory contains Cloudflare Pages Functions — the dynamic edge routes of an otherwise static site (`/grapher/[slug]`, thumbnails, data downloads, `/api`, donations).

Read [README.md](./README.md) before working here. It covers:

- File-based routing plus [`_routes.json`](../_routes.json) (which paths are served dynamically); itty-router is sometimes used inside a route file for sub-routing.
- Local development: copy `.dev.vars.example` to `.dev.vars`, then `make up.full` (whole stack) or `yarn startLocalCloudflareFunctions` (functions only). Keep compatibility dates in sync between `package.json` and the Cloudflare dashboard.
- Testing in production-like environments: Cloudflare previews (recommended) vs `staging-site-<branch>` servers, which serve functions via wrangler and behave slightly differently.

This is a separate yarn workspace with its own `package.json` and `tsconfig.json` — code here runs on Cloudflare's edge runtime, not Node, so check API availability before importing server-side utilities.
