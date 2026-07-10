# Bash commands

- yarn typecheck: runs the typescript typechecker across all files
- yarn testLintChanged: run oxlint on changed files
- yarn testFormatChanged: check formatting on changed files
- yarn fixFormatChanged: fix formatting on changed files
- yarn test run --reporter dot: run unit tests. Uses vitest, can take one or more test filenames to only run a subset.
- make migrate: apply migrations
- make dbtest: run database and api tests
- make up.headless: start the dev environment (MySQL via docker, admin server on :3030, vite on :8090) without tmux, servers run in the background with logs in logs/. Use this when you need the running site or database and no dev environment is up yet — e.g. in cloud sandboxes. Stop it with make down.headless. Never run it on a developer machine where a dev environment may already be running (check with pgrep -f adminSiteServer first) — it kills existing dev servers.

When you want to create a git commit, refer to docs/agent-guidelines/commit-messages.md for instructions.

When creating a git branch, use a short descriptive name without any prefix (in particular, no `claude/` prefix and no random suffix). Every branch gets a staging server named `staging-site-<branch>` with slashes turned into hyphens and the name truncated to 28 characters, so long or prefixed branch names produce unusable staging names.

When creating new skills in `.claude/skills/`, always include `metadata: { internal: true }` in the SKILL.md frontmatter unless explicitly asked for the skill to be public. This prevents external skill indexes from crawling and listing our internal skills.

## Code style

- We use double quotes for string literals instead of single quotes
- Use type definitions for function params and return values. Reuse existing shared type definitions where possible.
- Avoid the use of the `any` type. Only use it if you have to and ask for permission.
- In Grapher and the admin, where we use MobX 6, we use a somewhat nonstandard setup. We use class based components with TC-39 stage 3 decorators, but only for @computed and @action properties. The observable props are not marked with @observable, but are instead listed in the constructor in a `makeObservable` call. The `makeObservable` call must mention all obserable props, but none of the @computed or @action ones.
- For CSS, we mostly use named style classes following the BEM conventions in separate .scss files. We usually avoid inline styles - only use those if the component you are working on already makes use of them for a similar use case. Components usually have a companion scss file with the same name. The entry point for our site styles is /site/owid.scss, the entry point for grapher styles is /packages/@ourworldindata/grapher/src/core/grapher.scss
- In SCSS files, do NOT use the parent selector to concatenate BEM class names (`&__element`, `&--modifier`). Write out full class names (`.block__element`) so it's easy to search/navigate between JSX and SCSS. Using `&` with pseudo-classes, pseudo-elements, or state attributes (e.g. `&:last-child`, `&:hover`, `&::before`, `&[data-selected]`) is fine — those don't form a class name you'd want to grep for.
- Check [docs/browser-support.md](./docs/browser-support.md) before using modern JS or CSS features. It lists our supported browsers, the "most breaking" features we rely on, and features we can't yet use.

# Cloud sandbox sessions (claude.ai/code)

Notes for sessions running in a Claude Code cloud sandbox (`CLAUDE_CODE_REMOTE=true`):

- Use `make up.headless` when you need the running site or database. If the sandbox snapshot has a pre-imported native MySQL (the usual case), it starts within a few minutes. Only the docker fallback is slow: a cold run downloads the DB dump and imports it (10-20 minutes) and can outlive a command timeout — run it in the background, and if it gets killed anyway, just re-run it: every step is idempotent and resumes where it left off.
- `ALGOLIA_ID` and `ALGOLIA_SEARCH_KEY` are provided as environment variables (public, search-only credentials), so local site search works. Never scrape API keys out of deployed JS bundles.
- Chart thumbnails on site pages are served by a Cloudflare function that doesn't run locally. If thumbnails are missing, set `GRAPHER_DYNAMIC_THUMBNAIL_URL=https://ourworldindata.org/grapher` and `EXPLORER_DYNAMIC_THUMBNAIL_URL=https://ourworldindata.org/explorers` in `.env` to use the production ones.
- To screenshot a locally served page, use `node devTools/screenshot/screenshotPage.mjs <url> <out.png>`. The sandbox routes outbound HTTPS through an egress proxy that resets Chromium's TLS handshake; the script works around this by routing external requests through Playwright's Node-side request context.
- Staging servers are on Tailscale and unreachable from the sandbox, and local ports cannot be exposed to the user. Verify changes with typecheck, unit tests, and the local dev environment (plus screenshots).
- After pushing a branch, tell the user where to review the change on the branch's staging server, deep-linked to the affected page — e.g. `http://staging-site-<branch>/search?q=malaria` (branch name with slashes turned into hyphens, truncated to 28 characters). Mention that the staging server takes a while to build after a push, especially the first one.

# Codebase overview

This is a sort of monorepo for the Our World In Data website, including our custom data viz react component, Grapher. The codebase is in typescript, uses React 19 and Node 24.

Some key directories, going roughly along the dependency chain from the most standalone pieces to the one with the most dependencies:

- ./packages/types - shared type definitions
- ./packages/utils - utility functions
- ./packages/core-table - our custom dataframe classes used by Grapher
- ./packages/components - shared React components
- ./packages/grapher - our data viz component. Written using MobX 6 for state management
- ./packages/explorer - our data explorer that wraps grapher and adds additional drop-downs to explore more complex datasets
- ./db - code to access our MySQL 8 database as well as a substantial amount of business logic around reading ArchieML written in Google Docs
- ./site - code for our website (React rendering ArchieML). This part of the codebase does not use MobX but instead uses React hooks
- ./baker - code that "bakes" our website by rendering React to static HTML
- ./adminSiteServer - internal API for our admin
- ./adminSiteClient - client UI of the admin
- ./bespoke - self-contained custom data viz components embedded in articles via Shadow DOM. Each project under bespoke/projects/ has its own build. See bespoke/readme.md for details.
- ./devTools - various utilities
- ./functions - CloudFlare Functions. Most of our website is static but all our charts under https://ourworldindata.org/grapher/* are behind CF functions. These handle dynamic thumbnail generation, data downloads for end users etc.

# Database documentation

Our main datastore is a mysql 8 database. The documentation for this lives in db/docs - there is README.md file which is a good overview and starting point, then one TABLE-NAME.yml file per table describing the table in more detail. ALWAYS list the directory db/docs/ to understand which tables are available and read the relevant table description files before constructing a query or writing a migration.
When creating a new migration, make sure to read the [database README](./db/readme.md).

You can run (read only) queries against the database with `yarn query "QUERY TEXT"` - e.g. if you need to understand the contents of a table or the cardinality of various tables. Use `yarn query -s "QUERY TEXT"` to query the staging database for the current git branch (e.g., on branch `images-pageviews` it connects to `staging-site-images-pageviews`).

# Additional documentation

More details of our gdocs pipeline are described in these files:

- ./docs/agent-guidelines/gdocs-cms-pipeline.md - detailed overview of our archieml pipeline from gdocs to our database. Read this before you work on gdocs related things.
- ./docs/agent-guidelines/gdocs-class-hierarchy.md - overview of the different types of gdocs and how they differ and how to create new types.
- ./docs/agent-guidelines/gdocs-attachments.md - outlines the attachments mechanism and how we use it to give the react components that ultimately render our site the necessary context
