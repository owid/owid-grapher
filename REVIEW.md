# Review guidelines

## Risk

What makes a change risky in this repository. A PR can carry a risk tier that tells its owner whether to ask a second person for a review: `risk: low` (not needed), `risk: medium` (recommended, a focused look) or `risk: high` (needed, a full read and a try on staging). The tier is a recommendation and the PR owner decides. Rating is opt-in: the `/owid-staff:rate-pr-risk` skill does it, using its general guidelines plus this section.

### What a mistake costs here

- **Who is affected.** A site that is broken or shows wrong data or wrong charts is the worst outcome. Content that is stale or missing because a deploy was missed is a step below: readers still see a correct, slightly older site. Something only staff see is a step below that. Emails to readers, embeds and the public API count as reader-facing.
- **Would anyone notice.** CI, the SVG tester, a type error or a broken staging build catch a lot. A bake that quietly writes wrong output is what they miss.
- **How it is undone.** A revert doesn't undo a migration that ran in production, data that was deleted or rewritten, or a published package version.

### Usually high

- **Schema migrations in `db/migration/`**, because they are hard to undo once they have run in production. A small, reversible data migration on rows that nothing reads is judged by who reads those rows.
- **Code that deletes or rewrites stored data on its own or irreversibly**: migrations, bake steps, sync jobs, bulk scripts. Stored data includes content in Google Docs and files in R2, not only MySQL.
- **Changes to who can do what**: authentication, permission checks, removing a guard, anything that handles untrusted input, and credentials that grant write access. A key that is meant to be public is not a secret.
- **GitHub workflows that handle secrets, run on untrusted input, or change or skip required checks.**
- **Changes that can make the bake write a broken or wrong site.**
- **`functions/` code on the request path of public routes**, because it runs on every request and has no bake step to catch an error first.
- **The public API, schema or documented behaviour of a published package** (`@ourworldindata/grapher`, `@ourworldindata/gdoc-pipeline`, `@ourworldindata/grapher-editor`), because outside consumers pick it up on the next release. The other packages under `packages/` are internal.

### Usually medium

- Changes to what readers see on many pages or charts at once (baker output, shared site components, chart rendering) where tests or the SVG diff cover only part of the behaviour. A helper shared by several chart types counts as many charts.
- A rendering change with the `staging-viz` label, which mutes the SVG tester, unless the description says the author read the diff report.
- Deploy triggering and release tooling: when and how a bake, a deploy or a package release starts. The worst case is stale content or a late release.
- Admin features that authors rely on daily, admin actions that delete or rewrite drafts behind a confirmation, and admin features whose output is public, such as redirects.
- Refactors of code with thin test coverage, and performance changes to baking or data loading.
- A dependency change that moves the resolved version of a runtime package on the render or bake path.

### Usually low

Docs, tests, devTools, agent instructions, a single self-contained bespoke project, staff-only or feature-flagged UI, rendering changes whose SVG diff the author has looked at, and dependency changes that move no resolved runtime version.

### Evidence that lowers a tier

A byte-identical bake diff, a compile-time exhaustiveness check, or an SVG diff report the author has read.
