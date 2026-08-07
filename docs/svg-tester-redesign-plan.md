# Plan: SVG tester redesign

_Covers `devTools/svgTester/`, the `svg-tester.sh` step in `owid/ops`, the
`owid-grapher-svgs` repo, and the `grapher` service in `owid/etl`'s owidbot._

**Status: Phases 0–2 are done, and Phase 3 has begun** (owid-grapher#6909/#6911/
#6913/#6914, ops#594/#595/#596, etl#6623), except for the svgs-repo half of
Phase 0 — see there. Item 19, the viewer, is complete and merging; the rest of
Phase 3 has not started. **Next up is item 19b** — pointing owidbot's report link
at the new page — which is Stage 2's first PR and the gate on everything else in
that stage. The Problem section below describes the state this work started
from — points 2, 5 and 6 are fixed, the rest still stand.

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
both — a crashed render on a labelled PR is soft-failed and reads as ordinary
chart churn. The label policy itself is sound and stays; what has to change is
that the exit code can't distinguish "charts differ" from "the tester broke", so
the label ends up softening both.

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

Note the cost here is smaller than it looks, and smaller than earlier drafts of
this document assumed. Measured on a staging container: graphers verifies 4,460
charts in **134 s** and grapher-views 1,058 in **97 s**, so a full sweep is a few
minutes, not the tens of minutes guessed at. Running suites nobody asked for is
mild waste, and reaching the 60-minute ceiling means something is badly wrong
(a hung render, or the orphaned-process problem) rather than a suite legitimately
taking that long. So there is no wall-clock case for splitting the step; the
feedback-quality case — independent status per suite — is answered by per-suite
check runs instead (item 16). Suite selection stands on its own.

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

The measured runtimes make this decisive rather than marginal: graphers verifies
in ~134 s. Spending several minutes fetching 4.4 GB to support a two-minute run
inverts the cost of the job entirely — the data is the expensive part, so the
data should stay put and the work should come to it.

**References stay in git.** They are reviewed expected values; history and
`git diff` on master are genuinely useful. Add a `refs.json` recording which
grapher commit and DB snapshot date they came from, so staleness is visible.

**Results go to R2, never git.** Tooling already exists
(`devTools/syncGraphersToR2`, `.github/workflows/sync-grapher-schema-to-r2.yml`).

One correction to this section, found while sequencing the work: **R2 is a
durability layer, not a foundation.** Everything below describes the end state
correctly, but it reads as though the viewer, the check runs and the git cleanup
all sit on top of R2. They don't. A run's outputs are already on the staging
container's disk, and the admin server is already there to serve them, so the
viewer, the report link, the deletion of the generated HTML, the end of pushing
to svgs branches, and the check runs all land without a bucket. What R2 uniquely
buys is a report that outlives its container. It is therefore last
([Phase 4](#phase-4--r2-and-durability)) and optional.

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

**The exit code says what happened; the caller decides what it means.** Three
fixed codes from the tester — 0 clean, 2 differences, 1 the tester malfunctioned —
replacing a count that the shell masked to 8 bits.

An earlier draft of this document argued that differences should simply exit 0
and never fail a build, on the grounds that they are information rather than
failure. That was wrong, and the rule we settled on is better: **an unexpected
difference is a surprise worth stopping at.** A PR carrying `staging-viz` is
declaring that it changes charts; a PR without it is not, and 141 changed charts
there deserve a red step rather than a line in a comment nobody re-reads.

So the policy lives in `svg-tester.sh`, where the label already does:

| branch               | outcome              | step                                 |
| -------------------- | -------------------- | ------------------------------------ |
| master               | differences          | 🟢 — committed as the new references |
| PR + `staging-viz`   | differences          | 🟡 soft-fail — "charts changed here" |
| PR without the label | differences          | 🔴                                   |
| any                  | tester malfunctioned | 🔴                                   |

What the tri-state buys is the last row. Previously every non-zero exit went
through the label check, so a crashed render on a labelled PR came back
soft-failed and looked like ordinary chart churn. Separating 2 from 1 means "we
don't know whether anything changed" can never be softened by a label.

`soft_fail` survives, then — but as presentation, not as policy. It turns exit 24
into a visible "something changed here" marker, distinct from both a clean pass
and a failure. The magic number now couples exactly two things, the script and
the pipeline clause, and both sides say so.

#### The label also governs the Site screenshots step

Once the label means "this PR intentionally changes what things look like", the
neighbouring `Site screenshots diff` step should honour it too: on a labelled PR
that step must never be red (item 24).

Worth being precise about what this does, because it is not the same shape as the
table above. That step doesn't compare anything — `site-screenshots` runs
`shot-scraper multi`, which only captures, then commits `--allow-empty`, pushes,
and prints a GitHub compare link. So it is green whether or not screenshots
changed, and the only way it goes red is genuine breakage: a page timing out, a
scrape failing, a push conflicting. Soft-failing it on the label therefore
softens **breakage**, not differences — which is precisely the pattern
[Problem 5](#problem) set out to kill for the SVG tester.

That is accepted here rather than overlooked. The two cases differ in what a
failure costs: a broken SVG tester run means "we don't know whether any chart
changed", which is a real loss of information, whereas a flaked screenshot run
loses nothing the reviewer can't get from the compare link — and screenshot
scrapes flake most on exactly the PRs that are changing visuals. The trade-off is
recorded in [Non-scope](#non-scope--accepted-trade-offs).

### The viewer: no more generated HTML

**`create-compare-view.ts` goes away, and with it the whole notion of a report
_artifact_.** No `differences.html` is generated per run, nothing is committed,
nothing is copied into `originals/`. A run's output is pure data: one
`results.json` plus whatever changed renderings weren't already in the blob
store.

In its place, one viewer that takes a run identifier and fetches that run's data.
It ships first inside the admin, where the data already is:

```
http://{container}/admin/svgtester/{suite}                        # Phase 3
https://<r2-domain>/svgtester/viewer/?run={grapherCommit}&suite=  # Phase 4, if wanted
```

Same component either way — the difference is a URL resolver, not a second
viewer. That URL is what the check run's `details_url` points at. One consequence worth
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

- push-triggered `graphers` run in CI → `results.json` on disk → check run.
  Automatic. Durable once Phase 4 adds the R2 upload.
- `/admin/svgtester` on staging reads the same `results.json` for the current
  commit and can trigger any suite on demand, publishing exactly as CI does when
  it finishes. Same code path, two triggers.

Note the ordering that follows: the page is worth building _before_ durability,
not after. It needs nothing that isn't already on the container, and until it
exists there is nothing for a durable URL to point at.

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
per-repo PR sequencing is in [Implementation plan](#implementation-plan) below.

_Written before Phase 0. The priorities held up, but the grouping did not: the
viewer turned out to need nothing from R2, so P2's first two items came forward
into Phase 3 and P1's R2 work went last. The phase tables below are the current
plan; this list is kept for the value-per-effort argument._

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
4. ~~Serve the report from staging nginx
   (`location /svgtester/ { alias /home/owid/owid-grapher-svgs/; }`) instead of
   githack.~~ **Superseded** — see item 10. The instinct was right (put the
   report on the host the reviewer is already looking at) but the admin serves it
   with no nginx change at all.
5. ~~**Split the Buildkite step into one step per suite.**~~ **Dropped** — see
   item 13 in [Phase 2](#phase-2--serve-the-report-over-http). Four steps
   sharing one staging container and one svgs checkout is a shared-mutable-state
   trap, the suites are serialised by `concurrency_group` anyway, and per-suite
   check runs (item 16) deliver the independent status without it.

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
- **O, scripts under `templates/lxc-manager/`** — a third route, and the one item
  24 lands in. These run on the shared lxc-manager host rather than a staging
  container, and `init.sh` copies them there (`sync_file "$HERE/site-screenshots"
bin/site-screenshots`, `init.sh:101`). Nothing pulls them automatically: the
  host keeps whatever was last synced, so a change needs `init.sh` re-run against
  the host, and it then applies to every open grapher PR at once. Testable from a
  branch — you run `init.sh` from your own checkout — but there is no per-branch
  resolution as there is for `owid-site-staging`, so a branch's sync is visible to
  everyone until someone syncs main back.
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

**Items 1–3 are done** (ops#594, owid-grapher#6909, etl `e1b4ceb40`). **Item 4
was not** — an earlier version of this line claimed it was. Checked while testing
Phase 2: svgs `origin/master` still contained `explorers/`, there was no refresh
commit after Phase 1's `.gitignore` change, and the branch count had reached 936.
`explorers/` has since been removed (see the item 4 row). The reference refresh
turned out not to be urgent: a Phase 2 test run found the four suites rendering
identically to their references apart from the change under test, so they are
current — the refresh is periodic hygiene, not a Phase 0 dependency.

Order mattered here: ops had to go first. If G stops accepting `explorers` while
ops `main` still calls `run_test_suite 'explorers'`, yargs rejects the choice,
the suite exits non-zero, and (since `set +e` is active) `exit_code_explorers`
turns the step red on every open PR. The reverse is harmless — ops simply stops
invoking code that still exists.

| #   | Repo | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Depends on |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | O    | Drop the explorers arm from `svg-tester.sh`: `run_test_suite 'explorers' '--manifest top.manifest.json'`, and the `create_report` / `commit_differences` / `log_differences` / `exit_code_explorers` lines.                                                                                                                                                                                                                                                                                              | —          |
| 2   | G    | Remove the suite: `verifyExplorers` and its `match` arm, `renderAndVerifyExplorerViews`, the explorer branches in `dump-data.ts` and `utils.ts` (catalog-path resolution, CSV download, URL rewriting), `TEST_SUITES`, `worker.ts` export, the `svgtest.explorers` and `svgtest.full` Makefile targets, the explorers arm of `refresh.sh`, and the readme sections. Verify with `yarn typecheck` and a `make svgtest` run.                                                                               | 1          |
| 3   | E    | Drop the explorers line from `apps/owidbot/grapher.py`. Safe any time after 1 — until then it reports the suite as missing, which is correct.                                                                                                                                                                                                                                                                                                                                                            | 1          |
| 4   | S    | ~~`rm -rf explorers/`~~ **done** (svgs `e3137a4bc2`, long after the rest of the phase) — 28,640 files, 3.1 GB off the working tree, so new `--depth=1` container clones fetch less; the pack is unchanged, since those blobs stay reachable from history. The other half — the due reference refresh (`make refresh.full` then `refresh.sh`) — is **still open**, and Phase 2's testing showed it isn't a dependency: the four suites render identically to their references, so it is periodic hygiene. | 2          |

### Phase 1 — the status contract

**Why:** today nobody can tell "no differences" from "the suite crashed", because
the outcome is reconstructed downstream by counting log lines and testing whether
files exist. These PRs make the tester state what happened in a `results.json`
that owidbot reads directly, and separate "charts changed" from "the tester
broke" in the exit code so red means red. Execution detail in
[svg-tester-phase-1-plan.md](./svg-tester-phase-1-plan.md).

| #     | Repo | Change                                                                                                                                                                                                                                                                                                                    | Depends on |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 5     | G    | `verify-graphs.ts` writes `verify-results.json` alongside the existing stdout/log output. Purely additive — nothing consumes it yet, nothing breaks.                                                                                                                                                                      | —          |
| 6     | E    | owidbot reads `results.json` and the log-parsing path is deleted — no fallback. Containers older than the merge report "not run" until recreated; accepted.                                                                                                                                                               | 5          |
| 7     | G    | Three fixed exit codes — 0 clean, 2 differences, 1 malfunction — replacing the count the shell masked to 8 bits. The caller decides what a difference means.                                                                                                                                                              | 5          |
| 7b    | G    | Resync `references/results.csv`'s md5 column, which `commit_differences` leaves describing the previous references — 43% of the graphers suite was stale. Independent of the rest of the phase.                                                                                                                           | —          |
| 8     | O    | Apply the policy: master green, `staging-viz` PRs soft-fail via exit 24, unlabelled PRs red, a broken tester always red. Remove the `\|\| :` swallowing so mutating steps can actually fail; call 7b's script from `commit_differences` so the md5 index stops drifting; drop the `verify-graphs.log` redirect.           | 7, 7b      |
| ~~9~~ | O    | ~~Remove the `\|\| true` around the owidbot call in `owidbot.sh`.~~ **Dropped**: it was added deliberately (`b0f320a`) because the container-creation step invokes owidbot without a `soft_fail`, so a failure there would fail container creation. The two calls this phase cares about already soft-fail at step level. | —          |

### Phase 2 — stop duplicating the reference set

**Done** — ops#596, a single PR. Execution detail and the test evidence are in
[svg-tester-phase-2-plan.md](./svg-tester-phase-2-plan.md). One path went
untested: the master arm, whose body is unchanged apart from the deleted
`commit.log` write, so the first master run with differences after the merge is
worth a look.

**Why:** the largest write in the whole pipeline is a duplicate. `create_report`
copies every differing reference SVG into `originals/` and commits both copies —
~65 MB of redundant permanent blobs on a 500-difference run, in a pack that
cannot be pruned without rewriting history. Deleting it costs one small change,
and the same PR stops branches absorbing their own differences into
`references/`, which is the invariant every viewer downstream depends on.

**This phase used to be four items.** Two of them — the nginx alias (10) and the
githack-to-nginx link swap (11) — were a bridge to a report served over HTTP from
the staging container. Item 19 does that better and needs no nginx, so building
the bridge would mean writing two PRs and then deleting them. They are struck
through below rather than removed, so the reasoning survives.

**The dependency here is the reverse of what earlier drafts said.** `originals/`
was thought to be load-bearing until the report stopped being served from a git
commit. It is not: `create_report` runs before `commit_differences`, so the report
commit precedes the reference-overwrite commit, and the report's relative
`references/…` URLs already resolve to the correct "before" images inside the
pinned tree. `originals/` could always have gone. What genuinely requires
`commit_differences` to stop on branches is reading those images from the **live
checkout**, which is what the viewer does — so item 12 must land before item 19,
or every comparison silently shows before == after.

Two things Phase 1 leaves this phase. The `staging-viz` label now carries a
policy (which differences are a surprise), not just suite selection, so item 22's
path-based inference must not quietly become the input to that decision. And
owidbot now derives the report commit from git rather than `commit.log`
(etl#6623), so that side-channel file is dead and item 12 sweeps it.

| #      | Repo | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Depends on |
| ------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 12     | O    | One PR, two changes to `svg-tester.sh`. Delete the `originals/` copy from `create_report` and drop `-r originals`, letting `create-compare-view.ts` fall back to its `references` default — which is what `make svgtest` already uses, so CI and local stop diverging. And run `commit_differences` on master only: a branch is never merged into the svgs repo, so absorbing its differences into `references/` achieves nothing and would corrupt the viewer's "before" images. Sweeps the dead `commit.log` write while in there.                                                                                                                                   | —          |
| ~~10~~ | O    | ~~Add `location /svgtester/ { alias /home/owid/owid-grapher-svgs/; }` to `owid.cloud`.~~ **Superseded by item 19.** The admin is already proxied on staging (`location ~ ^/(admin\|gdocs)` → `:3030`), so once the viewer serves the SVGs there is no nginx change to make — and explicit routes never expose `data/**` or `.git/`, which an alias would have needed `deny` rules for.                                                                                                                                                                                                                                                                                 | —          |
| ~~11~~ | E    | ~~Switch the report link in `grapher.py` from `rawcdn.githack.com` to a staging `/svgtester/` URL.~~ **Superseded by item 19b**, which points the same link at `/admin/svgtester` instead. Building the nginx URL first would be two PRs written and then deleted.                                                                                                                                                                                                                                                                                                                                                                                                     | —          |
| ~~13~~ | O    | ~~Split the Buildkite step into one step per suite, each with its own timeout, status, and report.~~ **Dropped.** All four steps would drive the same staging container and the same svgs checkout, so they would share mutable state three ways: `reset_to_master` runs `git clean -fdx` over the whole checkout, and `git add` / `commit` / `push --force` race on the index and on the ref. It buys no parallelism either — `concurrency_group: "svg-tester/$BUILDKITE_BRANCH"` with `concurrency: 1` serialises the suites regardless — and the independent-status payoff arrives instead with item 16's per-suite check runs, which carry no shared-state hazard. | —          |

Optional stopgap (O): a Buildkite `block` step with a multi-select
field, plus `buildkite-agent meta-data get svg-suites` in `svg-tester.sh`, gives
per-suite on-demand selection until item 21 lands. Set `blocked_state: passed`.
Skip it if Phase 3 is close — it's throwaway work.

### Phase 3 — the viewer, and the end of generated HTML

**Item 19 is done** — the viewer, plus the render-error list, the overlay and
interactive views, and `make svgtest` pointing at the page. The rest of the
phase has not started. Execution detail — three stages, the first of them a single
`owid-grapher` PR, with the ordering constraints and open decisions — is in
[svg-tester-phase-3-plan.md](./svg-tester-phase-3-plan.md).

**Why:** this is the payoff, and it turned out not to need R2. The viewer's three
inputs — `verify-results.json`, `references/`, `differences/` — are all already
on the container's disk, and the admin server already runs there, is already
proxied, and already has auth. R2 is a _transport_ that moves those inputs
somewhere the container's death can't reach; it is not a capability the viewer
needs. So the whole of the old Phase 4 comes forward, and it drags two items out
of the old Phase 3 with it: once nothing generates a report, nothing commits on a
branch, and once nothing commits, the push and the 5.11 GiB pack can go.

| #   | Repo  | Change                                                                                                                                                                                                                                                                                                                                     | Depends on  |
| --- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| 19  | G     | The viewer: a React component plus `verify-results.json` types, served read-only at `/admin/svgtester`, reading results and SVGs off the local svgs checkout. Works identically for a local `make svgtest` run and a staging container's CI run. See [What the page serves](#what-the-page-serves).                                        | 12          |
| 19b | E     | owidbot's report link becomes `http://{container}/admin/svgtester/{suite}`, replacing the githack URL, and stops being gated on `commit_id`.                                                                                                                                                                                               | 19          |
| 20a | G + O | **Delete `create-compare-view.ts`** and the generated-HTML path, and delete `create_report` from `svg-tester.sh` with it. After this a branch run commits nothing at all.                                                                                                                                                                  | 19b         |
| 18  | O + S | Stop pushing to svgs branches; prune the ~900 stale branches; `git gc`. Reclaims most of the 5.11 GiB pack. Was blocked on R2 holding the artifacts instead; with the viewer reading from disk they never need to leave the container.                                                                                                     | 20a         |
| 16  | E     | Post a check run per suite (`create_check_run`, already used by chart-diff), `details_url` → the staging viewer. Conclusion never `failure` for differences. Was blocked on R2 only because `details_url` was assumed to point there.                                                                                                      | 6, 19b      |
| 21  | G     | Run button plus API routes: lock file per suite, disabled while running, hard timeout, no git write access.                                                                                                                                                                                                                                | 19          |
| 22  | G + O | Path-scoped default suites; retire the Buildkite block step and delete the `staging-viz` job from `.github/workflows/project-automations.yml`. The path-inference half depends on nothing; only deleting the auto-label wants 21 shipped first, since until the button exists the label is the sole way to ask for the other three suites. | 21 (partly) |
| 24  | O     | `Site screenshots diff` soft-fails on a `staging-viz` PR. Independent of every other item — it touches neither the tester nor the viewer. See [The label also governs the Site screenshots step](#the-label-also-governs-the-site-screenshots-step) for what it does and doesn't buy.                                                      | —           |

Note that Stage 2 groups these items into PRs differently from how they are numbered
here: the ops halves of 20a (delete `create_report`) and 18 (stop pushing on
branches) ship as **one** ops PR, since they edit the same forty lines of
`svg-tester.sh` and separating them means rewriting the branch/push plumbing twice.
Item numbering tracks the changes; the phase-3 plan tracks the PRs.

Three ordering constraints:

- **12 before 19.** The viewer reads `references/` off disk for the "before"
  image, so branches must have stopped overwriting it. Same invariant that made
  12 load-bearing in Phase 2.
- **19 on master before 19b.** `19b` writes a static URL into the PR comment, and
  a container building a branch that predates 19 has no `/admin/svgtester` route.
  Either wait for branches to catch up or accept a short 404 window.
- **20a degrades gracefully on old containers.** Deleting `create_report` is an
  ops change, so it hits every open PR the moment it merges, while `19b` only
  reaches containers created after it. Containers in between run old owidbot,
  find no report commit, and render the row with its count and icon but no link.
  A missing link, not a 404.

**One forward-compatibility change rides along with 19.** Add the rendered SVG's
`md5` to each entry in `verify-results.json`'s `differences[]`. The Phase 1
contract carries `viewId`, `queryStr`, `chartType` and `svgFilename` but no hash,
even though `verify-graphs.ts` computes one for every render. Phase 4's
content-addressed `blobs/{md5}.svg` can't be addressed from `results.json`
without it, so leaving it out turns Phase 4 from a URL change into a data-model
change. One field, free now.

The same logic applies to the viewer's fetch layer: build it against a resolver,
`(suite, kind, entry) → url`, rather than hard-coded admin paths. The admin
resolves to `/admin/api/svgtester/{suite}/differences/{svgFilename}`; R2 later
resolves to `blobs/{md5}.svg` for the after and
`refs/{svgsCommit}/{suite}/{svgFilename}` for the before, and `results.json`
already carries `svgsCommit`. Two viewers is the failure mode this design has
been guarding against since the start — one resolver is what prevents it.

#### What the page serves

Two client-side routes in the admin SPA, three API routes behind them. Everything
is read from `SVG_REPO_PATH` (`../owid-grapher-svgs`, `devTools/svgTester/utils.ts:47`)
and no query touches the database, so these are plain routes rather than the
`WithROTransaction` helpers.

`/admin/svgtester` — the index. One row per suite showing status, counts, when it
ran, how long it took and which grapher commit it ran against, from
`GET /admin/api/svgtester/suites.json`. It renders the same six states owidbot
already renders from the same contract: no file (never run), `running` (killed
mid-run), `error`, stale `grapherCommit`, `ok`, `differences`. Item 21's Run
button lands here.

`/admin/svgtester/{suite}` — the diff browser that replaces `differences.html`,
backed by:

```
GET /admin/api/svgtester/{suite}/results.json                          # + a staleness flag
GET /admin/api/svgtester/{suite}/{references|differences}/{file}.svg   # raw bytes off disk
```

The page fetches `results.json` once and renders one section per entry in
`differences[]`; each section lazily fetches its two SVGs when scrolled into view
and computes the unified diff in the browser with `jsdiff`. The initial payload is
therefore a few hundred KB even for a 4,460-difference run, where today the whole
report including every inlined diff arrives up front.

It keeps what `create-compare-view.ts` already does — side-by-side, swipe slider,
text diff, chart-type filter, links to the live and staging chart — and adds
sort-by-magnitude and per-item deep links. It deliberately serves nothing else
from the checkout: `data/**` and `.git/` are unreachable because the routes are
explicit.

Decision point at 16: owidbot already has GitHub App auth, so posting from E is
cheapest. The "status is reported by the component that knows it" argument favours
G posting its own check run — but that means new credentials on the tester
machine. Start with E; revisit only if the indirection bites.

### Phase 4 — R2, and durability

**Why:** everything above leaves reports living on the staging container and dying
with it. That is fine for the workflow reports are actually used in — read within
hours of a push — and it is not fine for opening last month's master run. Phase 4
buys durability and cross-run history, and nothing else. **It is genuinely
optional**: do it when someone asks for a report that no longer exists.

What softens the wait: item 12 keeps master's reference commits, so the reference
history — the thing anyone actually does archaeology on — stays in git
permanently. Only per-branch reports are ephemeral.

| #   | Repo | Change                                                                                                                                                                                                                                                                                  | Depends on |
| --- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 14  | G    | Upload script following the `devTools/syncGraphersToR2` pattern: changed SVGs to `blobs/{md5}.svg` (skip the put if the object already exists), `results.json` to `runs/{branch\|master}/{grapherCommit}/{suite}/`. Includes the visible per-run cap (`truncated`, `totalDifferences`). | 19         |
| 15  | O    | Wire the upload into `svg-tester.sh`; add R2 credentials to `grapher-env.secret`. With `create_report` already gone, the step reduces to "run the suite, then upload".                                                                                                                  | 14         |
| 17  | O    | Mirror `references/` to `svgtester/refs/{svgsCommit}/` in the refresh job, pruning all but the last two generations. Configure the lifecycle rules: `runs/` branch 30 days, `runs/master/` 1 year, `blobs/` 90 days.                                                                    | 15         |
| 20b | G    | Deploy the same viewer bundle to R2 at a stable URL and point the resolver at R2 objects; repoint `details_url` from the staging page to the durable one.                                                                                                                               | 15, 17     |
| 23  | O    | Scheduled monthly reference refresh replacing manual `refresh.sh`. Only the R2-mirroring half depends on 17 — a cron'd `refresh.sh` that commits to git depends on nothing and can land any time.                                                                                       | 17         |

### Landing order at a glance

```
O1 → G2 → E3 → S4               explorers gone
G5 → E6 → G7 → O8               status contract; O9 anytime
O12                             originals gone, branches stop absorbing
G19 → E19b → G20a/O20a → O18/S18   viewer; generated HTML and the git pack gone
E16 → G21 → G22                 check runs, Run button, suite selection
O24                             screenshots soft-fail on staging-viz; anytime
G14 → O15 → O17 → G20b → O23    R2: durability, if and when it's wanted
```

Phases 0–2 are small and done or nearly so. Phase 3 is where the work and the
payoff both are. Phase 4 is optional and can wait indefinitely.

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
   check hostage. A stopgap only if the page (item 21) slips.
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

- No approval step: nothing has to be signed off before merge, unlike chart-diff.
  Differences do gate the build when they are unexpected (a PR without
  `staging-viz`), but that is a prompt to look or to label, not a review workflow
  with state to maintain.
- SVG-string rendering stays. We accept that it covers no interaction — that's
  the BDD suite's job — in exchange for speed and text diffs.
- References stay in git rather than moving wholesale to R2, accepting that the
  data dirs keep the svgs repo large. The growth problem is per-run artifacts,
  not the reference set.
- The explorers suite is deleted rather than migrated. We accept losing SVG
  coverage of explorers for whatever remains of their life in the codebase; the
  grapher-id-based ones were never covered anyway (they're covered by the
  graphers suite), and the indicator- and CSV-based ones are on the way out.
- **Reports are ephemeral until Phase 4, and Phase 4 is optional.** From item 18
  onwards nothing per-run is committed or pushed, so a report lives on its
  staging container and dies with it. Accepted because reports are read within
  hours of the push, and because item 12 keeps master's reference commits — the
  history anyone actually does archaeology on stays in git permanently.
- **The report link needs the tailnet and an admin login.** Today's githack link
  is public. `/admin/svgtester` is neither, which is fine for staff (every other
  link in the owidbot comment is already internal) but means a report can't be
  pasted as evidence into a public thread.
- **On a `staging-viz` PR the `Site screenshots diff` step can no longer go red,
  including when it genuinely broke** (item 24). We are knowingly making the
  exception for that step that the SVG tester refuses to make for itself: the
  label softens breakage, not just differences, because that step reports no
  differences of its own and a flaked scrape costs the reviewer nothing the
  compare link doesn't still give them. If screenshot scrapes start failing
  silently and often, the fix is to detect differences in `site-screenshots` and
  narrow the soft-fail to exit 24, as the tester does.
- The timeout mismatch from Problem 7 stays: the 60 min step cap bounds all
  suites together and is shorter than the 7200 s per-suite `SVG_TEST_TIMEOUT`,
  so a hung suite is killed from the outside and takes its siblings' results
  with it. Accepted, because hitting either ceiling means the tester
  malfunctioned — a case Phase 1 already reports as red — rather than a result
  worth salvaging. Splitting the step to fix it was considered and dropped
  (item 13).
- Diff grouping is deferred to [Future improvements](#future-improvements).
  Reviewing a large diff stays as tedious as it is today until then; the
  robustness work doesn't depend on it.

## Recommendation

Ship item 12 as one ops PR, then build the viewer (19). Everything else follows
from those two.

The original recommendation, written before any of this shipped, argued for the
robustness work first and the `/admin/svgtester` page last, on the grounds that
the page was "only cheap once `results.json` and the viewer component exist, and
building it first means building the viewer twice". Half of that was right:
`results.json` genuinely had to come first, and it did, in Phase 1. The other
half was wrong, because it assumed the viewer's data had to reach R2 before a
page could render it. It doesn't — the data is already on the container. So the
page is not the expensive thing to defer; it is the cheap thing that makes four
other items land, and deferring it is what was keeping `create-compare-view.ts`
alive.

What Phase 1 actually taught, for whoever picks up Phase 2:

- **The staging container is the cheap test rig.** Pushing a branch builds one,
  and `staging-script` resolves an ops branch of the same name — so an ops change
  can be exercised end to end before it merges. Every bug worth catching here was
  caught that way, not by reading.
- **Measure before designing around performance.** A full graphers sweep is
  ~134 s, not the tens of minutes assumed; that killed the wall-clock argument for
  splitting the step and left the real one (independent status per suite).
- **Suspect derived state.** The md5 index had been wrong for 43% of the suite,
  and the code comment describing the symptom had been read as a fact of life for
  long enough that nobody checked.
