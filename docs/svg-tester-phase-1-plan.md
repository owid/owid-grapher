# Phase 1: the status contract

_Execution detail for Phase 1 of [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md).
Short-lived: delete this file once the five PRs have landed. Phase 0 (explorers
removal) is done._

## Why now

Nobody can currently tell "no differences" from "the suite crashed". The outcome
is reconstructed downstream by counting lines in a log file and testing whether
files exist, and three specific things make that unreliable:

**1. The exit code is a count, and POSIX masks it to 8 bits.**
`displayVerifyResultsAndGetExitCode` (`utils.ts:833`) returns
`errorResults.length + differenceResults.length`, which is passed straight to
`process.exit`. A run with exactly **256** problems exits 0 — the step goes
green, and owidbot's report link (which it only emits when the status icon is
❌) disappears. 512 and 768 do the same. With ~4,500 charts in the graphers
suite, a sweeping layout change lands in that range routinely.

**2. Error output inflates the difference count.** owidbot computes the number of
differences as `len(f.readlines())` over `verify-graphs.log`
(`etl/apps/owidbot/grapher.py:91`). But `displayVerifyResultsAndGetExitCode`
prints one line per difference (`console.log("", viewId)`) *and* dumps whole
`Error` objects for failures (`console.log(viewId, result.error)`, `:818`) —
whose stack traces are many lines each. The `console.warn` summaries go to
stderr, so they never reach the file at all. The reported count is therefore
correct only when nothing errored.

**3. `|| :` hides real failures.** Every mutating step in `svg-tester.sh` ends in
`|| :`, so a suite that renders fine but fails while writing its report or
committing still looks like a clean run.

Phase 1 replaces all of that with a file the tester writes itself, and makes the
exit code mean one thing.

## The contract

`verify-graphs.ts` writes one JSON file per suite, next to the existing log:

```
{SVG_REPO_PATH}/{suite}/verify-results.json
```

Named `verify-results.json`, not `results.json`, to avoid confusion with the
existing `references/results.csv` md5 index — they are unrelated files.

```jsonc
{
  "suite": "graphers",
  "status": "running" | "ok" | "differences" | "error",   // "error" wins over "differences"
  "startedAt": "2026-08-05T12:34:56.000Z",
  "durationMs": 812345,
  "grapherCommit": "e179adb87f…",             // BUILDKITE_COMMIT, else git rev-parse HEAD
  "svgsCommit": "6f34881cee…",                   // git -C ../owid-grapher-svgs rev-parse HEAD
  "counts": { "total": 4460, "ok": 4318, "differences": 141, "errors": 1 },
  "differences": [
    // queryStr is omitted for the default view rather than recorded as ""
    { "viewId": "life-expectancy", "queryStr": "tab=chart", "chartType": "LineChart",
      "svgFilename": "life-expectancy_v42_850x600.svg" }
  ],
  "errors": [
    { "viewId": "some-chart", "kind": "timeout" | "render", "message": "Timed out after 120000ms: …" }
  ]
}
```

Notes on the shape:

- **`status: "running"` is written before the first render** and overwritten when
  the run finishes, so three states are distinguishable where previously there
  was one: no file at all (the suite was never started), `running` (it started
  and was killed before it could report), and a real terminal status. This is the
  only way to see the case that matters most — the `timeout --signal=TERM
  --kill-after=60` wrapper in `svg-tester.sh`, a cancelled Buildkite step, or
  `kill_stale_runs` reaping a superseded build. Its `counts` are zeroed
  placeholders and mean nothing.
  Deliberately not done with a signal handler: `timeout` signals `yarn`, not the
  node process underneath it, so a `SIGTERM` hook may never fire, and nothing can
  catch the `SIGKILL` that follows `--kill-after` anyway. Writing up front is
  immune to both.
- `kind: "timeout"` is derived from workerpool's `TimeoutError` (`err.name`),
  which is how a `.timeout(JOB_TIMEOUT_MS)` breach currently surfaces — it goes
  through the same `.catch` as a render crash (`verify-graphs.ts:128`) and is
  indistinguishable today.
- Only `message` is stored, not the stack. Stacks stay on stderr for the CI log.
- This object is what Phase 3 uploads to R2 unchanged, so it carries
  `grapherCommit` and `svgsCommit` now even though nothing reads them yet.
- CI never commits it: `create_report` and `commit_differences` add explicit paths
  (`$1/originals $1/differences $1/differences.html`, `$1/references`). But
  `refresh.sh` runs `git add --all` twice per suite (`:27`, `:38`), so a stale
  results file would get committed into a reference-data commit, describing a run
  against the *previous* references. **Add `verify-results.json` to the svgs
  repo's `.gitignore`**, alongside the `*.log` entry that already covers
  `verify-graphs.log` for the same reason. `differences/`, `differences.html` and
  `originals/` can't join it until Phase 2/3 stop committing them.

### Stale files, and why absence alone can't be trusted

The "no file means this suite never ran" half of the contract only holds if every
reset actually removes the file — and gitignoring it (above) is what makes that
non-obvious, since `git clean -fd` skips ignored files.

- **CI is already correct.** `reset_to_master` in `svg-tester.sh` uses
  `git clean -fdx`, and runs before any suite with `errexit` active.
- **Local was not.** `svgtest.reset` in the Makefile used `git clean -fd`, so a
  stale file survived. Fixed to `-fdx`, matching ops and `refresh.sh`.

Cleaning is necessary but not sufficient, because it makes correctness depend on
an external actor behaving, in every environment, forever. Two known ways it can
still be wrong: `kill_stale_runs` pkills a superseded build's process *before* the
reset, and pkill is best-effort, so a straggler could write a file afterwards; and
any future consumer running against a checkout nobody reset.

**So consumers must validate, not just look.** Every file carries `grapherCommit`
and `startedAt` — the per-run identifier is already there, it just has to be used:
treat a file whose `grapherCommit` doesn't match the commit under test as stale
and report it as not-run. Then a missed cleanup degrades to "no result" instead of
"wrong result". See PR 6.

## Ordering constraints

- **PR 5 before PR 6**: owidbot can only prefer a file that exists.
- **PR 7 before PR 8**: if ops drops `soft_fail` while the tester still exits 24,
  every viz PR goes red. The reverse is harmless — 24 simply stops being
  produced.
- **No backward compatibility with the log-based plumbing.** owidbot runs from
  `~/etl` as cloned when the *container* was created (`init.sh:117`; the grapher
  pipeline never pulls it), so containers older than the merge keep running old
  owidbot code. We accept that: this is an internal tool, and a temporarily wrong
  PR comment on a stale staging site is cheaper than carrying a dual-read path
  indefinitely. Old containers will report "no results" until they're recreated.
- PR 9 is independent and can go any time.

## PR 5 — owid-grapher: write `verify-results.json`

Additive: nothing consumes the file yet and the exit code is unchanged, so this
is safe to merge alone. Since nothing will parse stdout once PR 6 lands, its
format is no longer a contract — the `console.log(viewId, result.error)` stack
dump that inflates today's line count can go in PR 7, along with the rest of that
function's rewrite.

- **`utils.ts`** — add a `VerifyRunSummary` type plus a `summariseVerifyResults`
  helper that folds `VerifyResult[]` into the `counts` / `differences` /
  `errors` shape above. Leave `displayVerifyResultsAndGetExitCode` alone in this
  PR; it keeps printing exactly what it prints today.
  To fill `differences[]`, the summary needs each job's `queryStr`, `chartType`
  and `svgFilename` — `VerifyResultDifference` only carries `SvgDifference`
  (`viewId`, `startIndex`, two fragments), so either widen `SvgDifference` with
  the reference record's fields or pass the `referenceDataByChartKey` map into
  the helper. The map is already built at `verify-graphs.ts:73`; passing it in is
  the smaller change.
- **`verify-graphs.ts`** — write the `running` placeholder immediately after the
  directory checks (before job discovery, so even a kill during discovery is
  visible), capture `startedAt`/`durationMs`, resolve `grapherCommit`
  (`process.env.BUILDKITE_COMMIT ?? git rev-parse HEAD`) and `svgsCommit`, and
  overwrite the file before `process.exit`. Also write it from the `catch` block
  with `status: "error"` and the message, so a crash before rendering produces a
  file rather than silence — that case is exactly what today's "missing file means
  skipped, unless it's graphers, then it means error" heuristic (`grapher.py:76`)
  is guessing at.
  Don't miss the `jobCount === 0` early exit (`:103`): it must overwrite the
  placeholder with a real zero-count summary, or "nothing to do" is
  indistinguishable from "killed".

Verify — six cases, all run against the real graphers suite:

| Case | Expected |
| --- | --- |
| Two charts, no differences | `ok`, counts 2/2/0/0 |
| Reference genuinely mismatching (stale md5 in `results.csv` _and_ altered reference text — see below) | `differences`, populated `differences[]` |
| Reference SVG missing for one chart | `error`, `kind: "render"`, alongside `ok: 1` |
| `references/` directory missing | `error`, written from the `catch` block |
| `SIGTERM` then `SIGKILL` 25 s into a full run | file left at `status: "running"` |
| `--viewIds no-such-chart-slug` | `ok` with `total: 0`, placeholder overwritten |

## PR 6 — etl: read the contract, delete the log parsing

**`apps/owidbot/grapher.py`**

- `make_differences_line` reads `verify-results.json`: `counts`, and reports
  differences and errors *separately* — the entire point is that a suite which
  errored no longer reads as a difference count. Suggested rendering:
  `141 (a1b2c3) ❌ [Report]` for differences, and an explicit
  `⚠️ 1 error` / `⚠️ errored` when `counts.errors > 0` or `status == "error"`.
- **Four distinct states to render**, which is the whole payoff — don't collapse
  them:

  | `status` | Meaning | Suggested |
  | --- | --- | --- |
  | file absent | suite not selected for this run | `_skipped_` |
  | `running` | started, then killed (outer timeout, cancelled step) | `⚠️ killed mid-run` |
  | `error` | ran, something malfunctioned | `⚠️ N errors` |
  | `ok` / `differences` | ran cleanly | `0 ✅` / `141 ❌ [Report]` |

- **Check `grapherCommit` before trusting any of it.** If it doesn't match the
  commit owidbot is reporting on, the file is left over from an earlier run that a
  reset failed to clear — treat it as absent. Three lines, and it means a missed
  cleanup degrades to "no result" rather than "confidently wrong result". See
  [Stale files](#stale-files-and-why-absence-alone-cant-be-trusted).
- **Delete** `get_num_differences` and the `wc -l` path outright — no fallback.
  Also delete the "missing file means skipped, unless it's graphers, then it means
  error" heuristic (`:76`): `status` now says which it is.
- `svg_tester_has_run` (`:11`) looks for `verify-results.json`.

Verify: `etl owidbot owid-grapher/<branch> --services grapher --dry-run` against
a container that has a `verify-results.json`, and one that has none (should
report "not run" rather than crashing).

## PR 7 — owid-grapher: exit code means one thing

- **`utils.ts`** — `displayVerifyResultsAndGetExitCode` returns `0` when there
  are only ok/difference results, and `1` when any error result is present.
  Stop returning a count: it's the 8-bit-masking bug, and the count now lives in
  `verify-results.json`. Consider renaming to
  `displayVerifyResultsAndGetExitCode` → `reportVerifyResults`, since "get exit
  code" stops being the interesting part.
- **`verify-graphs.ts`** — no change beyond what PR 5 did; the `catch` block
  keeps exiting non-zero.
- **`Makefile` — this is the part that's easy to miss.** All five svgtest targets
  generate their HTML report *only when verify exits non-zero*:
  `verify-graphs.ts … || (create-compare-view.ts … && open …)` (`:415`, `:422`,
  `:441`, `:448`, `:455`). Once differences exit 0, `make svgtest` stops
  producing a report at all. Restructure to gate on the differences directory
  instead, mirroring what ops already does in `create_report`
  (`[ "$(ls -A $1/differences)" ]`):

  ```make
  yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts
  @if [ -n "$$(ls -A ../owid-grapher-svgs/graphers/differences 2>/dev/null)" ]; then \
      yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts && \
      open ../owid-grapher-svgs/graphers/differences.html; \
  else echo '==> No differences'; fi
  ```

Verify: `make svgtest` must still open a report when references differ, and must
now exit 0 while doing so. `make svgtest` on an unchanged tree prints "No
differences" and exits 0. Break a reference deliberately for the first case.

## PR 8 — ops: drop the soft-fail machinery

**`templates/owid-site-staging/svg-tester.sh`**

- Delete the `exit 24` branch and the `staging-viz` label check in the exit
  handling (`:191–202` after ops#594), leaving: master exits 0, everything else
  propagates the tester's exit code — which now only ever means malfunction.
- **Restructure the `|| :` blocks rather than deleting the `|| :`.** In
  `create_report` and `commit_differences` the trailing `|| :` does double duty:
  it swallows real failures *and* absorbs the legitimate "no differences" case,
  where `[ "$(ls -A $1/differences)" ]` returns non-zero under `errexit`. Just
  removing it would make every clean run fail. Convert each to an explicit
  conditional:

  ```bash
  create_report() {
      if [ -z "$(as_owid ls -A owid-grapher-svgs/"$1"/differences)" ]; then
          echo "--- No differences ($1), skipping report"
          return 0
      fi
      # … then let each step's failure propagate
  }
  ```

Also drop the `> ../owid-grapher-svgs/$1/verify-graphs.log` redirect in
`run_test_suite`. Nothing reads that file once PR 6 lands, and without the
redirect the run's output lands in the Buildkite log where it's actually useful —
today stdout goes to the file and only stderr reaches Buildkite.

**`.buildkite/grapher/automated_staging_environment.yml`** — remove the
`soft_fail: exit_status: 24` clause and its comment from the SVG tester step
(`:95–97`). Pipeline-only change: it takes effect from ops `main` and cannot be
tested from a branch, so exercise it by pointing the Buildkite bootstrap clone
at your ops branch first.

Verify: a PR with differences shows a **green** SVG tester step; a PR where a
suite genuinely errors shows red; a clean PR stays green with "No differences"
in the log.

## PR 9 — ops: stop hiding owidbot failures

**`templates/owid-site-staging/owidbot.sh:47`** — drop the `'||' true` after the
`etl owidbot` invocation so a failing owidbot surfaces instead of passing
silently. Independent of everything else; the pipeline step already has
`soft_fail: exit_status: 1` on the owidbot steps, so this makes failures visible
without turning builds red.

## Landing order

```
PR 5 (G, additive)  →  PR 6 (E, dual-read)
                    →  PR 7 (G, exit codes + Makefile)  →  PR 8 (O, soft_fail)
PR 9 (O)  — any time
```

## Incidental findings

Noticed while implementing and testing PR 5. None of them are Phase 1 work; they
are recorded so they aren't rediscovered from scratch.

- **The md5 fast path makes references look identical when they aren't.**
  `verifySvg` compares the fresh render's md5 against `references/results.csv` and
  returns `ok` on a match *without reading the SVG*, so editing a reference file
  alone is undetectable. Already documented in a code comment (`commit_differences`
  updates SVGs but never the CSV). It's why testing a difference requires both a
  stale md5 in the CSV and changed reference bytes.
- **`--chartTypes` doesn't intersect with `--viewIds`.**
  `--viewIds life-expectancy --chartTypes ScatterPlot` verified 554 charts rather
  than zero or one, so the two filters union or one overrides the other. Worth a
  look if anyone relies on combining them.
- **Useful timing datapoint:** 554 graphers charts verify in ~29 s on a dev
  machine with the default `MAX_WORKERS=6`.
- **`process.exit(-1)` surfaces as 255**, the same 8-bit masking that makes the
  count-based exit code unsafe. Harmless once PR 7 makes failures a plain `1`.

## Rollback

PR 5 and PR 6 are additive and independently revertable. PR 7 and PR 8 must be
reverted together or in the order PR 8 → PR 7: reverting PR 7 alone restores
`exit 24` while ops no longer soft-fails it, which turns every viz PR red — the
same failure mode as landing them in the wrong order.
