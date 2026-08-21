# Getting started: authoring data nuggets

A **data nugget** is a short, comprehensible, link-backed view of OWID chart data —
a title, a sentence or two, and one (occasionally more) grapher chart that shows
exactly what's described. You author them with Claude Code skills that live in
this repo, and they land in the admin (`/admin/agentic-writing`) for review.

This guide is for someone doing it for the first time. For the schema, directory
layout, and review/versioning model, see [README.md](./README.md).

## 1. Prerequisites

- An **owid-grapher checkout** with dependencies installed (`yarn install`) — the
  skills live in this repo and you run them with Claude Code from the repo root.
- **Claude Code** and a network connection.

You do **not** need a running database or admin server just to generate.
Investigate, generate, and fact-check read public OWID chart CSVs
(`ourworldindata.org/grapher/{slug}.csv`) and refine only edits local JSON — none
of them touch a database. A database is involved only when you **push** nuggets
into an admin (and to mint the API key for it), and that targets whichever admin
you choose:

- **Pushing to a staging server** (the simplest way to share with colleagues):
  no local database or local admin needed — you mint a key against the staging DB
  and push over HTTP (see the staging note in step 2).
- **Pushing to your own local admin:** you'll need local dev running — a local
  database and the admin server at `localhost:3030/admin`. See
  [docs/setup-options-overview.md](../docs/setup-options-overview.md) and
  [docs/grapher-admin-server.md](../docs/grapher-admin-server.md).

## 2. One-time auth (needed only to push nuggets into the admin)

Generating, fact-checking, and refining are purely local and need no auth — they
only read public OWID data and write JSON files under `data-nuggets/`. Only the
final **push** step writes to a database, via the admin API, which needs a key.

Find your user id, then mint a personal admin API key:

```bash
# your user id
yarn query "SELECT id, email FROM users WHERE email = 'you@ourworldindata.org'"

# create a key for it (prints the key once — store it somewhere safe)
yarn tsx --tsconfig tsconfig.tsx.json devTools/createAdminApiKey.ts --userId=<your-id>
```

Then point the push at your target admin:

```bash
export OWID_ADMIN_BASE="http://localhost:3030/admin/api"
export OWID_ADMIN_API_KEY="<the key it printed>"
```

**Targeting a staging server instead?** Staging databases are fresh copies, so
your local key won't exist there — create one against the staging DB and point
the base at it. Staging MySQL listens on port 3306 and its `users` emails are
anonymised (`{id}@example.com`), so look yourself up by `fullName`:

```bash
yarn query -s "SELECT id, fullName FROM users WHERE fullName = 'Your Name'"
GRAPHER_DB_HOST=staging-site-<branch> GRAPHER_DB_PORT=3306 GRAPHER_DB_USER=owid GRAPHER_DB_PASS= GRAPHER_DB_NAME=owid \
  yarn tsx --tsconfig tsconfig.tsx.json devTools/createAdminApiKey.ts --userId=<your-staging-id>
export OWID_ADMIN_BASE="http://staging-site-<branch>/admin/api"
export OWID_ADMIN_API_KEY="<the key it printed>"
```

(`yarn query -s` connects to the staging DB for your current git branch.)

## 3. Generate some nuggets

The fastest path is the orchestrator skill, which runs the whole pipeline end to
end for one or more chart slugs and pushes the result:

```
/data-nuggets child-mortality
```

It will: find or run an investigation → generate ~10 nuggets → fact-check every
number → refine → push them to the admin as your private drafts → clean up the
local working files. Pass several slugs to do a batch.

Prefer manual control over a stage? Run the five steps individually, in order:

| Step | Skill                             | Does                                                   |
| ---- | --------------------------------- | ------------------------------------------------------ |
| 1    | `/investigate-chart <slug>`       | Deep data investigation → an HTML report in `reports/` |
| 2    | `/generate-data-nuggets <slug>`   | Draft nuggets from the report → JSON in `views/`       |
| 3    | `/fact-check-data-nuggets <file>` | Recompute every claim against the data, in place       |
| 4    | `/refine-data-nuggets <file>`     | Editorial polish, in place                             |
| 5    | `/push-data-nuggets <file>`       | Push the refined file into the admin DB                |

**Multi-chart nuggets:** most nuggets are a single chart. When a point genuinely
needs a second chart — usually a cross-indicator cause, e.g. GDP per capita paired
with oil production — pass both slugs as one `+`-joined key so a single run has
both charts to work with (`/data-nuggets gdp-per-capita-worldbank+oil-production-by-country`).
A space-separated list, by contrast, is treated as separate single-chart runs.
Don't force a second chart where one suffices.

## 4. Review them in the admin

Open `/admin/agentic-writing`. Your new nuggets are **private drafts** under the
**My drafts** scope. From there you can:

- Page through with the keyboard and **approve / request revisions / reject**, or
  rewrite a nugget inline.
- **Submit** a draft to move it into the shared **Editorial queue** so colleagues
  can review it; an approved + submitted nugget can then be **published**.
- Switch the **scope** dropdown (My drafts / Editorial queue / Published / **All**)
  to see other people's work — "All" shows everything.

You can also drive review conversationally with the `/review-agentic-writing` skill.

## 5. Good habits

The skills enforce most of this, but it helps to know the house rules:

- **Every number must be computed from the data**, never remembered — the
  fact-check step recomputes and will correct or flag you.
- **Superlatives are claims.** "Only", "largest", "first" get sweep-tested against
  the whole dataset; if the data disproves them they're rewritten.
- **No causal "why" the chart can't show.** If you want to explain a cause, add a
  chart that shows it (that's when a nugget earns a second chart).
- **Be conservative with `keyInsightLevel`.** `key` is reserved for genuine global
  state-of-the-world facts; most nuggets are `null`.

## Where things live

- Skills: `.claude/skills/{investigate-chart,generate-data-nuggets,fact-check-data-nuggets,refine-data-nuggets,push-data-nuggets,data-nuggets}/`
- Local working files (gitignored): `data-nuggets/{reports,views}/`
- Schema, layout, and the review/versioning model: [README.md](./README.md)
- The admin code: `adminSiteClient/AgenticWriting*.tsx`, `adminSiteServer/agenticWritingStore.ts`
