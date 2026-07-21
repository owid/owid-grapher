# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

The Our World in Data monorepo: the Grapher charting library, the chart/data admin, the static-site baker, and the React code for ourworldindata.org. Everything is TypeScript; interactive UIs use React 19 + MobX; all chart configs and data live in MySQL 8. Yarn 4 workspaces, Node 24.

## Commands

### Dev environment

- `make up` — full dev stack in tmux (Docker MySQL, admin server on :3030, Vite on :8090). First run downloads the DB snapshot (10–20 min).
- `make up.headless` — same without tmux; servers run in the background with logs in `logs/`. Use it when you need the running site or database and no dev environment is up yet (e.g. in sandboxes/CI). The environment is ready when the output prints `Dev environment is up` — wait for that exact line; don't grep for vite/admin startup patterns, they never appear. Stop with `make down.headless`. **Never run it on a developer machine where a dev environment may already be running** (check with `pgrep -f adminSiteServer` first) — it kills existing dev servers.
- `make refresh` — re-download the shared MySQL snapshot and reload the local DB.
- `make migrate` (or `yarn runDbMigrations`) — apply pending DB migrations.
- Admin UI: http://localhost:3030/admin/charts. MySQL is exposed on port **3307** (root / `weeniest-stretch-contaminate-gnarl`).

### Checks and tests

- `yarn typecheck` — `tsc -b` over all project references.
- `yarn testLintChanged` / `yarn fixLintChanged` — oxlint on uncommitted files (`testLint` / `fixLint` for the whole repo).
- `yarn testFormatChanged` / `yarn fixFormatChanged` — **oxfmt**, not prettier. Never run prettier here.
- `yarn test run --reporter dot` — one-shot unit tests via vitest; takes one or more test filenames to run a subset. Bare `yarn test` is watch mode.
- `make dbtest` — DB and API test suite (`db/tests/**`, `adminSiteServer/tests/**`). Spins up its own MySQL container and runs migrations; these tests are excluded from `yarn test`.
- `make test` — the CI bundle: lint + format check + unit tests.
- `make svgtest` — SVG regression tests for chart rendering; uses a sibling `../owid-grapher-svgs` checkout and opens an HTML diff report on failure. Run when touching grapher rendering code.
- `yarn testBdd` / `make bdd` — Playwright BDD tests driven by `features/*.feature` (requires the dev stack running).

### Git

- When you want to create a commit, follow `docs/agent-guidelines/commit-messages.md`: run `yarn fixFormatChanged`, `yarn typecheck`, and `yarn testLintChanged` first. Messages start with a gitmoji (🎉 feature, 🐛 fix, ✨ improvement, 🔨 refactor, ✅ tests, 🐝 deps, 📜 docs) followed by 🤖 to mark AI-written code.
- Branch names: short and descriptive, no prefix (in particular no `claude/` prefix and no random suffix). Every branch gets a staging server named `staging-site-<branch>` with slashes turned into hyphens and the name truncated to 28 characters, so long or prefixed branch names produce unusable staging names.

## Architecture

Dependency layers, enforced via TypeScript project references (diagram: `docs/imports-diagram.md`):

1. **Reusable packages** — `packages/@ourworldindata/*` (yarn workspaces): `types` → `utils` → `core-table` (our custom dataframe classes consumed by charts), `components`, `grapher` (the charting library itself), `explorer` (wraps Grapher with extra dropdowns for complex datasets).
2. **Foundation** — `settings/` (env config split into `clientSettings.ts` / `serverSettings.ts`, loaded from `.env`), `serverUtils/`.
3. **Core** — `db/` (MySQL access; knex for queries, TypeORM only for migrations in `db/migration/`), `jobQueue/`.
4. **Applications** — `adminSiteServer/` (Express admin API, entry `adminSiteServer/app.ts`), `adminSiteClient/` (admin React SPA), `baker/` (bakes the static public site), `site/` (React components for public pages, shared by baker and admin previews; uses React hooks, not MobX), `explorerAdminServer/`.
5. **Edge** — `functions/`: Cloudflare Pages Functions serving dynamic routes (`/grapher/[slug]`, thumbnails, data downloads, `/api`, donations) with file-based routing plus `_routes.json`. Separate workspace with its own `package.json`; local dev via `yarn startLocalCloudflareFunctions` or `make up.full`.

Other directories: `bespoke/` (self-contained custom data-viz components embedded in articles via Shadow DOM; each project under `bespoke/projects/` has its own build — see `bespoke/readme.md`), `devTools/` (various utilities).

Key facts that span multiple directories:

- **Grapher** is a client-side visualization library: a chart is a JSON config stored in MySQL alongside the data values it renders. Chart components follow a three-layer pattern — layout-independent `*State.ts` class, MobX `@observer` `*Chart.tsx` component, stateless SVG render component — with a `Series → SizedSeries → PlacedSeries → RenderSeries` data chain. Read `docs/agent-guidelines/chart-components.md` before touching chart code.
- **The public site is statically baked**: `baker/` merges Google-Docs-authored content with chart configs from the admin and writes out a static site. Production bakes go through a deploy queue (`baker/startDeployQueueServer.ts`); `make local-bake` does a full local bake.
- **Content is authored in Google Docs using ArchieML**. The ingestion pipeline lives in `db/model/Gdoc/` (`gdocToArchie` → `archieToEnriched` → enriched JSON blocks persisted to `posts_gdocs`), with a `GdocBase` class hierarchy (`GdocPost`, `GdocDataInsight`, `GdocHomepage`, …). Before working on gdocs-related things, read:
    - `docs/agent-guidelines/gdocs-cms-pipeline.md` — the archieml pipeline from gdocs to the database
    - `docs/agent-guidelines/gdocs-class-hierarchy.md` — the gdoc types and how to create new ones
    - `docs/agent-guidelines/gdocs-attachments.md` — how attachments give rendering components their context

## Database

- Table documentation lives in `db/docs/` — a `README.md` overview plus one `TABLE-NAME.yml` per table. ALWAYS list `db/docs/` and read the relevant table files before constructing a query or writing a migration.
- `yarn query 'SELECT ...'` — read-only SQL against the local dev DB. `yarn query -s "..."` queries the staging database for the current git branch (e.g. on branch `images-pageviews` it connects to `staging-site-images-pageviews`).
- DB access convention in code: wrap queries in `knexReadonlyTransaction` / `knexReadWriteTransaction` from `db/db.ts` rather than using a raw knex instance.
- New migrations: use the `create-migration` skill (`.claude/skills/create-migration`) and read `db/readme.md` first.

## Code style

- Double quotes for string literals.
- Type function params and return values; reuse existing shared type definitions. Avoid `any` — only use it if you have to, and ask for permission.
- In Grapher and the admin (MobX 6) we use a nonstandard setup: class-based components with TC-39 stage 3 decorators, but only for `@computed` and `@action`. Observable props are NOT marked `@observable`; they are listed in a `makeObservable` call in the constructor. That call must mention all observable props, but none of the `@computed`/`@action` ones.
- CSS: named style classes following BEM in separate `.scss` files; avoid inline styles unless the component already uses them for a similar case. Components usually have a companion scss file with the same name. Entry points: `site/owid.scss` for the site, `packages/@ourworldindata/grapher/src/core/grapher.scss` for grapher.
- In SCSS, do NOT use the parent selector to concatenate BEM class names (`&__element`, `&--modifier`) — write out full class names (`.block__element`) so it's easy to grep between JSX and SCSS. `&` with pseudo-classes/elements or state attributes (`&:hover`, `&::before`, `&[data-selected]`) is fine.
- Check [docs/browser-support.md](./docs/browser-support.md) before using modern JS or CSS features. It lists our supported browsers, the "most breaking" features we rely on, and features we can't yet use.
- package.json scripts are camelCase and descriptive: `startXXX` for long-lived processes, `buildXXX` for scripts that write output (`docs/coding-style.md`). Server-side scripts run via `tsx --tsconfig tsconfig.tsx.json`.

## Other conventions

- `docs/agent-guidelines/` holds in-depth docs written specifically for agents — check there first when working in those areas.
- When creating new skills in `.claude/skills/`, include `metadata: { internal: true }` in the SKILL.md frontmatter unless explicitly asked for a public skill — this keeps external skill indexes from listing internal skills.
- GitHub Actions references must stay pinned to commit SHAs (managed with pinact).

## Cloud sandbox sessions (claude.ai/code)

Notes for sessions running in a Claude Code cloud sandbox (`CLAUDE_CODE_REMOTE=true`):

- The sandbox pre-creates a session branch named `claude/<slug>-<random-suffix>`, which violates the branch-naming rules above. Rename it before the first push: `git branch -m <short-descriptive-name>`.
- Use `make up.headless` for the site/database. If the sandbox snapshot has a pre-imported native MySQL (the usual case), it starts within minutes; only the docker fallback is slow (10–20 min download+import) and can outlive a command timeout — run it in the background, and if it gets killed, re-run it: every step is idempotent and resumes.
- The snapshot's database can be up to a week older than the code. After `make up.headless`, run `make migrate` to apply any migrations merged since — it's idempotent and takes seconds. If pages still 500 on missing tables/columns, `make refresh` re-imports a fresh dump (10–20 minutes).
- `ALGOLIA_ID` and `ALGOLIA_SEARCH_KEY` are provided as env vars (public, search-only), so local site search works. Never scrape API keys out of deployed JS bundles.
- Chart thumbnails are served by a Cloudflare function that doesn't run locally. `GRAPHER_DYNAMIC_THUMBNAIL_URL` and `EXPLORER_DYNAMIC_THUMBNAIL_URL` are usually provided; if absent and thumbnails are missing, set them in `.env` to `https://ourworldindata.org/grapher` and `https://ourworldindata.org/explorers`.
- To screenshot a locally served page, use `node devTools/screenshot/screenshotPage.mjs <url> <out.png>`. The sandbox routes outbound HTTPS through an egress proxy that resets Chromium's TLS handshake; the script works around this by routing external requests through Playwright's Node-side request context.
- Staging servers are on Tailscale and unreachable from the sandbox, and local ports can't be exposed to the user. Verify changes with typecheck, unit tests, and the local dev environment (plus screenshots).
- After pushing a branch, tell the user where to review on the branch's staging server, deep-linked to the affected page — e.g. `http://staging-site-<name>/search?q=malaria`. Don't derive the staging name by hand; compute it with `node -e 'const b=process.argv[1].replace(/[/._]/g,"-");console.log(("staging-site-"+b.slice(0,28)).replace(/-+$/,""))' "$(git branch --show-current)"`. Mention that the staging server takes a while to build after a push, especially the first one.
