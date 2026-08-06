# Phase 3: the viewer, and the end of generated HTML

_Execution detail for Phase 3 of [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md)._

**Stage 1 is done; Stages 2 and 3 have not started.** The largest phase, and the
one that pays. Three stages, each independently valuable and independently
stoppable: after Stage 1 there is a working viewer and nothing else has changed;
after Stage 2 the generated HTML and the git-as-transport path are gone.

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

**`make svgtest` opens the page** instead of the generated file, and no longer
opens a browser at all when the admin server is down — it prints the URL.

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

**PR 1 (E) — owidbot links to the page.** `make_report_url` becomes
`http://{container}/admin/svgtester/{suite}`, and the link stops being gated on
`commit_id` so it doesn't depend on a commit PR 3 removes.

Ordering matters: Stage 1 must be on master first. This writes a static URL into
the PR comment, and a container building a branch that predates the viewer has no
such route. Either wait for branches to catch up or accept a short 404 window.

**PR 2 (G + O) — delete the generated HTML.** `create-compare-view.ts` (797
lines), `create_report` in `svg-tester.sh`, the report commit, and the report
generation in the Makefile targets. After this a branch run commits nothing at
all.

Old containers degrade gracefully rather than breaking: ops changes hit every
open PR at once while etl changes only reach containers created after they merge,
so containers in between run owidbot from before PR 1, find no report commit, and render
the row with its count and icon but no link.

**PR 3 (O + S) — stop pushing, then prune.** Drop the branch push from
`svg-tester.sh` (master keeps its references commit), then delete the ~936 stale
branches and `git gc`. Deleting `explorers/` didn't shrink the 5.11 GiB pack
because those blobs stay reachable from history; pruning branches is what
actually reclaims it, because the per-run report and difference blobs are
reachable only from those refs.

## Stage 3 — the extras (3 PRs)

Each is independently useful and none blocks the others.

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

Careful here: since Phase 1 the `staging-viz` label carries a **policy** — which
differences are a surprise — not just suite selection. Path inference must not
quietly become the input to that decision.

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
- **`verify-results.json` is gitignored**, so a suite's results exist only on the
  machine that ran it. The page shows that container's runs and nothing else,
  which is correct but worth stating before someone expects history.

## Rollback

Stage 1 is additive — nothing consumes the new page until Stage 2, so it can sit
on master indefinitely or be reverted freely. The old generated report still
works alongside it.

Stage 2 is the one-way door. Once its PR 2 deletes `create-compare-view.ts` there
is no generated report to fall back to, so PR 1 should have been live long enough
to be trusted first. Revert order within the stage is PR 1 before PR 2, for the
same reason the plan orders them that way.
