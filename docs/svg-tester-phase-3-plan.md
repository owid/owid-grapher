# Phase 3: the viewer, and the end of generated HTML

_Execution detail for Phase 3 of [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md)._

**Not started.** The largest phase, and the one that pays. Three stages — one PR
of six commits, then three PRs, then three — each independently valuable and
independently stoppable: after Stage 1 there is a working viewer and nothing else
has changed; after Stage 2 the generated HTML and the git-as-transport path are
gone.

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

## The finding that shapes commit 1

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
graph, so that is where the contract belongs. Doing this first is what keeps
every later commit small.

## Stage 1 — the viewer (one PR, six commits)

One PR in `owid-grapher`, six commits. Commits 1–2 are the contract and change no
behaviour; 3–6 build the page on top. Nothing here deletes anything, and nothing
consumes the new page until Stage 2 — so this can sit on master indefinitely.

### Libraries: one existing dependency, one hand-rolled component

The generated report loads `img-comparison-slider` and `diff2html` from unpkg
(`create-compare-view.ts:351–352`, `:680–681`). Neither is an npm dependency and
neither should come back — but the answers differ.

**The text diff uses `react-diff-viewer-continued`, already a dependency at
^4.2.2** and already the admin's way of showing a diff: `GdocsDiff.tsx`,
`EditorHistoryTab.tsx` and `EditorDebugTab.tsx` all use it. Matching them beats
introducing a second diff idiom, and it is a real React component rather than a
library that writes DOM, which `diff2html` is. Give it `oldValue` / `newValue`
as the two raw SVG strings and let it diff client-side; `showDiffOnly` collapses
the unchanged bulk of the file, and `compareMethod: DiffMethod.LINES` is the
right granularity for SVG markup — the `WORDS` mode `GdocsDiff` uses would be far
too slow over a thousand-line file.

Keep an equivalent of the existing `MAX_LINES_FOR_DIFF = 20_000` guard
(`create-compare-view.ts:206`): above that, show a "diff skipped, file too large"
state rather than hanging the tab. The guard exists because the diff algorithm is
slow on very large files, and that is truer in a browser than in a build script.

This also means `diff` (jsdiff) is no longer needed by the viewer — the library
does its own diffing. It stays a dependency for other reasons; just don't pull
`Diff.createTwoFilesPatch` into React code.

**The swipe slider is hand-rolled**, roughly 40 lines plus a companion `.scss`.
It is a native `<input type="range">` over two stacked `<img>` elements, with the
top one clipped by `clip-path: inset(0 0 0 var(--pos))`:

```tsx
<div className="svg-tester-slider" style={{ "--pos": `${pos}%` }}>
    <img src={beforeUrl} alt="Reference" />
    <img src={afterUrl} alt="Current" className="svg-tester-slider__clipped" />
    <input type="range" min={0} max={100} value={pos} onChange={…} />
</div>
```

Why not a package: `img-comparison-slider` is a web component, so it brings
Shadow DOM and custom-element registration into a React tree for a control this
small, and `react-compare-slider` would be a new dependency to justify in review
for the same. The native range input is keyboard-accessible for free and does not
drop light trackpad taps — the failure mode we already hit with React Aria
Components in the bespoke work.

### Commit 1 — move the results contract into `@ourworldindata/types`

Move the six symbols above and re-export them from `devTools/svgTester/utils.ts`
so the tester's own imports don't churn. Note the `explicit-function-return-type`
/ `explicit-module-boundary-types` overrides that apply under
`packages/@ourworldindata/**` — anything moving in needs explicit return types or
`oxlint --deny-warnings` fails.

`SVG_REPO_PATH` (`utils.ts:47`) is a bare relative string, `"../owid-grapher-svgs"`,
which happens to resolve because both the tester and the admin server run with
the repo root as cwd. Rather than duplicate it, add `SVG_TESTER_REPO_PATH` to
`settings/serverSettings.ts` with that default — both `devTools/svgTester` and
`adminSiteServer` already reference `settings`, and it becomes configurable for
free.

Verify with `yarn typecheck`; there is no behaviour to test.

### Commit 2 — add `md5` to each difference entry

`VerifyDifferenceEntry` gains `md5: string`; the value is already on `SvgRecord`
and already computed for every render.

Worth doing now rather than in Phase 4: content-addressed `blobs/{md5}.svg` can't
be addressed from `results.json` without it, so leaving it out turns Phase 4 from
a URL swap into a data-model change. It also gives the viewer a natural cache key.

Additive for owidbot, which reads the file with `.get()` throughout — no etl
change is needed, and old results files stay readable.

### Commit 3 — the read-only API

A new `adminSiteServer/apiRoutes/svgTester.ts`. These need no database, and
`apiRouter.get("/deploys.json", …)` (`apiRouter.ts:688`) is the precedent for a
plain route — the `…WithROTransaction` helpers in `plainRouterHelpers.ts` all
open a transaction and would be wrong here.

```
GET /admin/api/svgtester/suites.json                     # one entry per suite
GET /admin/api/svgtester/{suite}/results.json            # the parsed run summary
GET /admin/api/svgtester/{suite}/{references|differences}/{file}.svg
```

`suites.json` returns each suite's parsed `verify-results.json` or null, plus a
staleness flag comparing `grapherCommit` against the local checkout's HEAD —
the same check owidbot makes (`grapher.py`, `is_stale`), for the same reason: a
leftover results file must read as "not run", never as a result.

The SVG route is the one with a sharp edge. Validate `suite` against
`TEST_SUITES`, `kind` against the two literals, and the filename against both a
strict pattern and the suite's own results — never join a request path into a
filesystem path unchecked. Because the routes are explicit rather than a
directory mount, `data/**` and `.git/` are unreachable by construction, which is
the same property that made the nginx alias in the old item 10 unnecessary.

Testable with `curl` before any UI exists.

### Commit 4 — the index page and the sidebar entry

`/admin/svgtester`, one row per suite: status, counts, when it ran, duration,
grapher commit. `StaticVizIndexPage` + `StaticVizEditPage` (registered in
`AdminApp.tsx`) is the precedent for an index-plus-detail pair with a param
route.

Render the same six states owidbot does — never run, `running`, `error`, stale,
`ok`, `differences` — since both read one contract and disagreeing would be a bug
in one of them.

Sidebar entry goes under the **UTILITIES** header in `AdminSidebar.tsx`,
alongside Deploy status and Callout functions, following the established shape:

```tsx
<li>
    <Link to="/svgtester">
        <FontAwesomeIcon icon={faCodeCompare} fixedWidth /> SVG tester
    </Link>
</li>
```

`faCodeCompare` is present in the installed `@fortawesome/free-solid-svg-icons`
6.7.2 and is not yet used elsewhere in the sidebar.

### Commit 5 — the diff browser

`/admin/svgtester/:suite`. The bulk of the phase.

Ports what already works: side-by-side, swipe slider, unified text diff,
chart-type filter, links to the live and staging chart. Adds: sort by magnitude
so the two charts that actually broke aren't buried under 400 cosmetic ones,
`#slug` deep links so a single diff can be shared in review, and lazy SVG loading
with the diff computed in the browser from the two fetched files.

**Build it against a URL resolver — `(suite, kind, entry) => string` — not
hard-coded admin paths.** In Phase 4 the resolver points at `blobs/{md5}.svg` and
`refs/{svgsCommit}/{suite}/{svgFilename}` instead, and nothing else changes.
Splitting into two viewers is the failure mode this design has been guarding
against from the start; the resolver is what prevents it.

Two loading details carried over from the generated report, both still needed:
`loading="lazy"` on every image, and fetching the raw SVG text only when the diff
tab for that entry is opened — the images and the diff have different costs and
should not be coupled.

### Commit 6 — local wiring

`make svgtest` and the per-suite targets open
`localhost:3030/admin/svgtester/{suite}` instead of the generated file.

**Decided: needing the admin server on :3030 is acceptable.** Today the target
opens a static file and needs nothing, so this is a real change for anyone who
just wants to see what their change did without a dev environment. The
alternative — keeping local HTML generation — is the two-viewers failure mode,
which is the thing this phase exists to end. Print the URL so a run is still
useful when the server is down.

The old generated report keeps working throughout Stage 1; it is not deleted
until Stage 2.

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

**`make svgtest` may require the admin server on `:3030`.** Accepted. Keeping a
local-only generated report was the alternative and it is exactly the
two-viewers failure mode. Print the URL so the run is still useful with the
server down.

**The text diff uses `react-diff-viewer-continued`, the slider is hand-rolled.**
Neither unpkg script comes back. See
[Libraries](#libraries-one-existing-dependency-and-one-hand-rolled-component)
above — the diff library is already a dependency and already the admin's idiom,
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
on master indefinitely or be reverted freely.

Stage 2 is the one-way door. Once its PR 2 deletes `create-compare-view.ts` there
is no generated report to fall back to, so PR 1 should have been live long enough
to be trusted first. Revert order within the stage is PR 1 before PR 2, for the
same reason the plan orders them that way.
