# Review guidelines

## Risk

What makes a change risky in this repository. The `/owid-staff:rate-pr-risk` skill (opt-in) reads this to suggest whether a PR needs a second review: `risk: low` (no), `risk: medium` (recommended) or `risk: high` (needed). The PR owner decides.

### High: where we need to be careful

- **Anything readers see.** A broken site, wrong data or a wrong chart is the worst outcome, most of all when nothing fails loudly. That covers the bake, shared site components, chart rendering, `functions/` on public routes, embeds, emails to readers and the public API.
- **Foundations that other things will be built on.** A new data model, schema, API or shared abstraction is cheap to change now and expensive once tools depend on it, so it is worth getting right from the start. This includes the public API of our published packages (`@ourworldindata/grapher`, `gdoc-pipeline`, `grapher-editor`).
- **Who can do what.** Authentication, permission checks, untrusted input, credentials with write access, and workflows that handle secrets.
- **Data we can't bring back.** Code that deletes or rewrites stored data on its own (bake steps, sync jobs, bulk scripts), including content in Google Docs and files in R2.

### Medium

- A reader-facing change that tests or the SVG diff mostly cover, or whose worst case is stale content (deploy triggering, release tooling).
- Schema migrations: the database is backed up and a migration has a down step. A migration that drops or rewrites data is the exception.
- Admin features that authors rely on daily, refactors of thinly tested code, and dependency bumps on the render or bake path.

### Low

Docs, tests, devTools, agent instructions, a single bespoke project, staff-only or feature-flagged UI, and rendering changes whose SVG diff the author has read.
