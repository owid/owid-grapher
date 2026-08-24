# Baker

This folder contains code for baking and deploying the live site.

## Queue

Currently we use pm2 to run the queue process. This process creates a deploy queue when an author makes a change.

It used to be embedded as part of `adminSiteServer` and a deploy process was spawned every time there was a deploy. The issue at the time was that we'd have multiple processes deploying simultaneously and very rarely it would lead to broken content (e.g. js deployed while webpack is generating it). The other issue was that these processes, for some unknown reason, sometimes didn't exit cleanly, and would hang around as zombies.

The current single-process-deploy provides some simplicity when dealing with queues – e.g. no simultaneous deploys; a new deploy automatically starts if there are items in the queue at the end of a deploy. Also no TS compilation needs to happen (pretty minor but saves 10-15 seconds each deploy). It's also much easier to shut down, e.g. when we run a code deploy, we can easily kill the process to ensure multiple deploys aren't running.

## Internal link checker

`yarn checkInternalLinks [dir]` scans every HTML file in a baked site and checks that each internal URL it references (links, images, scripts, iframes, meta tags) resolves to something the site would actually serve, following redirects. It runs purely against the baked output – no database or network access – so it can run after a bake and before upload, or locally against `make local-bake` output:

```sh
yarn checkInternalLinks localBake --baseUrl http://localhost:3030
yarn checkInternalLinks --json report.json   # defaults to BAKED_SITE_DIR / BAKED_BASE_URL
```

It emulates the production serving stack (`baker/linkChecker/resolveInternalUrl.ts`): the baked `_redirects` file with Cloudflare Pages semantics, static files on disk, then the Cloudflare Pages Functions in `functions/` (grapher slug redirects from `grapher/_grapherRedirects.json`, query-param-dependent explorer redirects from `explorers/_explorerRedirects.json`, lowercase fallbacks, and the routes that are served dynamically without a file). Links to tombstones of deleted pages are reported separately as warnings. Pass `--strict` to exit non-zero when broken links are found.

Known blind spots: redirects configured in the Cloudflare dashboard rather than in this repo, and `#anchor` targets (fragments are not checked).
