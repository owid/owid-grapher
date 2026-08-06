# Phase 2: stop duplicating the reference set

_Execution detail for Phase 2 of [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md)._

**Done** — ops#596. One PR, two changes to `svg-tester.sh`, +9/−13. It deleted
the largest write in the pipeline and established the invariant the viewer in
Phase 3 depends on. Kept for the finding and the test evidence; delete it once
Phase 3 has moved on.

This phase used to be four items. The other two — an nginx `/svgtester/` alias
(item 10) and swapping owidbot's report link from githack to that alias (item 11)
— were a bridge to serving the report over HTTP from the staging container. Item
19 does that better, through the admin server, with no nginx change at all, so
building the bridge would mean writing two PRs and then deleting them. They are
struck through in the redesign plan rather than removed, so the reasoning
survives. Splitting the Buildkite step (item 13) was dropped separately.

## The finding that shrank the phase

The plan asserted that `originals/` exists because `commit_differences`
overwrites `references/` after the report is generated, so the report could not
point at `references/` until it stopped being served from a git commit. The first
half is true; the conclusion is not.

Look at the order in `svg_tester()`: every `create_report` runs, and only then
does every `commit_differences` run. So the report commit (call it C1) is created
_before_ the reference-overwrite commit (C2), and `get_report_commit` resolves to
C1 — because it is the last commit to touch `{suite}/differences.html`, and C2
does not touch it. At C1 the tree still holds the pre-run references, and the
report's `<img src="references/…">` URLs are relative, so githack resolves them
inside C1's tree. They are the correct "before" images.

The same is true on disk at generation time: `create_report` runs before
`commit_differences`, so `references/` and `references/results.csv` are still
master's when `create-compare-view.ts` reads them.

So `-r originals` could always have gone, and the dependency runs the other way.
What _actually_ requires `commit_differences` to stop on branches is reading
those images from the **live checkout**, where there is no pinned commit to
protect them from being overwritten seconds later. That is exactly what the
viewer does — hence this PR must precede item 19.

## The change

### 1. Delete the `originals/` duplicate

At ~127 KB per reference SVG, a 500-difference run commits ~65 MB of duplicated
charts that already exist in `references/` at the master commit in the same tree
— permanently, in a pack that cannot be pruned without rewriting history.

```diff
     as_owid cd owid-grapher-svgs \
-        '&&' mkdir $1/originals \
-        '&&' cp $1/references/results.csv $1/originals \
-        '&&' 'for f in '"$1"'/differences/*.svg; do cp '"$1"'/references/$(basename $f) '"$1"'/originals/$(basename $f); done' \
-        '&&' cd ../owid-grapher \
+    as_owid cd owid-grapher \
         '&&' yarn tsx --tsconfig tsconfig.tsx.json devTools/svgTester/create-compare-view.ts $1 \
-            -r originals \
             --compare-url $STAGING_URL \
         '&&' cd ../owid-grapher-svgs \
-        '&&' git add $1/originals $1/differences $1/differences.html \
+        '&&' git add $1/differences $1/differences.html \
         '&&' git commit -m "'🤖 ($1) html report triggered by commit $GRAPHER_COMMIT_URL'"
```

Drop the flag rather than passing `-r references`: `references` is already the
yargs default (`create-compare-view.ts:14`, `:104`), and `make svgtest` has
always relied on it. Deleting the flag is what makes CI and local generate the
report from identical inputs — one fewer divergence, for free.

`create-compare-view.ts` needs no change. It reads `{referencesDir}/results.csv`
via `utils.parseReferenceCsv`, which is why the old code copied the CSV into
`originals/` too; pointed at `references/` it finds the real one.

### 2. Absorb differences on master only

A branch is never merged into the svgs repo, so copying its differences over
`references/` and committing them achieves nothing today — and it is what would
make the Phase 3 viewer show before == after.

```diff
-    echo "--- Commit SVG differences"
-    for suite in "${suites[@]}"; do
-        commit_differences "$suite" || tester_broke=1
-    done
+    if is_on_master; then
+        echo "--- Commit SVG differences"
+        for suite in "${suites[@]}"; do
+            commit_differences "$suite" || tester_broke=1
+        done
+    fi
```

While in `commit_differences`, delete the trailing `commit.log` write:

```diff
-        '&&' git log --format="'%H'" -n 1 '>' $1/commit.log
```

Nothing has read it since etl#6623 replaced it with
`git log -1 -- {suite}/differences.html`; the Phase 1 plan documents why deriving
it is a correctness fix rather than tidying.

## What this does and does not change

- **Master is untouched.** `commit_differences` still runs there, still resyncs
  the md5 index via `update-reference-md5s.ts` (PR 7b), still commits the new
  references. That is the one place absorbing differences is meaningful, and
  keeping it is what leaves a permanent reference history in git after Phase 3
  stops committing everything else.
- **`update-reference-md5s.ts` stops running on branches**, which is correct: the
  references it would describe are no longer being changed.
- **The report and the push stay, for now.** `create_report` still generates and
  commits `differences.html`, and the branch is still force-pushed, so the
  githack link keeps working until item 19b replaces it. Item 20a deletes the
  report and item 18 deletes the push.
- **The compare view gets less noisy.** It used to show the same charts twice,
  once under `differences/` and once under `references/`.
- **One failure mode disappears on branches:** `commit_differences` can no longer
  set `tester_broke`.

## Verify

Tested end to end before merging, in three layers. The rig: an ops branch and a
grapher branch of the same name (`staging-script` resolves the ops branch by
name), the grapher one carrying `DOT_RADIUS` 3.5 → 5 in `SlopeChart.tsx` —
a change scoped to the 17 slope charts, giving a report small enough to read in
full. owid-grapher#6917, since closed.

**Layer 0, local, no container.** `make svgtest` already invokes
`create-compare-view.ts` with no `-r`, and locally `commit_differences` never
runs, so a local run is a faithful simulation of the new CI path. Report
generated, before/after correct. This is the cheap test for the claim that
actually matters, and it needs no staging at all.

**Layer 1, staging, run with differences.** Soft-failed on exit 24, as expected
for a `staging-viz` PR. graphers 17 — exactly the slope charts, nothing leaked in
— grapher-views 105, mdims 0, thumbnails 0. Both reports render correct
before/after images. No `originals/` anywhere; `references/` clean and identical
to master; no `commit.log`. owidbot showed all four rows with chips and links.

One expectation was wrong and is worth recording: a four-suite run produces **one
report commit per suite with differences**, not one commit total —
`create_report` commits per suite. Two commits here.

**Layer 2, staging, clean run.** Reverting the constant made the branch render
identically to master. Green in 5m06s, all four suites `ok`, 6,463 charts, zero
differences. **No commits above master and a clean working tree** — a clean branch
run now leaves the svgs repo entirely untouched. The empty-`differences/` path
behaves: `verify-graphs.ts` creates the directory unconditionally, so
`list_differences` returns empty rather than failing, and `create_report` takes
its `-z` early return.

**Not tested: the master arm.** Its body is unchanged apart from the deleted
`commit.log` write; the new part is the `is_on_master` wrapper. Watch the first
master run with differences after the merge — the failure mode would be master
silently absorbing nothing, which is quiet rather than loud.

## Incidental findings

Recorded so they are not rediscovered.

- **`originals/` has been redundant for as long as the report commit has preceded
  the references commit.** Nobody checked whether the pinned-commit URL already
  protected the "before" images; it did.
- **`commit.log` had been dead since etl#6623** and was still written on every
  run until this PR.
- **Phase 0 item 4 never landed.** Found while preparing this phase: svgs
  `origin/master` still held `explorers/`, there was no reference-refresh commit
  after Phase 1's `.gitignore` change, and the branch count had reached 936. The
  redesign plan claimed the item was done.
- **Phase 1's md5 repair was sitting uncommitted** in the `alternative`
  owid-grapher-svgs checkout — all four `results.csv` files modified. `make
svgtest` runs `svgtest.reset`, whose `git reset --hard origin/master` discarded
  it during Layer 0. Regenerated with `make svgtest.md5s` and committed (svgs
  `97839fff37`): 1,924 of 4,460 graphers rows were stale, plus 29 grapher-views,
  274 mdims and 34 thumbnails, and every changed row differed in the `md5` field
  alone. Phase 1's last piece of leftover work, now closed.
- **The references are current.** Layer 1 found graphers differing by exactly the
  17 charts under test, despite grapher master being 25 commits ahead of the
  commit the references were last written from. Master CI has been keeping them
  in sync, so the overdue reference refresh is hygiene rather than a correctness
  problem.
- **The svgs repo is force-pushed on master too.** `git push --force origin
  $BUILDKITE_BRANCH` runs unconditionally, and on master that is a force-push to
  master. `reset_to_master` re-fetches first, so the window is narrow, but a
  concurrent manual `refresh.sh` could be clobbered. Not fixed here; item 18
  removes the branch push and should revisit the master one.
- **`gzip_types` in `owid.cloud` omits `image/svg+xml`**, so the site serves SVGs
  uncompressed. Irrelevant to this phase now that nginx isn't serving reports,
  but worth a one-word fix whenever someone is next in that file.

## Rollback

Single PR, independently revertable, with one caveat: once item 19 has landed,
reverting the `commit_differences` half puts the viewer back to showing
before == after. Revert 19b first if it comes to that.
