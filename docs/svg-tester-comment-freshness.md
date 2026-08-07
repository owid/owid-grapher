# Add-on: the PR comment has to say which commit it describes

_A small add-on to [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md),
folded into two PRs that are already open: etl#6629 and ops#597. All of it is etl
and ops; `owid-grapher` doesn't change._

## The problem

Push to a branch that has already had a tester run, and for the whole of the new
build the PR comment shows the **previous** commit's difference counts, over an
`_Edited: <now> UTC_` line that presents them as current. There is no indication
that a run is in flight, and nothing corrects the comment until the tester
finishes — up to an hour on a full four-suite run.

The old numbers aren't the problem. Presenting them as this commit's is.

## Why the staleness guard doesn't catch it

`is_stale` (`etl/apps/owidbot/grapher.py:118`) exists for exactly this and can't
fire, because it asks the wrong thing which commit is under test:

```python
return results_commit != get_head_commit(grapher_repo)
```

`~/owid-grapher`'s HEAD is moved to the new commit by `update_grapher`
(`ops/templates/owid-site-staging/grapher-build.sh:77-95`), in the **Grapher
build** step. The first owidbot run
(`.buildkite/grapher/automated_staging_environment.yml:28`) has no `depends_on`
and shares a wait-group with that step, so the two race — and owidbot, a
two-second step, normally wins. At that moment:

- `~/owid-grapher` HEAD = the **previous** commit
- `{suite}/verify-results.json` `grapherCommit` = the **previous** commit

They agree, so the results read as fresh and get re-rendered as this build's.
The leftover file itself isn't cleared until the tester's `git clean -fdx`
(`svg-tester.sh:50-54`), much later in the build.

So the guard only catches genuinely orphaned files, and only after **Grapher
build** has run. The case it was written for — the same branch, a new commit —
is precisely the one it's blind to.

## What has to be true at the end

1. Every number in the comment names the commit it describes.
2. A build with no results for its own commit yet says so, above the numbers it
   does have.
3. Results from an earlier commit stay visible, and stay useful.

(3) is the design decision worth stating outright: **stale results are labelled,
not hidden.** During a re-run the previous commit's counts are usually still the
best information available — most pushes don't change chart rendering — and
dropping them costs a reviewer the report link they had a minute ago. What made
the old behaviour wrong was the missing label, not the old numbers.

That flips the role of the commit stamp. It isn't a defensive extra any more;
it's what makes showing stale results safe, and everything else here depends on
it.

## The model

Four rules, and the rendering falls out of them:

- The block header names **the commit the build is reporting on**.
- A suite whose results are for that commit renders plain.
- A suite whose results are for an older commit renders with the commit they
  came from.
- When **no** suite has results for the header commit, a line above the rows
  says so.

```
SVG tester (def5678)

⏳ No results yet for def5678 — the tester is still running, or it was cancelled.

- graphers: ❌ 141 differences ([report](…)) — from abc1234
- grapher views: _skipped_
- mdims: _skipped_
- thumbnails: ✅ no differences — from 0f21ba9
```

and once the run reports:

```
SVG tester (def5678)

- graphers: ❌ 12 differences ([report](…))
- grapher views: _skipped_
- mdims: _skipped_
- thumbnails: ✅ no differences — from 0f21ba9
```

**Per row, not per block.** Suites go stale independently: on an unlabelled PR
only `graphers` runs (`svg-tester.sh:114-117`), so the other three keep results
from whenever a full run last happened. One header stamp over rows of mixed
vintage would be a new, subtler version of the same lie.

**The header stamp stays anyway**, even though every row is either plain-and-
current or explicitly dated. It names what "plain" means, and it is the only
thing that catches an out-of-order write — see change 3.

## The changes

### 1. Compare against the build's commit, not the checkout

**etl (#6629).** `cli.py` gains a `--commit` option, passed through to
`grapher.run(branch, commit=...)` (call site `cli.py:95`) and down to
`is_stale`, which prefers it and falls back to `get_head_commit` when it's
absent. The fallback is what keeps containers running an older ops harmless.

**ops (#597).** `owidbot.sh` appends `--commit "$BUILDKITE_COMMIT"` to the
invocation at `:45`, gated on `REPO == owid-grapher`. Two reasons the flag goes
there rather than into the pipeline yml: it covers both invocation sites
(`automated_staging_environment.yml:31` and `:120`) in one edit, and the gate
keeps it off the etl pipeline's owidbot runs, whose comment carries chart-diff
and data-diff and must not be put at risk by this. `BUILDKITE_COMMIT` is an
agent-side variable, expanded before the SSH command is assembled, so nothing
has to be forwarded into the container.

**A flag, not an env var.** The commit under test is a parameter of this
invocation, exactly like the branch, which is already a positional argument to
the same command; `apps/owidbot/cli.py` takes all of its per-run inputs as click
parameters, and `etl/config.py`'s env vars are secrets and deployment config.
The one argument for an env var is that an old etl would ignore it instead of
dying on an unknown option — see [Rollout](#ordering-and-rollout), where that
turns out to cost less than the inconsistency would.

Without this the other two changes can't work at all: nothing else on the
container can tell a leftover file from a current one at the time owidbot runs.

### 2. Staleness stops suppressing, starts labelling

Today `load_suite_results` (`grapher.py:75-89`) replaces stale results with a
`{"status": "stale"}` sentinel, `has_results` (`:92`) treats that as nothing, and
the whole block is omitted when nothing is fresh (`:28-30`, `:37-49`).

All three go:

- `load_suite_results` collapses into `read_verify_results` — no sentinel, the
  results are returned as they are. `is_stale` stays a pure predicate and is
  applied at render time, where the answer is needed.
- `make_suite_line` loses its `"stale"` branch (`:141-142`,
  `_skipped_ (ignored a leftover results file)`) and instead appends
  `— from {sha}` to any row whose `grapherCommit` isn't the commit under test.
  The `unreadable` sentinel (`:97-110`, `:144-145`) stays as it is.
- `has_results` becomes "any suite reported **for the commit under test**", and
  it now gates the pending line rather than the block. The block renders
  whenever any results exist at all.

**The pending line's wording admits it can be wrong.** If the tester step is
cancelled or dies before writing anything, the second owidbot run also finds no
current results and would promise a run that isn't coming. There's no signal on
the container that distinguishes the two, so the line says both — the same call
`make_suite_line` already makes for `running` (`:147-149`,
`_running_ (or killed mid-run)`), and for the same reason.

**Why "no suite has current results" is the right trigger** and not something
new: at the second owidbot run of an unlabelled PR, `graphers` is current and
the other three are old, so the line correctly disappears while their rows stay
dated. A four-suite run has all four current. And an owidbot run that overlaps a
live tester sees `graphers` with `status: "running"` for the current commit —
current, so no pending line, and the row says `_running_`. Every case falls out
without a new flag.

### 3. Stamp the block with the commit under test

`SVG tester (def5678)` in the block header, linked to the commit on GitHub, from
the value change 1 supplies.

This is the only part that covers **overlapping builds**. `svg-tester` is
serialised per branch by its concurrency group (`:92-93`); owidbot isn't. So
build N's post-tester run can land *after* build N+1's first run and re-assert
N's numbers — each build internally consistent, the comment globally wrong.
Ordering can't fix that, because the comment is per-PR and builds are
per-commit. The header is what makes such a write legible: a reader who knows
what they pushed can see the block is about something else.

**Rejected: refusing out-of-order writes** by parsing the sha out of the
existing comment and bailing if it's newer. `cli.py:104-121` already reassembles
the body from the existing comment section by section; adding a second,
different notion of "this write is obsolete" to that path buys accuracy in a
rare case at the cost of a comment that sometimes silently declines to update.

## Tests

`tests/apps/test_owidbot_grapher.py`, new, and narrower than the Phase 1 plan's
version — which was specified, never written, and rightly so: it would have
restated the shape of a markdown line. What is worth locking down is the logic
this adds, none of which has an obvious reading:

- **Commit precedence:** an explicit commit wins over the checkout HEAD (the
  case the whole change exists for); no explicit commit falls back to HEAD (old
  ops); neither available → not stale, trusting the file, as today.
- **The pending line** appears when no suite has results for the commit under
  test, and disappears as soon as one does — including the mixed case, one
  current suite and three old ones, which is what every unlabelled PR looks
  like.
- **A stale row keeps its counts and its report link** and names its own commit.
  This is the behaviour someone will later mistake for the bug this document is
  about, so it should fail loudly if anyone "fixes" it back to hiding.

`tests/apps/test_owidbot_data_diff.py` is the precedent for the fixture style.

## Ordering and rollout

**etl#6629 first, then ops#597** — already the stack's required order, so this
adds no new constraint, which is the main reason for folding the changes into
those two PRs rather than opening a third and fourth with their own ordering
notes.

The asymmetry is the usual one: ops changes reach every open PR the moment they
merge, etl changes only reach containers created afterwards (`~/etl` is cloned
at container-create and the grapher pipeline never pulls it).

**Accepted risk.** A container created before etl#6629 merges gets the new ops,
and its old etl exits on click's unknown option. `owidbot.sh:45` ends in
`|| true`, so the step stays green and the existing comment is left untouched —
i.e. today's behaviour. The real cost is a *new* PR on such a container never
getting its grapher block at all, which also carries the site-screenshots,
archive and bespoke links. Bounded by container recreation, silent, and the same
shape of window the stack has already accepted twice (Phase 3 PR 1's 404-ing
report route; the redesign plan's wrong-comment window). Worth a sentence in the
ops PR body.

## Not doing

- **Hiding stale results** — the first version of this plan dropped the block
  during a re-run and said so in one line. It fixes the lie and throws away the
  answer: on most pushes the previous commit's counts and report are still what
  a reviewer wants to look at while the new run goes. Labelling costs one
  suffix per row and keeps them.
- **Progressive updates from `svg-tester.sh`** — an owidbot call after
  `reset_to_master`, or after each suite. The comment already becomes honest at
  the build's first owidbot run; this only buys per-suite progress on the ~1h
  four-suite runs, and it makes the tester step depend on owidbot.
- **Clearing `verify-results.json` in `grapher-build.sh`.** Removes the symptom
  by leaving nothing to be stale about — which is now exactly the wrong
  direction — and adds another cross-step filesystem dependency, item 3 of the
  redesign's problem list.
- **Reading `COMMIT_SHA` from `owid-grapher/.env`.** Written by
  `grapher-build.sh:35`, so it loses the same race.
- **The PR head sha from the GitHub API.** Rejected in Phase 1 because a push
  during a build brands legitimately-behind results as stale. Harmless now that
  stale means "dated", not "dropped", but it is a network call to answer a
  question the build already knows the answer to.

## Verify

- `make check` and `make unittest` from `.venv/bin/` per the etl repo's rules —
  note `make check` rewrites `uv.lock` as a side effect; revert that before
  committing.
- Locally: `grapher.run(branch, commit=...)` against a temp `BASE_DIR` holding
  hand-written `verify-results.json` files, for the precedence cases and for a
  mixed block — one suite current, one dated, two absent.
  `etl owidbot owid-grapher/<branch> --services grapher --dry-run` needs
  `OWIDBOT_ACCESS_TOKEN` or it bails at the PR lookup before reaching any of
  this.
- On a container, after both merge and on a freshly created one: push twice to a
  branch in quick succession and watch the comment across the two builds. The
  check is that during the second build the header names the new sha, the
  pending line is there, and the old counts are still readable and dated with
  the first sha.
