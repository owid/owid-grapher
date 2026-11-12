# Review guidelines

## Risk

What makes a change risky in this repository. The `/owid-staff:rate-pr-risk` skill (opt-in) reads this to suggest whether a PR needs a second review: `risk: low` (no), `risk: medium` (recommended) or `risk: high` (needed). The PR owner decides.

### High: where we need to be careful

- **Anything readers see.** A broken site, wrong data or a wrong chart is the worst outcome. That covers the bake, `site/`, chart rendering, `functions/`, embeds, shared bespoke code, experiments, feeds and emails, the chart and search APIs, and migrations that edit published content.
- **Foundations that other things will be built on.** A new data model, schema, API or shared abstraction is cheap to change now and expensive once tools depend on it. This includes what our published packages export (`@ourworldindata/grapher`, `gdoc-pipeline`, `grapher-editor`).
- **Who can do what.** Authentication, permission checks, untrusted input, write credentials, and what CI workflows do with secrets.
- **Data we can't bring back.** Code that deletes or rewrites stored data on its own (bake steps, sync jobs, `devTools/` scripts, migrations with an empty `down`), including Google Docs and R2.

### Medium

- A reader-facing change with evidence a reviewer can open: tests that pin the change, staging screenshots, or an SVG diff report (Grapher charts only) that shows only intended differences.
- A change confined to one bespoke project, or whose worst case is stale content (deploy triggering).
- Schema migrations: the database is backed up and `down` reverts them. Other repositories and the public data export read this schema; see `db/migration/CLAUDE.md`.
- Admin features that authors use daily, refactors of thinly tested code, and dependency bumps on the render or bake path.

### Low

Docs, tests, agent instructions, read-only dev tooling, CI changes away from secrets and deploys, release version bumps, and other admin UI.
