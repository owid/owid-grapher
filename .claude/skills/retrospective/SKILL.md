---
name: retrospective
description: Analyze revision-request and approval history from the agentic-writing admin DB, refresh the precedent ledger the generator reads (data-nuggets/REVIEW-LEDGER.md), and propose the small subset of findings that belong in the skill files as rules. Primarily targets generate-data-nuggets, secondarily investigate-chart, fact-check-data-nuggets and refine-data-nuggets. Uses AskUserQuestion for per-proposal approval before writing anything.
metadata:
    internal: true
---

# Retrospective

Mine the review history to understand what gets approved vs revised vs rejected, refresh the precedent ledger the generator reads at drafting time, and propose the narrow subset of findings that genuinely belong in the skill files as rules. **No skill file is edited until the user explicitly approves each proposal.** (Regenerating the ledger is mechanical and doesn't need approval — see below.)

Primarily targets [[generate-data-nuggets]]; secondarily [[investigate-chart]], [[fact-check-data-nuggets]], and [[refine-data-nuggets]].

## Why

Each time a reviewer requests revisions or rejects a view, the comment encodes a signal: something the generator got wrong that wasn't caught by fact-check or refine. Over time these signals accumulate. The job is to route each one to the place it can actually do some good.

**Two tracks, and most findings belong to the second.** A reviewer's objection either is or isn't mechanically checkable:

- **Mechanical** — a number carrying false precision, a title missing its baseline year, an undefined index, an unstated currency basis, a second sentence that doesn't follow from the first. A reviewer objects to these every time, so a rule in the skill file is the right home. These are what this skill proposes.
- **Judgment** — is this interesting? is this pairing justified? is this too obvious for our audience? These do not survive compression into rules. The corpus routinely holds comments pulling in opposite directions ("we need some nuggets that are simple like this for certain audiences" alongside "ya no shit" for a comparably simple one), and a rule distilled from a handful of cases over-generalises in exactly the way that makes a skill file worse. Their home is `data-nuggets/REVIEW-LEDGER.md`, which the generator reads as precedent while drafting, and where the comment stays attached to the case it came from.

So the expected outcome of a retrospective is **a refreshed ledger plus a small number of mechanical rules** — not a long list of new rules. If you catch yourself proposing one that starts "avoid nuggets that are…", it belongs in the ledger.

## How to get the review corpus

Don't hand-roll API calls. `devTools/pullAgenticWriting.ts` snapshots every lineage and its full version history into one JSON file, which is what this skill reads:

```bash
# The staging box holding the reviews (answers unauthenticated over Tailscale)
yarn tsx devTools/pullAgenticWriting.ts --branch data-nuggets

# Or a local admin
yarn tsx devTools/pullAgenticWriting.ts --host http://localhost:3030/admin/api
```

Snapshots land in `data-nuggets/reviews/pull-<timestamp>.json` (gitignored). **Always pull a fresh one.** Reviewing happens on a staging server that is destroyed after two weeks of inactivity, and any snapshot already on disk may predate the reviews you were asked about. Keep the old snapshots — diffing against the previous pull is how you tell which decisions are new (see **Watermark** under Notes).

### Shape of the data

The file is `{pulledAt, source, lineageCount, versionCount, lineages: [...]}`. Each lineage carries `lineageKey`, `contentType`, `status`, `ownerEmail`, `ownerName`, and `versions[]`.

Each version carries `versionId`, `parentVersionId`, `createdAt`, `createdByName`, `kind` (`initial | decision | revision`), `sourceId`, `localId` (e.g. `view-01`), `title`, `description`, `payload`, `metadata`, and `review`.

**The review fields are nested, not flat.** This is the easiest thing in the whole skill to get wrong: a parse looking for a top-level `reviewDecision` matches nothing and silently reports zero decisions on a corpus full of them. Always read through `review`:

```json
"review": {
    "decision": "request_revisions",
    "comment": "…",
    "reviewedAt": "2026-07-29T19:53:59.000Z",
    "reviewedBy": "user-47@example.com"
}
```

`decision` is one of `approved`, `rejected`, `request_revisions`. Sanity-check your parse by asserting the decision count is non-zero before analysing anything.

Also worth reading per version: `payload.grapherViews[]` (the URLs, slugs and query params the nugget pointed at — needed for any finding about chart choice), `metadata.factCheck` (what the fact-checker saw and corrected) and `metadata.refinement.changes` (refine's before/after). When a reviewer objects to something refine introduced, `metadata.refinement` is where you prove it and route the fix there.

Read only. Never mutate the DB — individual view corrections go through [[review-agentic-writing]].

### Refresh the ledger

Immediately after pulling, regenerate the precedent ledger:

```bash
yarn tsx devTools/buildReviewLedger.ts
```

This rewrites `data-nuggets/REVIEW-LEDGER.md` from the newest snapshot — every verdict and comment in full, grouped by chart slug, which is how [[generate-data-nuggets]] consumes it. Unlike the raw snapshots it is committed to git, so the signal outlives the staging server.

Do this on every run, before any analysis. It is the highest-value output of a retrospective, it doesn't depend on your conclusions, and it is purely mechanical — so it needs no approval. Commit it even when the session produces no skill edits at all.

## Steps

### 1. Pull the review corpus

Fetch all lineages and their full version histories. Build a working dataset:

```
lineageKey | sourceId (→ chart slug) | title | description | grapherViews
           | decision history: [(decision, comment, reviewer, timestamp), ...]
```

Identify the populations:

- **Approved** — latest decision is `approved`.
- **Awaiting revision / rejected** — latest decision is `request_revisions` or `rejected`.
- **Unreviewed** — no decision yet (skip these, but count them).

Compute and **lead with the approval rate** (approved ÷ decided) and the **review coverage** (decided ÷ total). These framing numbers matter more than any individual comment and are easy to skim past. A corpus with a very low approval rate is telling you the generator is missing the bar systematically — not that it has a handful of fixable tics — and that should change which proposals you rank first.

**Handle a corpus with no approvals.** This is a live possibility and several steps below otherwise assume it away. If nothing is approved, say so explicitly up front, skip step 3 rather than manufacturing positive signals, and treat the least-criticised `request_revisions` views as the closest available proxy for "nearly there".

**De-duplicate escalations.** A reviewer may decide twice on one lineage — typically `request_revisions` and then `rejected` with a content-free comment like "see previous review". Cluster on the substantive comment only and count the lineage once. But note the escalation itself: it is the strongest signal in the corpus, meaning a round of feedback didn't rescue the nugget, so the underlying idea was unsalvageable rather than merely badly written.

**Check whether anything was actually revised.** If there are no `kind: "revision"` versions, nothing has been through a fix-and-resubmit cycle, so recovery analysis is impossible — say so rather than inferring it.

If the corpus has fewer than ~10 decided lineages, note this — patterns are suggestive but not reliable.

### 2. Extract failure signals

For each `request_revisions` and `rejected` decision, extract:

- The **comment** (reviewer's stated reason).
- The **title and description** at that version.
- The **chart slug(s)** involved.
- Whether the lineage was subsequently revised and approved (recovery).
- The **`metadata.anticipatedCritique`** the generator recorded, where present — and whether it predicted what the reviewer actually said.

Cluster the comments into failure-mode categories. Common ones:

- Factual error / wrong number not caught by fact-check
- Title too long, unclear, or clickbait
- Description speculates or imports outside context
- View too niche / not interesting enough
- Duplicate of another view
- URL doesn't match described data (wrong entities, tab, time range)
- keyInsightLevel over- or under-labelled
- Voice or tone doesn't match OWID style

For each cluster: count, whether the failure originated in generate vs slipped through fact-check/refine, representative example.

**Score the anticipation.** Where views carry `metadata.anticipatedCritique`, compare the objection the generator predicted against what the reviewer wrote, and report a hit rate with examples of both a hit and a miss. This is the only direct measure of whether the precedent loop is working. Read a low rate carefully: it points at the ledger, or at how the generator is reading it, and the fix is usually to that pipe — not a new rule.

### 3. Identify positive signals

For approved views, look for patterns in templates, chart types, entity scopes, and time horizons that consistently pass without revision.

If there are no approvals, skip this step and say so — do not invent positive patterns out of unreviewed views. Instead, harvest the concessions: reviewers often open with one before criticising ("overall I like this nugget, but…", "this at least meets the bar", "speaks to an important global trend"). Those mark the framings closest to working, and are the most useful positive signal an all-negative corpus has to offer.

### 4. Synthesise proposed edits

Translate findings into specific, numbered proposals. Assign each an ID (`P-01`, `P-02`, …). Format:

```
P-01
File:    .claude/skills/generate-data-nuggets/SKILL.md
Section: Writing guidance
Change:  add-rule | strengthen-existing | remove-contradicted-rule | add-example
Finding: [one sentence from the data]
Current text (if replacing):
  "[exact existing text]"
Proposed text:
  "[exact replacement or addition — copy-paste ready]"
Rationale: [why this would have prevented the observed failures]
```

Order by impact (failures prevented × severity). Route fixes for downstream failures to the appropriate skill file.

**Gate every proposal on the mechanical/judgment split** (see [Why](#why)). Before proposing a rule, ask whether a reviewer would object to a violation _every time_, whatever the subject and audience. If the answer is "it depends", drop the proposal — the ledger already carries the case, and stacking a rule on top both over-generalises and inflates a skill file that is already long. Conflict between comments on the same theme is proof the theme is judgment rather than mechanics, so look for it deliberately before you write a rule.

### 5. Present findings and ask for per-proposal approval

Output:

1. A brief summary table: failure mode → count → proposed fix target.
2. The full numbered proposals (P-01, P-02, …) in the format above.
3. Any lucky approvals (superlatives not swept, niche views mislabelled "key", etc.).

Then use **AskUserQuestion** with `multiSelect: true` to collect approval per proposal:

```
Question: "Which of these proposed skill edits should be applied?"
Options: one per proposal — label = "P-01: <6-word summary>", description = one sentence on what it changes
+ an "All of the above" option
```

**Read the target skill files _before_ drafting proposals.** You cannot tell whether a finding is a missing rule or an existing rule being ignored without checking what's already there, and a proposal that restates text already in the file wastes the reviewer's time. Say which case it is in each proposal's rationale — an ignored rule usually needs strengthening with a concrete example from the corpus, or moving to a stage that can actually enforce it, not a duplicate bullet. **Write nothing until this question is answered.**

### 6. Apply approved edits

For each approved proposal:

1. **Read** the target file.
2. Apply the change with the **Edit** tool — use the exact `current text` from the proposal as `old_string`.
3. After all edits, confirm none broke the file structure (check that headers and code blocks are intact).

Summarise what changed and note which proposals were skipped.

## Notes

- **No DB mutations.** Read history only. Individual view corrections go through [[review-agentic-writing]].
- **Preserve intent.** Never silently remove examples or rules that still apply. Prefer additions and clarifications over deletions.
- **Secondary targets.** If a failure traces to fact-check or refine, route the fix there rather than burdening generate.
- **Watch for constraint conflicts.** Some reviewer complaints aren't a missing rule but an existing rule actively causing the problem (e.g. a description length cap fighting repeated requests for more exposition). Those are the highest-value findings and the easiest to miss, because the offending text reads as perfectly sensible in isolation. When several comments ask for something the skills forbid, propose changing the constraint.
- **Watermark.** Record in your output which snapshot you analysed (`pulledAt`, decision count, approval rate). On a rerun, diff against the previous `data-nuggets/reviews/pull-*.json` so you focus on decisions that are new since the last retrospective — findings already turned into skill edits shouldn't be re-proposed as though they were fresh.
