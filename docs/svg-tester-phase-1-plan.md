# Phase 1: the status contract

_Execution detail for Phase 1 of [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md)._

**Done.** owid-grapher#6911, #6913, #6914, etl#6623 and ops#595 are all merged;
PR 9 was dropped (see below). Kept for the findings and the decisions, which the
code comments only partly carry — delete it once Phase 2 has moved on.

Two things ended up different from what this document originally planned, and both
are worth knowing before reading it:

- **Differences still fail a build when they are unexpected.** The first draft
  argued that differences are information, never failure, and that `soft_fail`
  could go. That was overruled, correctly: an unlabelled PR that changes 141
  charts is a surprise worth stopping at. The tester reports three fixed exit
  codes and `svg-tester.sh` applies the label policy.
- **PR 9 was dropped** after finding the `|| true` it targeted is load-bearing.

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
prints one line per difference (`console.log("", viewId)`) _and_ dumps whole
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
  against the _previous_ references. **Add `verify-results.json` to the svgs
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
still be wrong: `kill_stale_runs` pkills a superseded build's process _before_ the
reset, and pkill is best-effort, so a straggler could write a file afterwards; and
any future consumer running against a checkout nobody reset.

**So consumers must validate, not just look.** Every file carries `grapherCommit`
and `startedAt` — the per-run identifier is already there, it just has to be used:
treat a file whose `grapherCommit` doesn't match the commit under test as stale
and report it as not-run. Then a missed cleanup degrades to "no result" instead of
"wrong result". See PR 6.

## Ordering constraints

- **PR 5 before PR 6**: owidbot can only prefer a file that exists.
- **PR 7 before PR 8**: PR 8 reads exit 2, which doesn't exist until PR 7 lands.
  In the window between them the old mapping still applies — any non-zero goes
  through the label check — which is the pre-existing behaviour, not a
  regression.
- **No backward compatibility with the log-based plumbing.** owidbot runs from
  `~/etl` as cloned when the _container_ was created (`init.sh:117`; the grapher
  pipeline never pulls it), so containers older than the merge keep running old
  owidbot code. We accept that: this is an internal tool, and a temporarily wrong
  PR comment on a stale staging site is cheaper than carrying a dual-read path
  indefinitely. Old containers will report "no results" until they're recreated.

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

| Case                                                                                                  | Expected                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Two charts, no differences                                                                            | `ok`, counts 2/2/0/0                          |
| Reference genuinely mismatching (stale md5 in `results.csv` _and_ altered reference text — see below) | `differences`, populated `differences[]`      |
| Reference SVG missing for one chart                                                                   | `error`, `kind: "render"`, alongside `ok: 1`  |
| `references/` directory missing                                                                       | `error`, written from the `catch` block       |
| `SIGTERM` then `SIGKILL` 25 s into a full run                                                         | file left at `status: "running"`              |
| `--viewIds no-such-chart-slug`                                                                        | `ok` with `total: 0`, placeholder overwritten |

## PR 6 — etl: read the contract, delete the log parsing

**`apps/owidbot/grapher.py`**

_Implemented; the shapes below are what was built._

- `make_differences_line` reads `verify-results.json`: `counts`, and reports
  differences and errors _separately_ — the entire point is that a suite which
  errored no longer reads as a difference count. A suite with 1 difference and 2
  errors renders `1 ❌ ⚠️ 2 errors`.
- **Five distinct states, in two classes**, which is the whole payoff — don't
  collapse them. "Not run" means nothing was ever supposed to be there; "no
  result" means we expected one and didn't get it, and only that class is
  flagged:

    | State                          | Renders as                                          | Class    |
    | ------------------------------ | --------------------------------------------------- | -------- |
    | file absent                    | `_not run_`                                         | expected |
    | `stale` (leftover, see below)  | `_not run_ (ignored a leftover results file)`       | expected |
    | `running`                      | `⚠️ no result (killed or still running)`            | problem  |
    | `unreadable`                   | `⚠️ no result (results file unreadable)`            | problem  |
    | `ok` / `differences` / `error` | `0 ✅` / `141 (…) ❌ [Report]` / `1 ❌ ⚠️ 2 errors` | ran      |

    `running` deliberately doesn't say "killed": the second owidbot run is gated on
    the tester step, so by then it really is dead — but a run that _overlaps_ a live
    tester sees it too, which is exactly what happened when testing on a staging
    container.

- **Check `grapherCommit` before trusting any of it.** If it doesn't match the
  commit owidbot is reporting on, the file is a leftover a reset failed to clear.
  See [Stale files](#stale-files-and-why-absence-alone-cant-be-trusted).
- **Delete** `get_num_differences` and the `wc -l` path outright — no fallback.
  Also delete the "missing file means skipped, unless it's graphers, then it means
  error" heuristic (`:76`): `status` now says which it is.
- The whole SVG-tester block is omitted when no suite has _fresh_ results — the
  state of the first owidbot run of a build, which precedes the tester step.

### Shape of the change

Paths are arguments rather than reads of the `BASE_DIR` global, so the parsing is
unit-testable without a container:

```python
def load_suite_results(suite_dir: Path, grapher_repo: Path) -> dict | None: ...
def has_results(results: dict | None) -> bool: ...
def read_verify_results(suite_dir: Path) -> dict | None: ...
def is_stale(results: dict, grapher_repo: Path) -> bool: ...
def get_head_commit(repo_path: Path) -> str | None: ...
def get_report_commit(svgs_repo: Path, suite: str) -> str | None: ...
def make_differences_line(results: dict | None, suite_dir: Path) -> str: ...
```

Two sentinels rather than a bare `None` for everything, so the comment can say
_why_ a suite has nothing to report: `{"status": "stale"}` for a leftover and
`{"status": "unreadable"}` for a file that won't parse. `has_results` is what
decides whether the block appears at all — a rebuild whose only files are
leftovers must not resurrect it with rows of noise.

**Malformed or truncated JSON must not raise.** A half-written file is plausible
(the process can be killed mid-write), and an owidbot crash surfaces only as a
soft-failed step — see PR 9 for why the `|| true` around it stays. Unparseable is
its own state, never absent, which would read as "not run" and hide a real
problem.

### The staleness check

Compare `results["grapherCommit"]` against the grapher checkout on the same
container:

```python
from git import Repo   # GitPython is already an etl dependency (etl/git_helpers.py)
Repo(BASE_DIR.parent / "owid-grapher").head.commit.hexsha
```

Rules: if either side is missing, **skip the check and trust the file** — a
false "stale" is worse than the leftover-file case it guards against. Only an
explicit mismatch counts as stale, and a stale file is reported as absent.

Two alternatives rejected:

- **`BUILDKITE_COMMIT` from the environment.** owidbot runs over SSH via
  `as_owid`, which doesn't forward Buildkite's env vars, so the variable simply
  isn't there. Passing it explicitly as a `--commit` flag from `owidbot.sh` would
  work and is cleaner, but it needs an ops change; worth doing later if the
  checkout-based read proves flaky.
- **The PR head sha via the GitHub API** (as `chart_diff.create_check_run` does).
  Wrong value: if someone pushed while the build was running, the results file is
  legitimately one commit behind and would be branded stale.

### Derive the report commit instead of reading `commit.log`

Included in PR 6. Phase 2 items 10–11 delete it along with the whole githack
path, but it fixes a live 404 in the meantime — see below.

`commit.log` is a side-channel file recording state that git already knows, which
is the same pattern PR 5 exists to remove. owidbot runs on the container where
`owid-grapher-svgs` is a real checkout, so the commit is queryable:

```python
Repo(svgs_repo).git.log("-1", "--format=%H", "--", f"{suite}/differences.html")
```

`reset_to_master` rewinds the branch to master at the start of every run and
re-commits, so that history contains only this build's commits and the answer is
unambiguous.

**This is a correctness fix, not just tidying.** Look at what ops actually does:
`create_report` commits `{suite}/originals`, `{suite}/differences` and
`{suite}/differences.html`; `commit_differences` _then_ commits
`{suite}/references` and writes `git log -n 1` to `commit.log`. So the recorded
sha is the commit **after** the report, and the link only works because
`differences.html` is unchanged in that later tree. Both functions end in `|| :`,
so if `create_report` fails (say `create-compare-view.ts` errors) while
`commit_differences` succeeds, `commit.log` is written anyway and the PR comment
links to a report that was never committed — a 404. Deriving the sha from the
path can't produce that: no report commit, no link.

Changes, all in `apps/owidbot/grapher.py`:

- replace `get_commit_id` with
  `get_report_commit(svgs_repo: Path, suite: str) -> str | None`, catching
  `InvalidGitRepositoryError` / `NoSuchPathError` / `GitCommandError` the way
  `get_head_commit` already does, and treating an empty result as None
- call it as `get_report_commit(suite_dir.parent, suite_dir.name)` — no signature
  change to `make_differences_line`, since the repo root and suite name are both
  derivable from the suite directory
- the `([abc123])` link now points at the report commit rather than the
  references commit one later. Same build, and arguably the more accurate target

Tests: a temp repo with a committed `differences.html` returns that sha; a repo
where it was never committed returns None and the row renders with its count and
icon but no link; a non-repo path returns None and logs.

### Tests

`tests/apps/test_owidbot_grapher.py` (new; `tests/apps/test_owidbot_data_diff.py`
is the precedent for testing owidbot rendering). This is pure JSON→string
formatting, so cover all of it with `tmp_path` fixtures: absent, `running`,
`error`, `ok`, `differences`, malformed JSON, and a stale `grapherCommit`. That
last one is the case nobody will exercise by hand.

### Verify

- `make check` (format, lint, typecheck on changed files) and `make unittest`,
  both with `.venv/bin/`, per the repo's rules. Note `make check` rewrites
  `uv.lock` as a side effect of its venv sync — revert that before committing, or
  run `ruff check` / `ruff format --check` / `ty check` directly.
- `etl owidbot owid-grapher/<branch> --services grapher --dry-run`. Needs
  `OWIDBOT_ACCESS_TOKEN`: without one the CLI bails at the GitHub PR lookup before
  reaching any of this code. Calling `grapher.run(branch)` directly exercises
  everything that changed.
- Locally `BASE_DIR.parent` is the checkout's parent directory, so pointing
  `grapher.BASE_DIR` at a temp directory (or dropping a real
  `verify-results.json` next to a real grapher checkout) exercises every state.

**The staging-container check is the one that mattered**, and it can be done
before any of this merges: pushing a branch triggers a normal staging build, so
its container already holds CI-produced results files. Copy the module to `/tmp`
there and load it with `importlib` rather than overwriting `~/etl`. It confirmed
three things no local test can:

- `grapherCommit` is a real sha (`BUILDKITE_COMMIT` reaches the file), not `null`
- `git -C ~/owid-grapher rev-parse HEAD` returns that same sha, so the staleness
  check compares two real values on a container — the path assumption holds
- the `running` placeholder appears in live CI, and an owidbot run that overlaps
  the tester sees it, which is why the wording had to stop saying "killed"

### Rollout

owidbot runs from `~/etl` as cloned when the container was created and the
grapher pipeline never pulls it, so this only takes effect on containers created
after the merge. Existing staging sites keep showing the old comment until
they're recreated — accepted when we dropped backward compatibility, but worth
saying in the PR body so nobody reports it as a bug.

### PR body

etl's conventions differ from owid-grapher's in two ways that are easy to miss:
the attribution line is `> _Written by Claude Opus 5 — @sophiamersmann at the
wheel._` (product + model, not provider + model), and the body must end with the
three open-items buckets — handed off / proposed / unverified.

## PR 7 — owid-grapher: exit code means one thing

Depends on PR 5 (#6911), whose summary object this reuses. Independent of PR 6
and of etl entirely — grapher-only, no waiting on container recreation.

**Safe to merge before the ops change (PR 8).** Once differences exit 0, every
`exit_code_*` in `svg-tester.sh` is 0, the exit-code chain never fires, and the
step goes green — which is the intended end state. `exit 24` simply stops being
produced and `soft_fail` becomes dead config that PR 8 then deletes. The one gap
that remains until PR 8: a genuine _error_ on a `staging-viz` PR is still
converted to 24 and soft-failed, i.e. invisible. That's today's behaviour, not a
regression.

### `utils.ts`

Replace `displayVerifyResultsAndGetExitCode` with `reportVerifyResults(results,
verbose): void` — printing is all it should do now. Deciding the exit code
belongs in `verify-graphs.ts`, from the summary PR 5 already computes:

```ts
process.exit(summary.counts.errors > 0 ? 1 : 0)
```

One source of truth for "did this suite malfunction", rather than a second count
computed for the exit code alone. It also removes the 8-bit masking bug by
construction, since the value is now only ever 0 or 1.

While rewriting the printing, fix what it puts on stdout — safe now that nothing
parses it (PR 6 deleted the `wc -l` path):

- one line per difference (just the viewId), preserving the "easy bash collection
  of failing graph ids" contract the readme advertises
- one line per error: `viewId: message`, **not** the whole `Error` object.
  `console.log(viewId, result.error)` prints a multi-line stack per failure,
  which is what inflated the old line count
- keep the summary counts on stderr via `console.warn`, where they already go

### `verify-graphs.ts`

- exit from the summary as above
- the `catch` block's `process.exit(-1)` becomes `process.exit(1)`: `-1` surfaces
  as 255, the same masking dressed differently

### `Makefile` — the part that's easy to miss

All five targets generate their report _only when verify exits non-zero_
(`:415`, `:422`, `:426`, `:430`, `:434`, `:441`, `:448`, `:455`):

```make
yarn tsx … verify-graphs.ts || (yarn tsx … create-compare-view.ts && open …)
```

Once differences exit 0 that `||` never fires and `make svgtest` silently stops
producing reports. Gate on the differences directory instead, mirroring
`create_report`'s own `[ "$(ls -A $1/differences)" ]`:

```make
yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/verify-graphs.ts
@if [ -n "$$(ls -A ../owid-grapher-svgs/graphers/differences 2>/dev/null)" ]; then \
    yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts && \
    open ../owid-grapher-svgs/graphers/differences.html; \
else echo '==> No differences'; fi
```

Note the side benefit: with the `||` gone, a tester that genuinely fails now
aborts the target instead of being swallowed into "generate a report".

Five call sites means five copies of that block; `svgtest.full` needs four of
them without the `open`. A `define`/`$(call …)` macro would collapse it, at the
cost of some indirection in an otherwise literal Makefile — worth it at five
copies, but flag it in review rather than deciding unilaterally.

Also `.PHONY` (`:40`) lists `svgtest.graphers`, which is not a target and never
has been — the graphers suite runs as plain `svgtest`. Delete it or add the
alias while you're in there.

### Docs

`devTools/svgTester/readme.md:165` states the stdout contract ("no output to
stdout except for failing graph ids"). Update it to say what the machine-readable
output now is — `verify-results.json` — and that stdout is for humans and
shell pipelines.

### Verify

| Case                                              | Expected                                     |
| ------------------------------------------------- | -------------------------------------------- |
| references differ                                 | exit **0**, report generated and opened      |
| clean tree                                        | exit 0, prints "No differences", no report   |
| a reference file missing                          | exit **1**, `make` aborts                    |
| `make svgtest.full` with differences in one suite | reports for that suite, others quiet, exit 0 |

To force the first case, remember the md5 fast path: edit a reference SVG **and**
break its md5 in `references/results.csv`, or the run short-circuits to "ok".

## PR 7b — owid-grapher: resync the reference md5 index

_Implemented in #6914, stacked on #6913._

Discovered while silencing the `No difference found even though hash was
different!` warning in PR 7 — that line was the symptom, this is the cause.

`references/results.csv` indexes each reference SVG by md5, and `verifySvg` uses
it as a fast path: equal hash means no difference, skip reading the file. But
`commit_differences` copies newly rendered SVGs over `references/` and commits
them without rewriting the CSV, so after every master run the index describes the
_previous_ references. Measured nine days after a refresh:

| suite         | stale md5s | of    |
| ------------- | ---------- | ----- |
| graphers      | **1,924**  | 4,460 |
| mdims         | 274        | 810   |
| thumbnails    | 34         | 135   |
| grapher-views | 29         | 1,058 |

43% of the graphers suite, roughly tracking how often each suite runs on master.
Not a correctness problem — the comparison falls through to the file content,
which is authoritative — but every stale entry costs a read plus a full text
compare on every run, and used to print a warning saying so.

`devTools/svgTester/update-reference-md5s.ts` recomputes the column from the files
on disk; `make svgtest.md5s` runs it over all four suites. It rehashes everything
rather than tracking what changed, so one run repairs any drift however it arose
and re-running is a no-op.

Two things this does **not** do, both deliberate:

- it doesn't stop the drift — that needs the `commit_differences` call in PR 8
- it doesn't repair the committed CSVs — that's a one-off run on master in
  `owid-grapher-svgs`, committing the four files, which retires today's 1,924
  without waiting for the next monthly refresh

Worth naming the bargain: this is a derived cache kept in sync by remembering to
update it. Rehash-everything makes any single run self-correcting, but it goes
stale again the moment another path writes references without calling it. The
alternative — deleting the md5 fast path and always comparing content — was
considered and rejected: keeping the fast path is worth one call in one script.

## PR 8 — ops: drop the soft-fail machinery

The last Phase 1 change, and the biggest single edit: five things in one file,
because they all touch the same forty lines of `svg-tester.sh` and splitting them
means resolving conflicts against yourself.

### Preconditions

All three must be merged first, for different reasons:

| Merged          | Why                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------- |
| #6913 (PR 7)    | PR 8 keys off exit 2 for differences and exit 1 for a malfunction; neither exists until PR 7 lands                         |
| etl#6623 (PR 6) | this deletes `verify-graphs.log`, which the old owidbot reads — merge order reversed means those PRs report nothing at all |
| #6914 (PR 7b)   | `commit_differences` calls `update-reference-md5s.ts`, which has to exist in the container's grapher checkout              |

### 1. `run_test_suite`: drop the log redirect

```diff
-            yarn tsx … verify-graphs.ts $1 $2 --rm-on-error \
-            '>' ../owid-grapher-svgs/$1/verify-graphs.log
+            yarn tsx … verify-graphs.ts $1 --rm-on-error
```

Nothing reads that file once PR 6 lands, and without the redirect the run's
output reaches the Buildkite log — today stdout goes to the file and only stderr
is visible. Drop the dead `$2` while here: explorers was its only caller
(flagged in ops#594).

### 2. `log_differences`: rewrite it or delete it

**Easy to miss:** it reads `wc -l < verify-graphs.log`, the file step 1 removes,
so it silently starts reporting 0 for every suite. Either delete it — owidbot
already reports the counts on the PR, and the run output is now in the Buildkite
log — or read the real number:

```bash
count=$(as_owid python3 -c "'import json;print(json.load(open(\"owid-grapher-svgs/'"$1"'/verify-results.json\"))[\"counts\"][\"differences\"])'" '2>/dev/null' '||' echo '?')
```

Deleting is cleaner; keep it only if the Buildkite step summary is genuinely
used.

### 3. `create_report` / `commit_differences`: restructure, don't just delete `|| :`

The trailing `|| :` does double duty: it swallows real failures **and** absorbs
the legitimate no-differences case, where `[ "$(ls -A $1/differences)" ]` returns
non-zero under `errexit`. Deleting it alone makes every clean run fail. Extract
the guard:

```bash
has_differences() {
    local count
    count=$(as_owid ls -A owid-grapher-svgs/"$1"/differences '2>/dev/null' '|' wc -l)
    [[ "${count//[[:space:]]/}" -gt 0 ]]
}

create_report() {
    if ! has_differences "$1"; then
        echo "--- No differences ($1), skipping report"
        return 0
    fi
    # … the existing chain, minus the trailing `|| :`
}
```

Keep `set +e` around the report/commit phase and accumulate failures instead of
aborting: one suite's broken report shouldn't skip the remaining suites or the
push. Fail the step at the end if anything failed.

### 4. `commit_differences`: resync the md5 index (see PR 7b)

Between the `cp` and the `git add`:

```bash
cd ../owid-grapher && yarn tsx --tsconfig tsconfig.tsx.json \
    devTools/svgTester/update-reference-md5s.ts "$1"
```

`git add $1/references` then picks up the rewritten `results.csv` along with the
SVGs. Ordering matters: after the SVGs are in `references/`, before the commit,
or it indexes the old files.

### 5. Exit handling: delete exit 24, and decide about master

```diff
-        if [[ "$BUILDKITE_BRANCH" == 'master' ]]; then
-            exit 0
-        elif get_pr_labels | grep -q "staging-viz"; then
-            exit 24
-        else
-            exit $exit_code
-        fi
+        exit $exit_code
```

**A decision, not a mechanical edit:** master currently never fails, because
under the old semantics every difference was a failure and master absorbs
differences by design. Now non-zero means the tester malfunctioned, and that is
worth seeing on master too. Propagating is the honest choice; if a red master
build is unacceptable, say so explicitly in a comment rather than leaving the
old blanket `exit 0` to imply it.

Then `.buildkite/grapher/automated_staging_environment.yml`: remove
`soft_fail: exit_status: 24` and its comment (`:95–97`).

### Cleanup while you are in here

`is_on_master` and `should_run_full_test_suite` guard byte-identical branches —
and did even before ops#594, since `should_run_full_test_suite` is itself
`[[ branch == master ]] || label`. Collapsing them removes a whole arm of the
`if`.

### Verify

| Case                    | Expected                                                             |
| ----------------------- | -------------------------------------------------------------------- |
| PR with differences     | step **green**, report committed, counts in owidbot's comment        |
| PR where a suite errors | step **red**                                                         |
| clean PR                | green, "No differences" per suite, nothing committed                 |
| master run              | references updated **and** `results.csv` resynced in the same commit |

Scripts can be tested by opening an ops branch named after your grapher branch —
`staging-script` resolves it. The pipeline yml cannot: it is uploaded from ops
`main`, so point the Buildkite bootstrap clone at your branch to exercise it.

## PR 9 — dropped: the `|| true` around owidbot is load-bearing

This was going to remove the `'||' true` after the `etl owidbot` invocation in
`templates/owid-site-staging/owidbot.sh`, on the grounds that it hides owidbot
failures. It does — but not gratuitously.

`b0f320a` (2025-12-08, ":bug: Ignore owidbot errors when creating a contqainer")
added it for one specific caller. `owidbot.sh` is invoked from three pipeline
steps, and only one of them lacks `soft_fail`:

| step                              | invocation                                   | `soft_fail`  |
| --------------------------------- | -------------------------------------------- | ------------ |
| **Create staging container**      | `owidbot.sh etl`                             | **no**       |
| Owidbot                           | `owidbot.sh owid-grapher --services grapher` | yes (exit 1) |
| Owidbot – update after SVG tester | same                                         | yes (exit 1) |

That first call runs owidbot purely to announce the staging server, at a point
where the PR may not exist yet and the container's `etl` checkout may not be
ready. Without the swallow, a failure there fails **container creation** and takes
the whole build with it. Removing it wholesale would resurrect that bug in the
most annoying way possible.

The two calls that matter for this phase are already covered at the step level:
they soft-fail on exit 1, so a crashed owidbot shows as a failed-but-not-blocking
step. The `|| true` currently defeats even that, so there is still a real if
smaller loss of signal — worth raising with the ops maintainer (@Marigold) rather
than changing unilaterally. If it is worth fixing, the shape is a targeted
`--allow-failure` flag used only by the container-creation call, which needs a
pipeline edit as well.

## Landing order

```
PR 5 (G, additive)  →  PR 6 (E, reads the contract)
                    →  PR 7 (G, exit codes + Makefile)  →  PR 8 (O, exit policy + md5 resync)
PR 7b (G, md5 index)  — stacked on PR 7, but independent of everything else
PR 9                  — dropped, see above
```

All merged: PR 5 (#6911), PR 6 (etl#6623), PR 7 (#6913), PR 7b (#6914), PR 8
(ops#595). PR 9 dropped.

Verified on real staging builds rather than only in unit tests: a run with
differences soft-failed on a `staging-viz` PR and committed both a report and a
references commit carrying the resynced `results.csv`; a run with no chart changes
came back clean and committed nothing.

**Left undone deliberately.** The one-off repair of master's `results.csv` was
never committed, so the ~1,924 stale rows in the graphers suite are still there
and the first differences run on any branch rewrites most of that file. It costs
nothing to fix later — `make svgtest.md5s` on a clean master checkout of
`owid-grapher-svgs`, then commit the four CSVs.

## Incidental findings

Noticed while implementing and testing PR 5. None of them are Phase 1 work; they
are recorded so they aren't rediscovered from scratch.

- **The md5 fast path makes references look identical when they aren't.**
  `verifySvg` compares the fresh render's md5 against `references/results.csv` and
  returns `ok` on a match _without reading the SVG_, so editing a reference file
  alone is undetectable. It's why testing a difference requires both a stale md5
  in the CSV and changed reference bytes. Following the code comment that
  explained this ("`commit_differences` updates SVGs but never the CSV") is what
  turned up the 43% drift that PR 7b fixes — the comment had been describing a
  live bug as a fact of life.
- **`--chartTypes` doesn't intersect with `--viewIds`.**
  `--viewIds life-expectancy --chartTypes ScatterPlot` verified 554 charts rather
  than zero or one, so the two filters union or one overrides the other. Worth a
  look if anyone relies on combining them.
- **Useful timing datapoints:** 554 graphers charts verify in ~29 s on a dev
  machine with the default `MAX_WORKERS=6`; on a staging container the full
  graphers suite (4,460 charts) takes 134 s and grapher-views (1,058) 97 s. Suites
  are minutes, not tens of minutes — see Problem 7 in the redesign plan, where an
  earlier estimate was an order of magnitude out.
- **`process.exit(-1)` surfaces as 255**, the same 8-bit masking that makes the
  count-based exit code unsafe. Harmless once PR 7 makes failures a plain `1`.
- **GitPython rejects paths under macOS's `/var` symlink.** Test fixtures need
  `Path(tempfile.mkdtemp()).resolve()`; pytest's `tmp_path` is already resolved,
  so this only bites in ad-hoc scripts.

## Rollback

PR 5 and PR 6 are additive and independently revertable. PR 7 and PR 8 must be
reverted together or in the order PR 8 → PR 7: reverting PR 7 alone restores
`exit 24` while ops no longer soft-fails it, which turns every viz PR red — the
same failure mode as landing them in the wrong order.
