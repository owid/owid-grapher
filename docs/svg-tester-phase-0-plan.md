# Phase 0: delete the explorers suite

_Execution detail for Phase 0 of [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md)._

**Done.** ops#594, owid-grapher#6909, etl `e1b4ceb40`, and the svgs repo refreshed
with `explorers/` removed. Kept as a record of what was removed and why — delete
it once nobody is asking where the explorers suite went.

## Why now

Explorers are being removed from the codebase. Every later phase of the redesign
touches the render path, the status contract, and the artifact layout, so
carrying a suite that is about to be deleted means doing that work twice. The
explorers suite is also the only one with a second render path
(`renderAndVerifyExplorerViews`, which needs its own per-view timeout because one
suite entry expands to many views), so removing it first means the rest of the
redesign deals with one shape of job instead of two.

## Ordering constraint

**Ops must merge before grapher.** `svg-tester.sh` on ops `main` applies to every
open grapher PR immediately. If G stops accepting `explorers` as a `TEST_SUITES`
choice while ops still calls `run_test_suite 'explorers'`, yargs rejects the
positional argument, the suite exits non-zero, and because `set +e` is active at
that point `exit_code_explorers` propagates — turning the SVG tester step red on
every open PR. The reverse order is harmless: ops simply stops invoking code that
still exists.

Testing tip: `staging-script` clones the ops branch whose **name matches the
grapher branch**, falling back to `main`
(`ops/templates/lxc-manager/staging-script:44–80`). So open an ops branch named
like your grapher branch to exercise PR 1 and PR 2 together on one staging build
before either merges.

## PR 1 — ops: stop invoking the suite

Repo: `owid/ops`. File: `templates/owid-site-staging/svg-tester.sh`.

Remove every explorers arm:

- `run_test_suite 'explorers' '--manifest top.manifest.json'` and
  `exit_code_explorers=$?` in both the `is_on_master` and
  `should_run_full_test_suite` branches (`:123`, `:136`)
- `exit_code_explorers=0` in the else branch (`:144`)
- `create_report 'explorers'` (`:157`)
- `commit_differences 'explorers'` (`:166`)
- `log_differences 'explorers'` (`:175`)
- the `exit_code_explorers` clause in the exit-code chain (`:191–192`)

Note for the reviewer: this is the only suite that passes `--manifest`, so its
removal is also the last user of that argument in ops.

Verify: open the PR, confirm a grapher build's SVG tester step still runs
`graphers` and the other three suites and stays green.

## PR 2 — owid-grapher: remove the suite

Repo: `owid-grapher`. Depends on PR 1 being merged to ops `main`.

**`devTools/svgTester/utils.ts`** — delete these functions. All of them are
reachable only from the two explorer render entry points; I checked each caller.

| Lines          | Symbol                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 884–904        | `getExplorerType`                                                                                                                                                                                                                                                                                                                                                                                                    |
| 906–946        | `loadInputTableForConfig` (called only at `:1155`, `:1274`)                                                                                                                                                                                                                                                                                                                                                          |
| 947–970        | `loadPartialGrapherConfigs` (called only at `:1141`, `:1259`)                                                                                                                                                                                                                                                                                                                                                        |
| 971–989        | `patchExplorerTableLoader`                                                                                                                                                                                                                                                                                                                                                                                           |
| 990–995        | `ExplorerViewManifest`                                                                                                                                                                                                                                                                                                                                                                                               |
| 1001–1012      | `loadViewsManifest` (called only at `:1108`)                                                                                                                                                                                                                                                                                                                                                                         |
| 1101–1115      | `getChoicesToTest`                                                                                                                                                                                                                                                                                                                                                                                                   |
| 1116–1218      | `renderExplorerViewsToSVGsAndSave`                                                                                                                                                                                                                                                                                                                                                                                   |
| 1219–1401      | `renderAndVerifyExplorerViews`                                                                                                                                                                                                                                                                                                                                                                                       |
| 1402–end of fn | `savePartialGrapherConfigs` (called only from the `ExplorerType.Indicator` branch at `dump-data.ts:280`)                                                                                                                                                                                                                                                                                                             |
| 136–159        | `withTimeout` — sole call site was `:1328`, inside `renderAndVerifyExplorerViews`. It existed because one `pool.exec` handled a whole explorer (many views), so workerpool's job-level `.timeout()` couldn't distinguish a wedged view from a legitimately large explorer. The grapher suites are one render per job and stay bounded by `.timeout(JOB_TIMEOUT_MS)` at `verify-graphs.ts:128`, so nothing regresses. |

Keep, despite sitting in the middle of that range: `GrapherViewsManifest`
(`:996`), `loadManifestFromPath` (`:1013`), `loadManifestViewIds` (`:1025`) —
all used by the grapher suites.

Then: drop `"explorers"` from `TEST_SUITES` (`:71`), update
`TEST_SUITE_DESCRIPTION` (`:77`), and remove the now-unused imports —
`ExplorerType` (`:2`), `PromiseCache` (`:21`), and the whole
`@ourworldindata/explorer` import block (`:56–62`).

**`devTools/svgTester/dump-data.ts`** — remove `allocateViewCount` (`:138–159`)
and `selectViewsToTest` (`:161–187`), both called only from inside
`dumpExplorerWithData`, plus `writeManifestFile` (`:189–211`),
`dumpExplorerWithData` (`:213–330`),
`saveExplorerConfigAndData` (`:332–397`), the `.with("explorers", …)` match arm
(`:496–535`), the `targetViews` option (`:565–570`, explorers-only by its own
description), and the imports at `:16`, `:22`, `:30`, `:35`, `:36`. Note this
also drops the tester's undeclared dependencies on `explorerAdminServer` and
`db/model/ExplorerCatalogResolver`.

**`devTools/svgTester/verify-graphs.ts`** — remove `verifyExplorers`
(`:16–115`) and its `.with("explorers", …)` arm (`:265`).

**`devTools/svgTester/export-graphs.ts`** — remove `exportExplorers`
(`:148–199`) and its match arm (`:209`).

**`devTools/svgTester/worker.ts`** — remove the
`renderExplorerViewsToSVGsAndSave` and `renderAndVerifyExplorerViews` exports
(`:12–13`).

**`devTools/svgTester/create-compare-view.ts`** — remove the `isExplorer`
branching (`:24–30`); `compareChartUrl` and `liveChartUrl` become unconditional
`/grapher` URLs.

**`Makefile`** — remove `svgtest.explorers` from `.PHONY` (`:37`), its help line
(`:58`), the explorers block in `svgtest.full` (`:409–411`), and the
`svgtest.explorers` target (`:431–436`).

**`devTools/svgTester/refresh.sh`** — remove `explorers` from the suite list
(`:55`). Nothing more: an earlier draft of this plan had the script prune suite
directories it doesn't recognise, so that PR 4 could be a plain refresh. Dropped
deliberately — a one-off `rm -rf` in PR 4 is clearer than a
destructive-by-default loop in a script that runs against a 14 GB repo.

**`devTools/svgTester/readme.md`** — remove the explorers bullet from the suite
overview, the "Explorers" dump section, and the explorer mentions in the
convenience-command and refresh sections (15 occurrences).

Verify:

```bash
yarn typecheck                     # noUnusedLocals is on, so orphaned imports/locals fail here
yarn testLintChanged && yarn fixFormatChanged
yarn test run --reporter dot
make svgtest                       # graphers suite still green end to end
yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts explorers
                                   # should now fail with a yargs "Invalid values" error
```

`noUnusedLocals: true` in `devTools/tsconfigs/tsconfig.base.json` is the useful
guardrail here — if the deletion leaves a dangling import or local, `yarn
typecheck` catches it rather than shipping dead code. It earned its keep: the
first draft of this list missed `withTimeout`, `allocateViewCount` and
`selectViewsToTest`, plus orphaned imports (`queryParamsToStr`,
`DEFAULT_GRAPHER_WIDTH`/`HEIGHT`, `lodash-es`, `GrapherGrammar`, `knexRaw`,
`parseChartConfig`, …). Delete the functions first, then let `tsc` enumerate the
orphans rather than trying to trace them all by hand.

## PR 3 — etl: drop the owidbot line

Repo: `owid/etl`. File: `apps/owidbot/grapher.py`.

Remove `"explorers"` from `svg_tester_dirs` (`:10`), the `svg_tester_explorers`
assignment (`:18`), and the "Number of differences (explorers)" line in
`svg_tester_block` (`:32`).

Safe at any point after PR 1: until this merges, owidbot reports "no results" for
explorers, which is accurate. Remember that owidbot reaches a container only if
the container was created after this merges (`init.sh:117` clones etl at master
and the grapher pipeline never pulls it), so expect the old line to linger on
pre-existing staging containers until they are pruned.

## PR 4 — owid-grapher-svgs: refresh, which drops explorers as a side effect

Repo: `owid-grapher-svgs`. No CI; commits land on master directly. Depends on
PR 2 being merged, so the refresh runs with explorers already gone from the
script and from `TEST_SUITES`.

Fold the explorers removal into the reference refresh that's due anyway, rather
than making it a standalone destructive commit:

```bash
rm -rf ../owid-grapher-svgs/explorers   # one-off; refresh.sh only touches known suites
make refresh.full                       # fresh production data in the local DB
./devTools/svgTester/refresh.sh         # re-dumps and re-renders the four remaining suites
```

Doing it as part of a refresh (rather than a bare `git rm`) means the references
end up generated by post-Phase-0 code instead of a stale set carried forward, and
there's one obvious commit sequence instead of a deletion plus an eventual
refresh.

Two things to be aware of before pressing go:

- **It folds in data changes.** Refreshed references reflect the current
  production snapshot, so the next SVG tester run on every open PR will show
  data-driven differences mixed in with code-driven ones. That's the normal cost
  of a refresh; run it when few viz PRs are in flight, and say so in the commit.
- **It doesn't shrink the pack.** Removing `explorers/` takes 3.1 GB off the
  working tree, so new `--depth=1` container clones (`init.sh:125`) fetch and
  check out less — but those blobs stay reachable from history, and the refresh
  itself adds a fresh ~800 MB of reference blobs. Pack size is addressed in
  Phase 3 item 18 (prune the ~900 stale branches, then `git gc`), and even that
  leaves the old explorers blobs in master history absent a rewrite, which isn't
  planned.

Optional, and the cheapest moment to do it: while `refresh.sh` is being touched
anyway, have it write the `refs.json` provenance file (grapher commit, DB
snapshot date, refresh date) that Phase 3 item 17 wants. Skip if you'd rather
keep this PR narrow.

## Landing order

```
PR 1 (ops)  →  PR 2 (owid-grapher)  →  PR 4 (owid-grapher-svgs)
                                    ↘  PR 3 (etl, any time after PR 1)
```

## Rollback

PR 1 and PR 3 are trivially revertable. PR 2 is a pure deletion, so reverting
restores the suite — but only usefully if PR 4 hasn't landed, since the suite
needs `explorers/data` to exist. After PR 4, recovering explorers means reverting
the refresh commit in the svgs repo (the blobs are still reachable in history)
and then re-running `dump-data.ts explorers` against a current DB. Treat PR 4 as
the point of no easy return.
