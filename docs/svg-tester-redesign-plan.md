# Plan: SVG tester redesign

_Status: proposal, not yet implemented. Covers `devTools/svgTester/`, the
`svg-tester.sh` step in `owid/ops`, the `owid-grapher-svgs` repo, and the
`grapher` service in `owid/etl`'s owidbot._

## Problem

The renderer is fine. Everything around it is doing a job it shouldn't.

Today a push to a branch triggers the `SVG tester` Buildkite step, which SSHes
into the PR's staging container, runs `verify-graphs.ts` for one or more suites,
commits the changed SVGs plus an HTML report into a branch of
`owid-grapher-svgs`, force-pushes it, and leaves log files on disk for a second
owidbot run to turn into a PR comment. Concretely, what goes wrong:

**1. Git is used as artifact store, transport, and diff engine at once.**
`owid-grapher-svgs` is a 5.11 GiB pack / 14 GB checkout with ~919 remote
branches, none ever deleted. The average reference SVG is ~133 KB, and
`create_report` (`ops/templates/owid-site-staging/svg-tester.sh:51`) commits
`differences/` _plus_ a duplicated copy of the same charts in `originals/`;
`commit_differences` (`:67`) then copies differences over `references/`. A
500-difference run force-pushes on the order of 130 MB of permanent blobs to a
ref that lives forever. Every staging container clones this repo
(`init.sh:125`); `--depth=1` mitigates but doesn't fix.

**2. Status is inferred, not reported.** owidbot derives the difference count
from `wc -l verify-graphs.log` (`etl/apps/owidbot/grapher.py:91`) and
distinguishes "skipped" from "error" by file existence (`:76`). Error lines in
the log get counted as differences. Every mutating step in `svg-tester.sh` ends
in `|| :`, so a suite that crashes after rendering can present as "✅ 0
differences".

**3. Cross-repo, cross-step filesystem coupling.** The `Owidbot - update after
SVG tester` step reads log files off the staging container's disk. If the
container is recycled, the step is cancelled, or the ordering changes, the PR
comment silently lies rather than erroring.

**4. Report delivery has three independent points of failure.** Commit →
`git push --force` to a second repo → `rawcdn.githack.com` serving a blob from
that commit (`grapher.py:117`). All three must succeed for a link to exist, and
the link rots when the branch goes.

**5. "Differences found" means two different things depending on a label.**
`verify-graphs.ts` exits non-zero for differences, so the step would go red;
`svg-tester.sh:197` then converts that to exit 24 on `staging-viz` PRs, which
`automated_staging_environment.yml:95` declares as `soft_fail`. So the identical
underlying fact — N charts render differently — shows up red on an unlabelled PR
and yellow on a labelled one, and a render _crash_ is indistinguishable from
both. Three mechanisms (exit code, `soft_fail`, label) encode one bit.

**6. One of the five suites is for a feature being retired.** Explorers are
being dropped from the codebase, but the explorers suite is ~207 explorer
mentions across `devTools/svgTester/` (concentrated in `dump-data.ts` and
`utils.ts`), an entire second render path (`verifyExplorers` /
`renderAndVerifyExplorerViews`, which needs its own per-view timeout handling
because a suite entry expands to many views), the only suite needing the
`--manifest top.manifest.json` special case, and 3.1 GB of the svgs repo.

**7. Suite selection is one boolean, and for some authors it's always true.**
`.github/workflows/project-automations.yml:45` auto-labels one author's PRs
`staging-viz`, so `should_run_full_test_suite` always fires: five suites,
serially, in a single Buildkite step with `concurrency: 1` per branch. The
outer step timeout is 60 min but the inner per-suite timeout is 7200 s — the
outer kill wins, and _all_ results are lost, including suites that already
finished.

**8. It runs in the wrong place.** `verify-graphs.ts` needs no database (the
readme is explicit). It runs on the per-PR staging container over SSH via
`as_owid` purely by convention, and that is the origin of the orphan-process
bug that `kill_stale_runs` exists to paper over: no PTY → no SIGHUP → the node
process is reparented to pid 1 and can run for weeks.

**9. master silently absorbs regressions.** Differences on master become the
new references with no durable report anywhere.

## Design A: from scratch

Keep the renderer, replace the plumbing. The core loop — render SVG strings in
a workerpool, md5, compare against a committed reference — is the crown jewel:
~4.4k charts in minutes, deterministic, and it yields **text** diffs that no
pixel-based tool can give. Nothing below touches it.

**Four suites, not five:** `graphers`, `grapher-views`, `mdims`, `thumbnails`.
The explorers suite is deleted first (see P0 item 0) — explorers are leaving the
codebase, and carrying a second render path through a rewrite for a feature
being retired is pure cost.

**Compute stays on a warm machine, but not the PR's staging container.** The
working set is 3.8 GB of dumped data plus 595 MB of references for `graphers`
alone. Pulling that into a GitHub Actions runner per suite is 45+ s/GB and
bumps the 10 GB cache ceiling, so ephemeral runners are the wrong call despite
being architecturally cleaner. One long-lived `svgtester` agent with a warm
checkout, taking jobs off a queue, is the right shape: no per-container clone,
no coupling to staging lifecycle, no SSH-without-PTY.

**References stay in git.** They are reviewed expected values; history and
`git diff` on master are genuinely useful. Add a `refs.json` recording which
grapher commit and DB snapshot date they came from, so staleness is visible.

**Results go to R2, never git.** Tooling already exists
(`devTools/syncGraphersToR2`, `.github/workflows/sync-grapher-schema-to-r2.yml`).

### What lives where

The dividing line is one invariant: **git holds expected state, R2 holds
observed state.** Git has few writers, a monthly cadence, and every write is
reviewable. R2 has one writer per run, entries expire, and nothing there is ever
reviewed. Corollary worth stating explicitly: nothing in R2 is needed to
reproduce a run — given the svgs commit and a grapher commit you can always
re-derive it, which is what makes an aggressive expiry policy safe.

`owid-grapher-svgs` (git) keeps, unchanged from today:

```
{suite}/data/**                # dumped inputs: config.json, {varId}.data.json,
                               # {varId}.metadata.json, config.tsv, *.csv  (3.8 GB for graphers)
{suite}/references/**          # expected SVGs (595 MB for graphers)
{suite}/references/results.csv # the md5 index
{suite}/top.manifest.json      # which charts a suite covers
refs.json                      # NEW: provenance — grapher commit, DB snapshot date, refresh date
```

Written only by (a) the monthly refresh job and (b) master absorbing
differences as new references. Nothing else ever commits here — which is the
whole point.

R2 keeps three things, with deliberately different lifetimes:

```
svgtester/refs/{svgsCommit}/{suite}/{name}.svg   # the "before" set: ~800 MB per generation,
                                                 # written monthly by refresh, keep 2 generations
svgtester/blobs/{md5}.svg                        # every changed rendering, content-addressed,
                                                 # deduplicated across runs and branches, 90-day TTL
svgtester/runs/{branch|master}/{grapherCommit}/{suite}/results.json
                                                 # the only per-run object. Tiny. 30 days / 1 year
```

The `refs/` prefix looks like a git duplicate and needs justifying. The viewer
is served over HTTP, so it needs the "before" SVG over HTTP too. Three options:
mirror the reference set to R2 (~800 MB across the four remaining suites, once
per refresh); load "before" from GitHub raw or githack at the pinned svgs
commit; or have each run upload both before and after. The second reintroduces
exactly the CDN dependency we're removing, and the third is today's `originals/`
duplication relocated. So: mirror, keyed by svgs commit, written by the refresh
job. Git stays authoritative; the mirror is derived and disposable.

**Changed SVGs are content-addressed, not run-scoped.** `verify-graphs.ts`
already computes an md5 for every SVG it renders, so storing them at
`blobs/{md5}.svg` and referencing md5s from `results.json` is free. It matters a
lot: pushing a lint fix to a viz branch re-renders the same 4,460 differing
charts byte-for-byte, and under run-scoped keys that's a second full copy. Under
content addressing it's zero new objects. Two PRs making the same change share
blobs too. Growth then scales with **distinct renderings in flight**, not
pushes × charts.

**No `.diff.txt`.** The viewer has both SVGs and `jsdiff` runs in the browser, so
it computes the unified diff client-side. That removes an artifact class roughly
as large as the SVGs themselves for zero loss.

The dumped data never goes to R2 at all; only the tester machine needs it.

### Storage growth and self-cleaning

The concern is real and expiry has to be designed in, not bolted on. The
reference set is 6,461 files / 803 MB across the four suites (graphers 4,460 /
595 MB, grapher-views 1,056 / 109 MB, mdims 810 / 87 MB, thumbnails 135 / 12 MB),
averaging ~127 KB per SVG.

The pathological case is a font-metric or layout change where every chart
differs: one push writes 803 MB across 6,461 objects. Ten pushes on that branch,
under naive run-scoped keys, is 8 GB and 65k write operations — and with no
expiry a year of that is comfortably 500 GB–1 TB.

At R2 list prices (~$0.015/GB-month storage, ~$4.50/million class-A writes;
worth re-checking) even 1 TB is ~$15/month, so **money is not the constraint —
hygiene is.** An unbounded bucket is a thing nobody can reason about, and write
operations can quietly out-cost storage. Four levers, in the order they matter:

1. **Content addressing** (above) collapses the ten-push example from 8 GB to
   803 MB, and the write count with it. Biggest win, and free.
2. **Server-side lifecycle rules**, not a cleanup script: `runs/` branch prefix
   30 days, `runs/master/` one year (master runs are the regression-archaeology
   record and there are only a few a day), `blobs/` 90 days. Lifecycle rules
   can't silently stop running, which a cron script can.
3. **A visible per-run cap.** If a suite produces more than ~2,000 differences,
   the useful information is "everything changed", not the 2,000th chart. Upload
   a deterministic first N, record `truncated: true` and `totalDifferences` in
   `results.json`, and have the viewer say so plainly. Bounds the worst case
   hard; the cap must never be silent.
4. **Steady state**, with all of the above: two reference generations (~1.6 GB)
   plus a few GB of blobs plus megabytes of `results.json` — call it **3–5 GB**,
   i.e. cents per month, versus a 5.11 GiB git pack that grows forever and can't
   be pruned without rewriting history.

Because blobs and runs expire on independent clocks, a young run can reference a
blob that is about to expire (identical rendering first seen 89 days ago). With a
3:1 TTL ratio that's rare, and the viewer should handle it gracefully — "this
rendering has expired, re-run the suite" — rather than us building a garbage
collector up front. If it turns out to be annoying, the fix is a scheduled
mark-and-sweep: list `results.json` under `runs/`, collect referenced md5s,
delete unreferenced blobs older than N days. Perhaps 50 lines. Don't write it
until the graceful-miss path proves inadequate.

**`results.json` is the contract.** Per suite:
`{suite, status: running|ok|differences|error, counts, differences[], errors[], durationMs, grapherCommit, svgsCommit}`.
`running` is written before the first render and overwritten at the end, so a file
stuck in that state marks a run that was killed rather than one that was never
started; a timeout is an error `kind`, not a status.
Written by `verify-graphs.ts`, uploaded with the artifacts. Nothing greps logs
or stats files again.

**Status surfaces as a GitHub check run per suite**, posted by the tester
itself — the component that actually knows the outcome. owidbot already has the
helper (`etl/apps/owidbot/chart_diff.py:39`, `create_check_run`). Conclusion is
`neutral`/`success`, never `failure`, for differences; title
`"142 charts changed"`; `details_url` → the report. This is the chart-diff
ergonomics we want, as a first-class PR element rather than a comment
appendix, and it deletes the second owidbot run and its filesystem coupling.

**Exit code means one thing:** 0 for differences, non-zero only for render
errors, missing references, or timeout.

This is the substantive change behind "no `soft_fail`", and it's worth being
precise about, because soft-failing labelled PRs is not the thing being objected
to. Today, red/yellow/green encodes _both_ "did the tester work?" and "did
anything change?", and the label picks which meaning applies. In the target
state those are two separate signals: the **step status** answers "did the
tester work?" (green unless something actually malfunctioned) and the **check
run** answers "what changed?" (`"142 charts changed"`, with a link). Once
differences exit 0, there is nothing left to soften — `soft_fail` isn't removed
as a policy decision, it just has no failure to catch. And with one step per
suite (P0 item 5), a `mdims` crash no longer colours the `graphers` result.

If we later decide unexpected diffs should still be loud on PRs that _don't_
expect viz changes, the lever is the check-run conclusion (`neutral` vs
`failure`), not an exit code plus a pipeline setting plus a label. Note this
inverts today's label: you'd be marking the rare PR where diffs are a red flag,
not the common one where they're expected. My guess is nobody would use it, so
start without it.

### The viewer: no more generated HTML

**`create-compare-view.ts` goes away, and with it the whole notion of a report
_artifact_.** No `differences.html` is generated per run, nothing is committed,
nothing is copied into `originals/`. A run's output is pure data: one
`results.json` plus whatever changed renderings weren't already in the blob
store.

In its place, one viewer deployed **once** at a stable URL, which takes a run
identifier and fetches that run's data:

```
https://<r2-domain>/svgtester/viewer/?run={grapherCommit}&suite=graphers
```

That URL is what the check run's `details_url` points at. One consequence worth
naming: a viewer change can now affect how an older run renders. We start
_without_ a `schemaVersion` in `results.json` — with runs expiring after 60–90
days the drift window is small, and versioning a format nothing else consumes
yet is speculative. Revisit if a viewer change ever does break an old run. In
exchange, the 800 lines of
`create-compare-view.ts` — inline CSS, hand-escaped `<script>` payloads,
string-concatenated markup — become an ordinary React component with a companion
`.scss` file, subject to the same review and lint rules as the rest of the
codebase.

**Local runs must not need R2.** The viewer reads `results.json` from whatever
origin serves it, so `make svgtest` writes results to disk and opens
`localhost:3030/admin/svgtester`, which serves them from the local svgs
checkout. Local, staging, and CI then share one viewer and one code path — today
local uses a generated file and CI uses githack.

Feature-wise it keeps what already works (side-by-side, swipe, diff2html text
diff, chart-type filter, links to live and staging) and adds only:

- Lazy-loaded SVGs over HTTP, with the unified diff computed in the browser from
  the two fetched SVGs. Today every diff is inlined at generation time, so a
  500-difference report is enormous.
- A graceful "this rendering has expired" state for blobs that have aged out.
- Sort by magnitude, so the two charts that actually broke aren't buried under
  400 cosmetic ones.
- Per-item deep links (`#slug`) so a single diff can be shared in review.

Diff grouping and pixel-diff views are deliberately out of scope — see
[Future improvements](#future-improvements).

### The interface: a dedicated page, chart-diff style

chart-diff is a live server-side app: a Streamlit process under pm2 on port
8053, proxied at `/etl/wizard/chart-diff` (`owid.cloud:27`), reading two MySQL
databases and recomputing on demand. It needs no artifact plumbing at all
because it derives everything live, and it can offer interactive controls and
per-chart state.

The SVG tester should get the equivalent, because it solves the suite-selection
problem far better than CI-side mechanisms do: a page listing every suite with
its status and last-run time, and a **Run** button per suite. That is the
"choose which suites to run, on demand" requirement, with no labels to
remember, no Buildkite block step, and no push needed to re-trigger.

**Where it lives: the admin, not a new service.** `adminSiteServer` is already
running on 3030 on every staging container, already proxied through nginx
(`owid.cloud:74`), already React with auth. An `/admin/svgtester` page plus two
or three API routes — list status from `results.json`, kick off a run, stream
progress — is dramatically less new infrastructure than another pm2 process,
and admin auth comes free, which matters when an endpoint can spawn an hour-long
job. Guardrails: one run per suite per container behind a lock file, button
disabled while running, hard timeout, and the run must have no ability to write
to git.

**The hybrid, and the one constraint that matters.** Neither trigger alone is
enough: a page on staging dies with the container, so it can't be the durable
record for master runs or for a PR someone revisits next month; and CI alone
can't offer a button. So:

- push-triggered `graphers` run in CI → `results.json` + artifacts to R2 →
  check run. Automatic and durable.
- `/admin/svgtester` on staging reads the same `results.json` for the current
  commit and can trigger any suite on demand, publishing to R2 exactly as CI
  does when it finishes. Same code path, two triggers.

The constraint: **the diff browser is one React component rendered from
`results.json`, used by both the static R2 bundle and the admin page.** Build
the viewer once. If this splits into two viewers, the design has failed — that
duplication is how `create-compare-view.ts` ended up as an 800-line file
generating inline CSS and hand-escaped `<script>` payloads.

**Reference refresh becomes a scheduled monthly job**, not `refresh.sh` when
someone remembers. On master, keep auto-committing new references but publish a
durable report and post the summary to Slack, so silent absorption becomes
reviewable after the fact.

### Third-party tools: evaluated, not recommended

- **Playwright `toHaveScreenshot`** — free side-by-side/diff report and
  `--update-snapshots`, but forces browser rendering (much slower over 4.4k
  charts), gives flaky cross-platform pixel diffs, and throws away the text
  diff. Its real strength is interaction coverage, which is what the BDD suite
  is for.
- **Argos CI / Chromatic / Percy / Lost Pixel** — would provide the review UI,
  GitHub check, and per-build history for free, and Argos accepts arbitrary
  image uploads (not Playwright-locked). But 4.4k images on every push is well
  past free tiers and real money at scale; a rasterization step is required;
  and they are image-only, so the SVG text diff is gone. Their grouping is
  per-image, not per-cause, so the biggest win above isn't even available.
- **reg-suit** — closest self-hosted analogue (S3 + GitHub notifier), could
  shortcut the artifact/notify layer, but image-only again, and we'd fight it to
  carry SVG text diffs.
- **odiff / pixelmatch** — worth pulling in as a _library_ if we add the
  pixel-diff view. Not as a framework.

The one thing worth stealing is their model: **a build is one durable URL plus a
GitHub check.** That is cheap to build ourselves on R2 and is most of why
chart-diff feels good.

## Design B: incremental path

Every step is independently shippable, ordered by value per unit of effort. B
converges on A. This section is the _what_ and its priority; the concrete
per-repo PR sequencing is in [Implementation plan](#implementation-plan) below,
where P0 maps to Phases 0–2, P1 to Phase 3, and P2 to Phase 4.

### P0 — days; removes most of the flakiness

0. **Delete the explorers suite.** Explorers are being removed from the codebase,
   so this is work that would otherwise be done twice. Removes the
   `verifyExplorers` / `renderAndVerifyExplorerViews` render path, the explorer
   branches in `dump-data.ts` and `utils.ts`, the catalog-path-to-indicator-id
   resolution and CSV download logic, the `--manifest top.manifest.json` special
   case in `svg-tester.sh:123`, the `svgtest.explorers` Makefile target, the
   explorers arm in `refresh.sh`, and the explorers line in
   `etl/apps/owidbot/grapher.py`. Then `git rm -r explorers/` in
   `owid-grapher-svgs` — 3.1 GB of the 14 GB checkout. Doing this first means one
   render path, not two, through everything below.
1. Have `verify-graphs.ts` write `results.json`; make owidbot read only that
   (`etl/apps/owidbot/grapher.py`). Kills `wc -l` and the file-existence
   heuristic.
2. Drop the `|| :` swallowing in `svg-tester.sh`; make differences exit 0 and
   reserve non-zero for malfunction. Exit 24 and `soft_fail` then have nothing
   left to catch and can go.
3. Stop committing `originals/` — the report can point at `references/` at the
   master commit in the same tree. Halves per-run blob churn for one small
   change to `create_report`.
4. Serve the report from staging nginx
   (`location /svgtester/ { alias /home/owid/owid-grapher-svgs/; }` in
   `ops/templates/owid-site-staging/owid.cloud`) instead of githack. Roughly a
   one-line change; removes two of the three link failure points and puts the
   report on the host the reviewer is already looking at.
5. **Split the Buildkite step into one step per suite.** Parallel, own timeout,
   own status, own report. Fixes the 60 min vs 7200 s mismatch and the
   all-or-nothing result loss. Biggest single latency win.

### P1 — weeks

6. On-demand suite selection (see below).
7. Upload artifacts to R2; stop pushing to branches entirely; then prune the
   ~900 stale branches and `git gc` the svgs repo. Reclaims most of the 5 GB
   pack.
8. Check run per suite via the existing owidbot helper, with `details_url`
   pointing at the report.

### P2

9. Replace `create-compare-view.ts` with the data-driven viewer at a stable URL,
   used by both R2 and the admin page.
10. The `/admin/svgtester` page: suite statuses plus a Run button per suite,
    rendering the same viewer component. Retires the block step from item 6.
11. Path-scoped default suites: infer from the diff (mdim code → mdims,
    thumbnail and baking code → thumbnails, axis/faceting code →
    grapher-views), so choosing is usually unnecessary.
12. Scheduled reference refresh.

## Implementation plan

### Deployment mechanics that constrain the ordering

Four repos are involved — `owid-grapher` (**G**), `ops` (**O**), `etl` (**E**),
`owid-grapher-svgs` (**S**) — and they reach production by three different
routes. Getting this wrong is how you break every open PR at once.

- **G** — staging containers build the PR branch, so grapher-side changes are
  testable on the PR itself. Easy.
- **O, scripts under `templates/owid-site-staging/`** — `staging-script` clones
  **the ops branch whose name matches the grapher branch**, falling back to
  `main` (`templates/lxc-manager/staging-script:44–80`). So `svg-tester.sh`
  changes are testable by opening an ops branch with the same name as your
  grapher branch. Also: once merged to `main`, they apply to **every** open
  grapher PR immediately.
- **O, `automated_staging_environment.yml`** — the pipeline is bootstrapped by a
  step in the Buildkite UI that clones ops at `--depth 1` on the default branch
  and runs `pipeline upload` (`README.md:286`). Pipeline changes therefore take
  effect from ops `main` only and **cannot** be tested from a branch the way
  scripts can. To test, temporarily point the bootstrap clone at your ops branch
  in the Buildkite UI.
- **E** — owidbot runs from `~/etl` on the staging container, cloned at master
  when the container was created (`init.sh:117`, `clone_repo` with no branch) and
  never pulled by the grapher pipeline. So an owidbot change only reaches
  containers created **after** it merges, and old and new containers coexist
  until pruning catches up. We accept the resulting window of wrong PR comments on
  stale staging sites rather than carrying dual-read compatibility paths: this is
  an internal tool, and old containers get recreated soon enough.
- **S** — no CI; direct commits to master. The destructive steps are one-off
  maintenance tasks, not PRs.

### Phase 0 — delete the explorers suite

**Why:** explorers are leaving the codebase, so every later phase would otherwise
be done twice — once for the grapher render path and once for a suite that is
about to be deleted anyway. Four small PRs remove the suite from the tester, the
CI script, the PR comment, and the svgs repo, leaving one render path instead of
two. Execution detail, with the exact symbols and line ranges to delete, is in
[svg-tester-phase-0-plan.md](./svg-tester-phase-0-plan.md).

Order matters here: ops must go first. If G stops accepting `explorers` while
ops `main` still calls `run_test_suite 'explorers'`, yargs rejects the choice,
the suite exits non-zero, and (since `set +e` is active) `exit_code_explorers`
turns the step red on every open PR. The reverse is harmless — ops simply stops
invoking code that still exists.

| # | Repo | Change | Depends on |
| --- | --- | --- | --- |
| 1 | O | Drop the explorers arm from `svg-tester.sh`: `run_test_suite 'explorers' '--manifest top.manifest.json'`, and the `create_report` / `commit_differences` / `log_differences` / `exit_code_explorers` lines. | — |
| 2 | G | Remove the suite: `verifyExplorers` and its `match` arm, `renderAndVerifyExplorerViews`, the explorer branches in `dump-data.ts` and `utils.ts` (catalog-path resolution, CSV download, URL rewriting), `TEST_SUITES`, `worker.ts` export, the `svgtest.explorers` and `svgtest.full` Makefile targets, the explorers arm of `refresh.sh`, and the readme sections. Verify with `yarn typecheck` and a `make svgtest` run. | 1 |
| 3 | E | Drop the explorers line from `apps/owidbot/grapher.py`. Safe any time after 1 — until then it reports `_skipped_`, which is correct. | 1 |
| 4 | S | `rm -rf explorers/`, then run the due reference refresh (`make refresh.full` then `refresh.sh`) so the four remaining suites are regenerated with post-Phase-0 code. 3.1 GB off the working tree, so new `--depth=1` container clones fetch less; the pack is unchanged, since those blobs stay reachable from history. | 2 |

### Phase 1 — the status contract

**Why:** today nobody can tell "no differences" from "the suite crashed", because
the outcome is reconstructed downstream by counting log lines and testing whether
files exist. These PRs make the tester state what happened in a `results.json`
that owidbot reads directly, and separate "charts changed" from "the tester
broke" in the exit code so red means red. Execution detail in
[svg-tester-phase-1-plan.md](./svg-tester-phase-1-plan.md).

| # | Repo | Change | Depends on |
| --- | --- | --- | --- |
| 5 | G | `verify-graphs.ts` writes `verify-results.json` alongside the existing stdout/log output. Purely additive — nothing consumes it yet, nothing breaks. | — |
| 6 | E | owidbot reads `results.json` and the log-parsing path is deleted — no fallback. Containers older than the merge report "not run" until recreated; accepted. | 5 |
| 7 | G | Differences exit 0; non-zero reserved for render errors, missing references, timeout. | 5 |
| 8 | O | Delete exit 24 and the `soft_fail` clause; remove the `\|\| :` swallowing so mutating steps can actually fail. **Must follow 7** — dropping `soft_fail` while G still exits 24 turns every viz PR red. | 7 |
| 9 | O | Remove the `\|\| true` around the owidbot call in `owidbot.sh` so owidbot failures stop being invisible. Independent and tiny. | — |

### Phase 2 — kill the git-as-transport path

**Why:** getting a report link currently requires a commit, a force-push to a
second repo, and a CDN caching a blob from that commit — three things that must
all succeed, for a link that rots when the branch goes. These PRs serve the
report from the staging host the reviewer is already on, stop committing
per-run artifacts, and split the monolithic CI step so one slow suite can no
longer discard the results of the others.

| # | Repo | Change | Depends on |
| --- | --- | --- | --- |
| 10 | O | Add `location /svgtester/ { alias /home/owid/owid-grapher-svgs/; }` to `owid.cloud`, and point `create_report`'s output at it. | — |
| 11 | E | Switch the report link in `grapher.py` from `rawcdn.githack.com` to the staging URL. No fallback — a stale container just links to the old place until recreated. | 10 |
| 12 | O | Stop `commit_differences` on branches (keep it on master, which legitimately absorbs new references), then pass `-r references` to `create-compare-view.ts` and delete the `originals/` copy. **Depends on 10**: `originals/` exists precisely because `commit_differences` overwrites `references/` after the report is generated, so the report must stop depending on the `compare/{branch}` URL first. | 10 |
| 13 | O | Split the Buildkite step into one step per suite, each with its own timeout, status, and report. Reconcile the 60 min step timeout with the 7200 s inner one. **Do not call `reset_to_master` per step** — see below. Pipeline-only change: test via the bootstrap override above. | 8 |

⚠️ **The per-step reset is a trap.** `reset_to_master` runs
`git clean -fdx` over the whole svgs checkout, which today is safe because one
reset precedes all suites in a single step. Give each suite its own step that
resets, and step B wipes step A's `verify-results.json` and `differences/` while
A is still running — non-deterministically, in parallel, with no error. Either
reset exactly once in a preceding step that the suite steps depend on, or stop
keeping per-run state in a shared checkout at all, which is what item 14 does by
uploading to R2. The second is the real fix; the first is the stopgap if items
13 and 14 don't land together.

Optional stopgap (O, after 13): a Buildkite `block` step with a multi-select
field, plus `buildkite-agent meta-data get svg-suites` in `svg-tester.sh`, gives
per-suite on-demand selection until item 21 lands. Set `blocked_state: passed`.
Skip it if Phase 4 is close — it's throwaway work.

### Phase 3 — R2 and check runs

**Why:** artifacts stored in git are permanent, and the ~900 never-deleted
branches in a 5.11 GiB pack are the bill for that. These PRs move per-run output
to content-addressed, expiring R2 objects and surface each suite as its own
GitHub check run — which is what finally makes the svgs repo prunable and the PR
status honest. The largest phase, and where most of the work is.

| # | Repo | Change | Depends on |
| --- | --- | --- | --- |
| 14 | G | Upload script following the `devTools/syncGraphersToR2` pattern: changed SVGs to `blobs/{md5}.svg` (skip the put if the object already exists), `results.json` to `runs/{branch\|master}/{grapherCommit}/{suite}/`. Includes the visible per-run cap (`truncated`, `totalDifferences`). | 5 |
| 15 | O | Wire the upload into `svg-tester.sh`; add R2 credentials to `grapher-env.secret`. | 14 |
| 16 | E | Post a check run per suite (`create_check_run`, already used by chart-diff) with `details_url` → the report. Conclusion never `failure` for differences. | 6, 15 |
| 17 | O | Mirror `references/` to `svgtester/refs/{svgsCommit}/` in the refresh job, pruning all but the last two generations. Configure the lifecycle rules: `runs/` branch 30 days, `runs/master/` 1 year, `blobs/` 90 days. | 15 |
| 18 | S | Stop pushing branches entirely; prune the ~900 stale branches; `git gc`. Reclaims most of the 5.11 GiB pack. | 15, 16 |

Decision point at 16: owidbot already has GitHub App auth, so posting from E is cheapest. The "status is reported by the component that knows it" argument favours G posting its own check run — but that means new credentials on the tester machine. Start with E; revisit only if the indirection bites.

### Phase 4 — viewer and page

**Why:** this is the payoff — one data-driven viewer replacing 800 lines of
generated HTML, reachable identically from a local run, a staging container, and
a durable R2 URL, with a Run button that makes suite selection a click instead of
a label plus a push. Everything here is optional in the sense that Phases 0–3
already leave the tester robust; Phase 4 is what makes it pleasant.

| # | Repo | Change | Depends on |
| --- | --- | --- | --- |
| 19 | G | The viewer as a React component plus `results.json` types, served read-only at `/admin/svgtester`. Works locally against the on-disk svgs checkout, so `make svgtest` opens `localhost:3030/admin/svgtester`. | 5 |
| 20 | G | Deploy the same bundle to R2 at a stable URL; repoint `details_url`; **delete `create-compare-view.ts`** and the generated-HTML path. | 19, 16 |
| 21 | G | Run button plus API routes: lock file per suite, disabled while running, hard timeout, no git write access. | 19 |
| 22 | G + O | Path-scoped default suites; retire the Buildkite block step and delete the `staging-viz` job from `.github/workflows/project-automations.yml`. | 21 |
| 23 | O | Scheduled monthly reference refresh replacing manual `refresh.sh`. | 17 |

### Landing order at a glance

```
O1 → G2 → E3 → S4          explorers gone
G5 → E6 → G7 → O8          status contract; O9 anytime
O10 → E11 → O12 → O13      report served, git transport retired
G14 → O15 → E16 → O17 → S18   R2, check runs, repo cleanup
G19 → G20 → G21 → G22 → O23   viewer, page, triggers
```

Phases 0–2 are the ones worth doing promptly; each is a handful of small,
independently revertable PRs. Phase 3 is where the real work is. Phase 4 is the
payoff and can wait.

## Future improvements

Explicitly deferred. Each is worth doing eventually, none is needed to make the
setup robust, and all of them are easier once `results.json` and the viewer
exist.

- **Grouping by diff signature.** Hash the normalized unified diff and group
  identical diffs, so 400 charts that changed because a tick label went 14px →
  13px collapse into one row with a count and a representative chart instead of
  400 sections to scroll. The unified diff is already computed, so the
  implementation is cheap; the design work is in choosing a normalization that
  groups the right things.
- **Overlay/blink or rasterized pixel-diff view** for sub-pixel shifts that
  swipe hides (`odiff` or `pixelmatch` as a library).
- **Mark-and-sweep blob GC**, if age-based expiry plus a graceful "expired" state
  in the viewer turns out to be too lossy in practice. See
  [Storage growth and self-cleaning](#storage-growth-and-self-cleaning).
- **Slack summary for master runs**, so silent reference absorption becomes
  reviewable after the fact.

## On-demand suite selection

`graphers` always runs on push. For the other three, in preference order:

1. **The `/admin/svgtester` page** (above) — the target state. A button per
   suite, no push required, works for suites you decide you need halfway through
   a review.
2. **Path-scoped defaults**, so the common case needs no interaction at all:
   infer suites from the diff (mdim code → mdims, thumbnail and baking code →
   thumbnails, axis/faceting code → grapher-views). Composes with the button
   rather than competing with it.
3. **A Buildkite block step with a multi-select field** — zero new
   infrastructure, works today: a `block` step with a `select` field, then
   `buildkite-agent meta-data get svg-suites` in the follow-on step. Set
   `blocked_state: passed` so a never-unblocked build doesn't hold the GitHub
   check hostage. The right stopgap for P1, before the page exists.
4. **Sticky per-suite labels** (`svgtest:mdims`, …) — a reasonable fallback if
   the page slips: labels persist across pushes, so "always run mdims on this
   PR" is expressible, which the button isn't. Cost is a GH Actions job on
   `pull_request: types: [labeled]` poking the Buildkite API.

Whichever lands, the `staging-viz` auto-label
(`.github/workflows/project-automations.yml:45`) goes away — path inference plus
an explicit trigger covers it, and we stop paying for four suites on every typo
fix.

**Comment commands** (`@owidbot svgtest mdims`) would be pleasant but owidbot is
CLI-driven with no webhook receiver; not worth standing one up for this.

## Non-scope / accepted trade-offs

- No approval step. Differences are information, not a gate; nothing needs to
  be reviewed before merge, unlike chart-diff.
- SVG-string rendering stays. We accept that it covers no interaction — that's
  the BDD suite's job — in exchange for speed and text diffs.
- References stay in git rather than moving wholesale to R2, accepting that the
  data dirs keep the svgs repo large. The growth problem is per-run artifacts,
  not the reference set.
- The explorers suite is deleted rather than migrated. We accept losing SVG
  coverage of explorers for whatever remains of their life in the codebase; the
  grapher-id-based ones were never covered anyway (they're covered by the
  graphers suite), and the indicator- and CSV-based ones are on the way out.
- Diff grouping is deferred to [Future improvements](#future-improvements).
  Reviewing a large diff stays as tedious as it is today until then; the
  robustness work doesn't depend on it.

## Recommendation

Do P0 items 1, 2, and 5 first: they are small, they are where the
"error-prone" feeling actually originates, and 5 alone noticeably shortens the
feedback loop. Then the block step as a stopgap for suite selection, then R2
plus check runs, then the data-driven viewer. The `/admin/svgtester` page is the
most attractive item on the list and the one most worth deferring: it is only
cheap once `results.json` and the viewer component exist, and building it first
means building the viewer twice.
