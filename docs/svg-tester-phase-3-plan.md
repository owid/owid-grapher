# Phase 3: the viewer, and the end of generated HTML

_Execution detail for Phase 3 of [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md)._

**Stage 1 is done and merging; Stages 2 and 3 have not started.** The largest
phase, and the one that pays. Three stages, each independently valuable and
independently stoppable: after Stage 1 there is a working viewer and nothing else
has changed; after Stage 2 the generated HTML and the git-as-transport path are
gone.

**Next action: Stage 2's PR 1** (owidbot links to the page). It gates the rest of
Stage 2, and it is the moment the report becomes tailnet- and login-only — worth
telling the team when it merges rather than when someone can't open a link.

**Stage 1 is entirely `owid-grapher`.** No ops, etl or svgs changes, so none of
the cross-repo deployment asymmetry applies until Stage 2 — and it can still be
tested end to end on staging, because the container builds the branch's own admin
code and nginx already proxies `^/(admin|gdocs)` to `:3030`.

Its only blocker, item 12, merged as ops#596.

## What has to be true at the end

`create-compare-view.ts` is deleted. A branch run commits nothing and pushes
nothing. A reviewer opens one URL from the PR comment and sees the same diff
browser they'd see locally after `make svgtest`. And the whole thing reads
`verify-results.json` plus two directories of SVGs off the container's disk — no
bucket, no CDN, no second repo.

## Why the contract had to move

**The admin cannot import the tester's types today, and shouldn't.**
`adminSiteServer/tsconfig.json` references `types`, `utils`, `db`, `site` and so
on, but not `devTools/svgTester` — and adding that reference would point an
application at `devTools/`, which is backwards layering, not just a missing
entry.

Everything the viewer needs is currently stranded in
`devTools/svgTester/utils.ts`: `VerifyRunSummary`, `VerifyDifferenceEntry`,
`VerifyErrorEntry`, `VerifyRunStatus` (`:800–831`), `TEST_SUITES` / `TestSuite`
(`:49–55`), and `VERIFY_RESULTS_FILENAME` (`:63`). Both the tester and the admin
already reference `@ourworldindata/types`, which is the base of the dependency
graph, so that is where the contract belongs.

## Stage 1 — the viewer (done)

One `owid-grapher` PR. Planned as six commits and squashed for review; what
follows is what shipped, which is more than was planned.

**The contract moved to `@ourworldindata/types`.** `adminSiteServer` must not
depend on `devTools/`, and it already depends on `adminSiteClient`, so neither
the tester nor the admin could own the shape — both depend on `types`. Everything
the two sides share ended up there: the suite list, the two rendering
directories, the results filename, the run status, the difference and error
entries, the run summary, and the suite status the API returns. All prefixed
`SvgTester*`, because `VerifyRunSummary` says nothing in a package-global
namespace. `devTools/svgTester` imports them directly rather than re-exporting.

**`verify-results.json` gained `changedRatio`** — how much of the markup
changed, 0–1. The tester is the only place that measurement is cheap: it holds
both renderings already, so an O(n) estimate costs about a millisecond, where a
reader would have to fetch two ~127 KB files per chart. The diff view uses it to
recognise an unreadable diff before fetching anything.

An `md5` field was added and then removed. It had no consumer — it was
speculative groundwork for Phase 4's content-addressed blobs, and since the
results file is gitignored and rewritten every run there is no migration cost to
adding it when Phase 4 actually happens.

**Three read-only API routes** under `/admin/api/svgtester`: a per-suite status
summary, one suite's full results, and the raw SVGs. Naming each reachable
directory in an explicit route rather than mounting one means the suite's 3.8 GB
of dumped inputs and the repo's `.git` are unreachable by construction;
`resolveSvgPath` validates on top of that and is unit-tested, since the traversal
cases are the part worth locking down.

**The index page** lists the four suites with status, counts, timings and the
grapher commit — linked to GitHub only where the commit is pushed, since locally
the suite runs against an unpushed working tree and the link would 404. Sidebar
entry under UTILITIES. A suite with no reported result shows dashes rather than
a confident `0`, because the counts in a `running` file are placeholders written
before the first render.

**The diff browser** offers five views per chart, chosen per card because which
one answers the question depends on the chart:

| view         | question                              |
| ------------ | ------------------------------------- |
| Side by side | what do the two renderings look like? |
| Swipe        | where did it move?                    |
| Overlay      | which pixels changed at all?          |
| Diff         | what changed in the markup?           |
| Interactive  | does the chart still work?            |

Overlay and Interactive were not in the plan. Overlay stacks the two renderings
with `mix-blend-mode: difference` and inverts the result, so unchanged reads as
white and only changes show — one CSS property, and it caught a data change on
the China import map that reading the two charts side by side did not make
obvious. Interactive embeds both charts live, production against this build;
it answers a different question from every other view, since those compare
renderings from the frozen dump while these render from live data.

**Charts that failed to render are listed** above the differences, with kind and
message, each linking to the chart on this build where it broke. They were
counted but never shown, which is backwards: an error matters more than a
difference.

**`make svgtest` was meant to open the page** instead of the generated file. This
did not ship: the five `svgtest*` targets still call `create-compare-view.ts`. See
the note at the head of [Stage 2](#stage-2--retire-the-old-path-3-prs) — PR 3
picks it up.

### Libraries

The generated report loaded `img-comparison-slider` and `diff2html` from unpkg.
Neither came back.

The text diff uses **`react-diff-viewer-continued`**, already a dependency and
already how `GdocsDiff` and the chart editor show diffs. `DiffMethod.LINES`, not
the `WORDS` mode `GdocsDiff` uses — word granularity over a thousand lines of
markup is far too slow — and `showDiffOnly` collapses the unchanged bulk.

The swipe control is **hand-rolled**: a native `<input type="range">` stretched
invisibly across the chart, so press-to-jump, drag-to-scrub, arrow keys and a
focus target all come for free. A web component would have brought Shadow DOM
into the tree for a control this small.

### Tried and reverted

Recorded so they are not proposed again.

**Ranking by magnitude.** Each card carried a bar showing how much changed, and
the list sorted by it. Rejected: on a page where you scan the charts themselves,
the ranking was not worth the chrome. `changedRatio` stays because the diff view
uses it.

**A chart filter.** It matched the slug and query string but not the chart's
title, which lives in the SVG rather than in `results.json` — a filter that finds
a chart only when its slug happens to resemble its title is one you cannot trust.

**Deep links.** Each card had an `id` and a `#` anchor, with an effect that
re-scrolled once the cards existed. Dropped; the effect also re-fired on filter
changes, yanking you back mid-browse. The `#` survives as decoration.

## Stage 2 — retire the old path (3 PRs)

**Three PRs, one per repo**, plus a maintenance task: PR 1 is etl, PR 2 is a single
ops PR carrying both halves of the shell work, PR 3 is grapher, and the svgs prune
is a direct task on a repo with no CI rather than a PR.

The two ops changes — deleting `create_report` and making the push master-only —
were originally two PRs and are deliberately one. They edit the same forty lines of
`svg-tester.sh`, and doing them in one pass is what lets the branch/push plumbing
collapse cleanly instead of being rewritten twice. The cost is recorded under
[Rollback](#rollback): the combined PR stops being usefully revertible the moment
PR 3 merges, so back out a piece of it with a forward fix rather than a revert.

**The three are sequential, not parallel** — unlike Stage 3's. PR 1 must be live and
trusted before PR 2 removes the fallback, and PR 2 must precede PR 3 or the SVG
tester step goes red on every open PR. Each constraint is restated with its PR
below.

One thing PR 3 has to fix, because Stage 1's write-up overstates what shipped:
**the Makefile still generates the report.** `make svgtest` and its four siblings
call `create-compare-view.ts` in eight places
(`Makefile:419,431,440,449,458,470,482,494`), so the claim above that `make svgtest`
opens the page is not yet true of master. Either Stage 1 lands it before merge or
PR 3 owns it; PR 3 has to touch those exact lines anyway.

### PR 1 (E) — owidbot links to the page

All in `apps/owidbot/grapher.py`. **Two links change, not one** — this is the part
the earlier sketch missed, and it is what lets PR 2 skip an etl companion:

1. **The per-suite report link.** In `make_differences_line` (`:136`), replace the
   githack URL with `http://{container_name}/admin/svgtester/{suite}` and widen the
   condition from `num_differences > 0 and commit_id` to `num_differences > 0 or
num_errors > 0`. Stage 1 made the page list render errors above the differences,
   so a suite with zero differences and three errors now has something worth
   opening — today it links nowhere.
2. **The block's header link.** `svg_tester_line` (`:34`) points at
   `https://github.com/owid/owid-grapher-svgs/compare/{branch}`, which only
   resolves while the branch is pushed. Repoint it at the index,
   `http://{container_name}/admin/svgtester`. **PR 2 breaks this link if PR 1
   doesn't move it**, so it belongs here rather than there.

Dead once those two land, and deleted in the same PR: `make_report_url` (`:193`),
`make_commit_link` (`:187`), `get_report_commit` (`:174`), the `commit_link` part
of the assembled line (`:158–159`, `:170`), and `GitCommandError` from the imports
(`:4` — `get_head_commit` only raises the other three). `make_differences_line`'s
signature loses `suite_dir` and gains `container_name` and `suite`, which also
removes its last reason to touch the svgs checkout.

Dropping the commit link is a small deliberate loss: it currently shows which svgs
commit holds the report. PR 2 stops creating that commit, so keeping it for one
PR's lifetime buys nothing — and `get_report_commit` is a `git log -1 -- {suite}/differences.html`
that would start returning a **stale historical sha** rather than `None` if
`differences.html` ever entered master's history.

**No tests.** The Phase 1 plan specified `tests/apps/test_owidbot_grapher.py` and it
was never written; leave it that way. This is string formatting in an internal
tool, checked by running the function (below) and then by reading the first comment
a fresh container posts — a test asserting the shape of a markdown line mostly
restates the code.

**How to test it.** Not on a staging container: containers clone etl at
master when created (`init.sh:117`) and the grapher pipeline never pulls it, so a
branch is unreachable there. Run it locally instead — `run("some-branch")` against
a local `../owid-grapher-svgs` with a hand-written `verify-results.json` — and then
confirm on the first freshly created container after merge.

**Risk, accepted:** for the window between this merging and open branches rebasing
onto Stage 1, a new container running a pre-viewer branch gets a comment linking to
a route that 404s. The alternative is holding PR 1 until branches catch up, which
is slower for no real gain.

### PR 2 (O) — stop reporting and stop pushing

One ops PR, all in `svg-tester.sh`, doing both halves of the shell work at once.

**Stop generating the report.** Delete `create_report` (`:63–78`), the
`Create HTML reports` loop that calls it (`:154–159`), and `STAGING_URL` (`:13`),
whose only consumer is that function's `--compare-url`. Keep `list_differences` —
`commit_differences` still uses it — and keep `GRAPHER_COMMIT_URL`, still used by
master's references commit message.

**Stop pushing on branches.** Make the push master-only (`:170–172`). The
branch-checkout block (`:127–132`) then has no purpose either — with nothing
committing and nothing pushing on a branch, runs can just stay on the master
checkout that `:122–125` already produced.

Doing both in one pass is what makes the second half clean: the branch/checkout/push
plumbing collapses once rather than being edited, then edited again. What is left is
an invariant worth writing into the script as a comment: **on a branch,
`svg-tester.sh` performs no git writes at all** — it resets to master, renders, and
reports through `verify-results.json`.

**What to verify**, on a staging container with an ops branch named after your
grapher branch:

- a branch build makes zero commits and zero pushes — check the step log between the
  last suite and the end for any `git commit` or `git push`;
- a master build still commits references per differing suite and still pushes.

The master arm is the one no test run exercises, and Phase 2 left the same gap, so
the first master run with differences after this merges is worth watching.

**Ordering.** PR 1 first, so the PR comment already points at the admin page rather
than at a report this PR stops producing. Then PR 3 — never before it, see there.

Old containers degrade gracefully rather than breaking: ops changes hit every open
PR the moment they merge while etl changes only reach containers created after PR 1,
so containers in between run pre-PR-1 owidbot, find no report commit, and render the
row with its count and icon but no link.

Optional hygiene, cheap here: add `differences/` to the svgs repo's `.gitignore` (it
already ignores `verify-results.json`). Nothing commits it after this PR, and
ignoring it means no future `git add -A` can.

### PR 3 (G) — delete the generated HTML

**Never before PR 2.** This is Phase 0's `O1 → G2` lesson again: if this lands while
ops `main` still calls `create_report`, that function invokes a
`create-compare-view.ts` that no longer exists, the call fails, `tester_broke=1`, and
the step goes red on every open PR that has rebased onto the deletion. The reverse is
harmless in the usual asymmetric way — ops simply stops invoking code that is still
there.

`git rm devTools/svgTester/create-compare-view.ts` (799 lines). Then the eight
Makefile call sites across five targets (`svgtest`, `svgtest.full`,
`svgtest.grapher-views`, `svgtest.mdims`, `svgtest.thumbnails`): each is an
`if [ -n "$$(ls -A .../differences)" ]` block whose body generates the report, so
each becomes a printed `http://localhost:3030/admin/svgtester/{suite}` line instead
— keeping the else-branch's `No differences` echo. While in there: `.PHONY` (`:40`)
lists every `svgtest.*` target except `svgtest.full`. And
`devTools/svgTester/readme.md:112` and `:124` describe report generation as step 3 of
each workflow.

Verify with a local `make svgtest` that has differences: it should print the admin
URL and write no HTML into the svgs checkout.

### The prune (S) — maintenance, not a PR

Depends on PR 2 only, so it can happen any time after that merges. `git push --delete`
every `refs/heads/*` except `master` (~940 remote branches today, up from the 936
recorded earlier), then `git fetch --prune` and `git gc --prune=now` in local clones.

Be accurate about what this reclaims, because the redesign plan overstates one
part: staging containers clone with `git clone --depth=1`, which implies
`--single-branch`, so they already fetch master alone and pruning does **not**
speed them up. What it does buy is GitHub-side repo size, cheaper full clones, and
faster `git fetch` — and note GitHub repacks on its own schedule, so the 5.2 GiB
server-side pack won't shrink the moment the refs go; a support request may be
needed to force it. The local 5.2 GiB `.git` does shrink, after the fetch-prune and
gc above.

Two safety notes: this is destructive and irreversible on a shared repo, so it wants
an explicit go-ahead and the branch list reviewed before anything is deleted; and it
takes the reports for currently-open PRs with it, which is fine only because PR 2 has
already stopped creating them.

## Stage 3 — the extras (4 PRs)

Each is independently useful, and these can be opened in parallel with two
caveats: PR 4's `details_url` wants Stage 2's PR 1 to have settled the URL shape,
and PR 6's auto-label deletion wants PR 5 shipped (see PR 6). PR 7 depends on
nothing at all. An earlier version of this line said flatly that none blocks the
others, which contradicted the master plan's `22 → 21` edge; the truth is that
only half of PR 6 is blocked.

**PR 4 (E) — check run per suite.** `create_check_run`, already used by
chart-diff, with `details_url` → the staging viewer. Conclusion never `failure`
for differences. This is what replaces the per-suite status that splitting the
Buildkite step would have given (dropped item 13).

**PR 5 (G) — the Run button.** API routes to kick off a suite: one run per suite
per container behind a lock file, button disabled while running, hard timeout,
and no ability to write to git. Admin auth matters here — an endpoint that can
spawn a multi-minute job should not be anonymous.

**PR 6 (G + O) — path-scoped default suites.** Infer from the diff (mdim code →
mdims, thumbnail and baking code → thumbnails, axis/faceting code →
grapher-views), retire the Buildkite block step if it was ever built, and delete
the `staging-viz` auto-label job from `project-automations.yml`.

The two halves have different blockers. Path inference depends on nothing and can
land whenever. Deleting the auto-label wants PR 5 shipped first, because until the
Run button exists the label is the only way to ask for the other three suites — so
removing it early takes away the trigger from the one author whose PRs it fires
on.

Careful here: since Phase 1 the `staging-viz` label carries a **policy** — which
differences are a surprise — not just suite selection, and after PR 7 it carries a
second one. Path inference must not quietly become the input to either decision.
Note also that deleting the auto-label means PR 7's soft-fail only applies where
someone labels by hand, which is the intent but is a behaviour change for the
author whose PRs are labelled automatically today.

**PR 7 (O) — `Site screenshots diff` soft-fails on a `staging-viz` PR.** Item 24;
independent of everything else in the phase, including the viewer. On a PR
carrying the label the step must never be red.

What it actually softens is **breakage**, not differences. `site-screenshots` runs
`shot-scraper multi`, which only captures — it then commits `--allow-empty`,
pushes, and prints a GitHub compare link — so the step is already green whether or
not screenshots changed, and its only red path is a scrape timing out or a push
conflicting. That is a deliberate exception to the rule Phase 1 established for
the tester; the reasoning and the accepted trade-off are in the redesign plan.

Two mechanisms, both viable:

- **Pipeline-only.** Buildkite conditionals expose `build.pull_request.labels`
  with `includes`, but `soft_fail` itself can't be conditional — so this means two
  copies of the step with mutually exclusive `if`s and distinct `key`s, one
  carrying `soft_fail: true`. No script change, and nothing depends on the
  `site-screenshots` key today, so the duplication is safe. Costs a duplicated
  step in the pipeline, and pipeline changes deploy from ops `main` only.
- **Script-side, mirroring svg-tester** (preferred). Trap failure in
  `templates/lxc-manager/site-screenshots`, check the label as
  `has_staging_viz_label` already does, and remap to exit 24; add
  `soft_fail: {exit_status: 24}` to the single step. One step, one label helper,
  same idiom as the tester — at the cost of widening what exit 24 means to a
  second script, and of that script's odd deployment route (`init.sh` sync to the
  shared lxc-manager host, not a staging container — see the redesign plan's
  deployment mechanics).

One thing to verify either way: the step invokes the script as
`sudo -E su owid -c 'GRAPHER_BRANCH=$$BUILDKITE_BRANCH bash /home/owid/bin/site-screenshots'`
and passes the branch explicitly, so don't assume `BUILDKITE_PULL_REQUEST`
survives to the script — pass it in the same way if the label check needs it.
`GITHUB_TOKEN` is present on that host via `/home/owid/.env`, which `common.sh`
loads, so the labels API call itself is fine.

## Decisions, settled

All three of Stage 1's open questions are now answered; kept here with their
reasoning so they are not relitigated mid-implementation.

**`make svgtest` may require the admin server on `:3030`.** Accepted, and shipped. Keeping a
local-only generated report was the alternative and it is exactly the
two-viewers failure mode. Print the URL so the run is still useful with the
server down.

**The text diff uses `react-diff-viewer-continued`, the slider is hand-rolled.**
Neither unpkg script came back. See [Libraries](#libraries) above — the diff library is already a dependency and already the admin's idiom,
and a web component for a range input plus a `clip-path` is not worth the Shadow
DOM.

**`/admin/svgtester` gets a sidebar entry**, under UTILITIES.

Still open, but for Stage 3 rather than Stage 1: whether the Run button lives on
the index page only, or also per suite on the diff page.

## Risks

- **The report becomes login-gated and tailnet-only.** Already recorded as an
  accepted trade-off in the redesign plan, but Stage 2's first PR is the moment
  it becomes true, and it will surprise someone.
- **Reports die with their container.** Also accepted; Phase 4 is what buys
  durability, and item 12 keeping master's reference commits is what makes the
  wait tolerable.
- **No version skew on staging**, because the container runs the branch's own
  admin code and its own results file. The skew risk is only Phase 4's, when a
  deployed bundle starts reading older runs.
- **PR 7 hides a genuinely broken screenshot run on labelled PRs.** Accepted, and
  recorded as a trade-off in the redesign plan. The signal that it has gone wrong
  is screenshots quietly not updating; the fix is to narrow the soft-fail to a
  difference-derived exit 24.
- **`verify-results.json` is gitignored**, so a suite's results exist only on the
  machine that ran it. The page shows that container's runs and nothing else,
  which is correct but worth stating before someone expects history.

## Rollback

Stage 1 is additive — nothing consumes the new page until Stage 2, so it can sit
on master indefinitely or be reverted freely. The old generated report still
works alongside it.

Stage 2 is the one-way door. Once PR 3 deletes `create-compare-view.ts` there is no
generated report to fall back to, so PR 1 should have been live long enough to be
trusted first. Unwind in reverse: PR 3, then PR 2, then PR 1.

**PR 2 stops being usefully revertible once PR 3 merges** — that is the price of
carrying both shell changes in one PR. Reverting it would restore a `create_report`
that calls a deleted script, which is the red-on-every-PR failure described under
PR 3. So while PR 3 is in flight, back out a piece of PR 2 with a forward fix — re-add
the push line, or the report generation, on its own — rather than reverting the
commit. After PR 3 has merged, restoring the report path means restoring both repos
together.
