# Add-on: is the SVG tester comparing against the right references?

_A possible add-on to [svg-tester-redesign-plan.md](./svg-tester-redesign-plan.md).
Not scheduled, not blocking anything. Written up because the design was worked out
and the alternative is working it out again._

**Supersedes the `refs.json` line** in the redesign plan's "What lives where", which
sketches a single root-level file. Per-suite files are better, for a reason given
below.

## The question

Every difference the tester reports is only interesting if the references it compared
against were the right ones. When they aren't, the run doesn't fail — it produces
confident, well-rendered, meaningless differences, and the reader has no way to tell
that from a real regression. Today nothing answers "which reference set was this, and
was it the right one".

Four things have to line up, not two: the **dumped data** (`{suite}/data/**`, the
render input), the **reference SVGs** (the expected output), the **manifest** (what
the suite covers), and the **renderer** — the grapher commit under test. Plus the
**environment** the renderer runs in.

The invariant that normally keeps this honest: **master absorbs its differences as
new references on every master run**, so references track master's rendering
continuously. That is _why_ a difference on your branch is normally yours. Nearly
every failure below is a way that invariant quietly breaks.

## Failure cases

| #   | What went wrong                                                                                              | What you see                                                              | Detectable today |
| --- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------- |
| 1   | **Branch behind the reference commit** — references absorbed master commits you don't have                   | Other people's merged work attributed to you                              | No               |
| 2   | **Master absorption silently failed** — the run was cancelled, hit the 60-minute step cap, or `tester_broke` | Master's pending differences appear on every branch until someone notices | No               |
| 3   | **Data refreshed without regenerating references**, or the reverse                                           | Near-total differences                                                    | No               |
| 4   | **Partial refresh** — some suites regenerated, others not                                                    | One suite near-total, the rest clean                                      | No               |
| 5   | **Manifest regenerated** without data or references for the new entries                                      | Render errors, or missing-reference failures                              | Partly           |
| 6   | **Local svgs checkout dirty, on a branch, or unfetched**                                                     | Anything from falsely clean to near-total                                 | No               |
| 7   | **Contaminated branch references** — a pre-ops#596 branch that absorbed its own differences                  | **Falsely clean**: the regression is already the reference                | No               |
| 8   | **Environment drift** — Node, `Intl` or font metrics differ from the machine that rendered the references    | Near-total, usually tiny per-chart diffs                                  | No               |
| 9   | **Coverage gap** — charts published since the last manifest refresh                                          | **Falsely clean, invisibly**                                              | No               |

Cases 7 and 9 are the dangerous ones: they fail toward a green tick. Everything else
fails loud, and loud-but-confusing is a far better problem to have.

**Two things that look like failure cases and aren't.** A stale md5 column in
`references/results.csv` is benign — `verifySvg` documents it: the fast path misses
and it byte-compares the file, so the cost is time, not false differences (item 7b
resynced it anyway, after 43% of the graphers suite had drifted). And the diff
browser's **Interactive** view disagreeing with the SVGs is correct: it renders from
live data while every other view compares renderings from the frozen dump. Expected,
but it presents exactly like case 3, so it will mislead someone eventually.

## Two constraints on any solution

**The differing _fraction_ is the best signal available, and it is free.** "4,460 of
4,460 charts differ" is never "my change affected every chart" — it is case 3, 4, 6
or 8. A scattering of twelve is plausibly yours. The tester already computes
`counts.differences` and `counts.total`, and the viewer already has `changedRatio` per
chart. No new provenance is needed for this at all.

**Git-derived provenance does not work where it is needed most.** The staging
container clones the svgs repo `--depth=1` (`init.sh:125`), which implies
`--single-branch`, and nothing unshallows it. So "when were these references last
updated" and "is the reference commit an ancestor of mine" are not computable there —
`git log` sees one commit. `git rev-parse HEAD` still works, which is why
`svgsCommit` is fine but nothing richer is. **This is the argument for a committed
provenance file rather than clever git queries:** a file needs no history.

## Solutions, in the order worth doing them

Eliminate rather than surface:

1. **Move the reference-set guard into `verify-graphs.ts`.** `svgtest.reset` and CI's
   `reset_to_master` both already guarantee a clean checkout at `origin/master`, but
   running `verify-graphs.ts` directly guarantees nothing — that is the gap case 6
   lives in. One guard at the point every entry path passes through kills case 6, and
   case 7 with it.
2. **Make the refresh atomic** — data, references, manifest and provenance in one
   commit, always. Then the svgs commit alone certifies they are mutually consistent,
   and cases 3, 4 and 5 stop being possible rather than merely visible.
3. **Make a failed master absorption loud.** Case 2 poisons everyone else's branch and
   is currently silent. The redesign plan already wants a Slack summary for master
   runs; the useful content is not "142 charts changed" but "absorption did not
   complete".

Surface, because they cannot be eliminated:

4. **The differing-fraction warning**, on the suite page and in the owidbot line.
   Above a threshold, say it plainly: "3,912 of 4,460 charts differ — that usually
   means the reference set is stale or your branch is behind master, not that your
   change affected all of them." Catches 1, 2, 3, 4, 6 and 8 in one stroke without
   knowing which.
5. **`refs.json`, and check it** (below).
6. **Report coverage age** for case 9. It is the only failure here that is invisible,
   so an age is the only handle available.

**Rejected: running each suite twice**, at the merge-base and at HEAD, to attribute
differences to the branch exactly. It is the only thing that truly eliminates cases 1
and 2, and it is affordable — graphers verifies in ~134 s. But it doubles every run
and adds real machinery to answer a question that 1 and 5 answer well enough.

Where the threshold in 4 should live is genuinely open. A fixed percentage is wrong
across suites (thumbnails is 135 charts, graphers 4,460) and wrong across intent,
since a `staging-viz` PR changing a shared axis component _should_ light up most of
the suite. The label already declares that intent, so the honest version probably keys
off it rather than off a number alone.

## `refs.json`

**Per-suite (`{suite}/refs.json`), not one file at the repo root.** Absorption is
per-suite, so per-suite files make that write conflict-free — and a single root file
cannot express a partial refresh, which is failure case 4. Per-suite files turn case 4
into a string comparison instead of an invisible state. It also sits beside
`top.manifest.json` and `references/results.csv`, which are already per-suite.

**References have two writers, which is the thing that shapes everything else.** A
refresh replaces data, references and manifest wholesale. Master absorption also
rewrites reference SVGs — at whatever commit that build was on. A file that records
only the last refresh is wrong within a day, and the ancestry check is the main reason
to build it.

| Field                                 | Written by                          | For                                                                         | Catches |
| ------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- | ------- |
| `data.generationId`                   | `dump-data.ts`                      | Opaque token minted per dump — the thing references quote back              | —       |
| `data.generatedAt`                    | `dump-data.ts`                      | When the dump ran                                                           | 9       |
| `data.dbSnapshotDate`                 | `dump-data.ts`                      | How old the underlying data is                                              | 9       |
| `data.grapherCommit`                  | `dump-data.ts`                      | The dump writes `config.json` in that commit's schema version               | 5       |
| `data.chartCount`                     | `dump-data.ts`                      | Cheap coverage read against published charts                                | 9       |
| `references.grapherCommit`            | `export-graphs.ts`, **absorption**  | The ancestry check                                                          | 1, 2    |
| `references.renderedAt`               | both                                | Reference age                                                               | 2       |
| `references.fromDataGenerationId`     | `export-graphs.ts`, carried through | Quotes `data.generationId`; a mismatch means one side was regenerated alone | 3, 4    |
| `references.nodeVersion`, `.platform` | both                                | The environment the renderings came from                                    | 8       |

The one non-obvious field is `fromDataGenerationId`. Detecting that data and
references drifted apart does **not** need a hash of 3.8 GB of dumped inputs — it
needs the references to quote the data's stamp, so the check compares two short
strings.

**Optional extra pair:** `references.fullyRenderedCommit` / `fullyRenderedAt`, set
only by a wholesale render and never by absorption. `references.grapherCommit` then
means "newest commit that contributed any reference", which is what the ancestry check
wants, and the pair tells you whether the set is a coherent snapshot or a patchwork of
absorptions. Add it only if patchwork-ness turns out to matter.

**Deliberately out:** any hash of the reference SVGs (`results.csv` is that index);
any hash of the data directory (the generation id does it for nothing); a
`schemaVersion` (same argument the plan already accepted for `verify-results.json` —
don't version a format with one consumer); and `svgsCommit`, which is meaningless
inside a file that lives in the svgs repo.

The run side needs nothing new. `verify-results.json` already carries `grapherCommit`
and `svgsCommit`, and `svgsCommit` is what identifies _which_ `refs.json` was read.
**That pairing is where `svgsCommit` finally earns its keep** — it is currently
written by the tester and read by nothing, which is why it keeps looking like dead
weight.

## Absorption becomes a script

`export-graphs.ts` never runs in CI. Master's absorption is
`cp {suite}/differences/*.svg {suite}/references`, then `update-reference-md5s.ts`,
then `git add {suite}/references` and commit. So naming `export-graphs.ts` as the
writer of the references section leaves the CI path unstamped: master would move the
references forward while `refs.json` kept claiming an older commit. **A provenance
file that silently goes stale is worse than none, because people act on it** — the
ancestry check would tell people to rebase when they needn't, or reassure them when
they shouldn't be.

`update-reference-md5s.ts` runs at exactly the right moment, but it cannot stamp
unconditionally: it has a second, legitimate caller in `make svgtest.md5s`, which is a
_repair_ tool. Stamping there would assert that the references were rendered at the
current commit when nothing re-rendered them — the same lie through a different door.

So: **make absorption its own script.** One `absorb-differences <suite>` that copies
the differences over the references, reindexes `results.csv`, and stamps `refs.json` —
three things that must always happen together, in one reviewable, testable place.
`update-reference-md5s.ts` goes back to being a pure repair tool that never stamps, and
`commit_differences` shrinks to one call plus the commit. Same direction as the rest of
this work: logic out of the shell, into the tester.

Three writers for three events, all TypeScript:

| Event                      | Writer               | Stamps                                                                                        |
| -------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| Data dump (refresh)        | `dump-data.ts`       | `data.*`                                                                                      |
| Wholesale render (refresh) | `export-graphs.ts`   | `references.*`, quoting `data.generationId`                                                   |
| Master absorption (CI)     | `absorb-differences` | `references.grapherCommit`, `renderedAt`, environment; carries `fromDataGenerationId` through |

**One deployment detail:** `commit_differences` stages `git add {suite}/references`, so
a `{suite}/refs.json` outside that directory would be written and then not committed —
the same silent-staleness failure, via git instead of via a missing writer. Widen the
add rather than hiding the file inside `references/`; it describes the data too.

**One expected conflict:** a manual refresh landing while a master build absorbs will
conflict in this file. Master builds are serialised against each other by the
concurrency group, so it is only that pairing, and it is a one-line conflict — but
better expected than discovered.

## How the admin page uses it

**It doesn't see `refs.json`. It sees verdicts.** The existing code already sets this
precedent: `isStale` and `isUnreadable` are derived before the payload leaves the
server, and `svgTesterHelpers.ts` maps them to a single display state.

**The derivation belongs in the tester, not the admin server.** The plan's hard
constraint is one viewer over two origins — the admin now, R2 in Phase 4 — differing
only by a URL resolver. In Phase 4 there is no checkout and no git, so a check that
needs git must be computed where git exists and carried in the payload. If the admin
server computed it, the R2 viewer could never show it, and that is the two-viewers
failure mode this design has been guarding against from the start. So the tester runs
the comparison at run time and writes verdicts into `verify-results.json`; the admin
adds nothing.

The freshness objection — rebase after a run and "you're behind" is out of date — is
already handled: if HEAD has moved, `results.grapherCommit` no longer matches and the
page says the run wasn't against this commit. `isStale` guards every other stamped
fact in that file, so it guards these too.

**The verdicts**, best modelled as a list the viewer loops over rather than a growing
pile of booleans:

- **Data and references were regenerated separately** (`fromDataGenerationId` mismatch)
  — a stop condition; the run tells you nothing.
- **Your branch is behind the references** — actionable in one word: rebase.
- **Environment differs** — differences may be environmental.
- **References or snapshot aging** — a note, not a warning.
- **Provenance unknown** — no `refs.json` at that svgs commit. This matters more than
  it looks, because the file arrives gradually: older commits won't have it, and the
  page must say "unknown" rather than falling through to a confident green.

**Where they show.** On the index, one column — "references from `abc123`, 3 days ago",
the only place a bare hex commit is tolerable — plus a badge when a check fails. On
the suite page, a banner _above_ the diff list, since that is the moment someone is
about to interpret thousands of differences.

**Two things that make it more than decoration.** The banner should change what the
page invites you to do: when a stop condition holds, collapse the diff list behind a
click, because inviting review of thousands of meaningless comparisons is the actual
harm and a warning above a rendered list gets scrolled past. And show at most one
blocking banner, ranked — unreadable or stale results, then data/reference mismatch,
then behind-references, then environment, then aging — or it becomes a wall nobody
reads.

**The diagnosis comes from composing the two.** The fraction says _something is
wrong_; the verdicts say _what_. Near-total differences plus a data mismatch is a
confident diagnosis. Near-total with every check passing is either genuinely your
change or a cause not modelled here — and the page should say that distinction out
loud rather than implying the checks are exhaustive.

## To verify before building

- **Is the grapher checkout on staging shallow?** The ancestry check needs its
  history. The svgs `--depth=1` clone is fine because `refs.json` is a file, but if the
  grapher clone is shallow too, `merge-base --is-ancestor` won't work. Fallback:
  compare `renderedAt` against HEAD's commit date — weaker, since it can't distinguish
  "diverged" from "behind", but it survives a shallow checkout.
- **Where `dbSnapshotDate` comes from.** Assumed available from the snapshot the local
  DB was loaded from; not checked.
- **Whether rendering is platform-sensitive at all.** Text metrics go through
  `string-pixel-width`, which looks table-driven and so platform-independent. If that
  holds, `platform` is cheap insurance rather than a real signal — worth recording
  anyway, so that a mismatch becomes a hypothesis instead of a mystery.
