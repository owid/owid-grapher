---
name: retrospective
description: Analyze revision-request and approval history across the agentic-writing admin DB to infer concrete improvements for the generate-data-nuggets skill (and, secondarily, investigate-chart, fact-check-data-nuggets, and refine-data-nuggets). Proposes numbered skill-file edits; uses AskUserQuestion to get per-proposal approval before writing anything.
metadata:
    internal: true
---

# Retrospective

Mine the review history in the admin DB to understand what kinds of views get approved vs revised vs rejected, then translate those patterns into concrete proposed edits to the skill files. **Nothing is written to disk until the user explicitly approves each proposal.**

Primarily targets [[generate-data-nuggets]]; secondarily [[investigate-chart]], [[fact-check-data-nuggets]], and [[refine-data-nuggets]].

## Why

Each time a reviewer requests revisions or rejects a view, the comment encodes a signal: something the generator got wrong that wasn't caught by fact-check or refine. Over time these signals accumulate into learnable patterns. The retrospective reads those signals, synthesises the dominant failure modes, and proposes targeted edits so the same mistakes don't recur.

## How storage works

Two tables in MySQL (same as [[review-agentic-writing]]):

- `agentic_writing_lineages` — one row per lineage. Key fields: `lineageKey`, `contentType`, `sourceId`, `ownerUserId`.
- `agentic_writing_versions` — immutable, append-only. Key fields: `lineageId`, `versionId`, `parentVersionId`, `kind` (`initial | decision | revision`), `title`, `description`, `payload` (JSON), `metadata` (JSON), `reviewDecision` (`approved | rejected | request_revisions | null`), `reviewComment`, `reviewedByLabel`.

Access via the admin API (read-only — never mutate the DB directly):

```bash
# List all lineages
curl -sS "http://localhost:3030/admin/api/agentic-writing.json" \
  -H "Authorization: Bearer $OWID_ADMIN_API_KEY"

# Full history of one lineage (all versions in order)
curl -sS "http://localhost:3030/admin/api/agentic-writing/{lineageKey}" \
  -H "Authorization: Bearer $OWID_ADMIN_API_KEY"
```

Fetch every lineage's history. Focus on lineages that have at least one `decision` version with `reviewDecision = "request_revisions"` or `reviewDecision = "rejected"`.

## Steps

### 1. Pull the review corpus

Fetch all lineages and their full version histories. Build a working dataset:

```
lineageKey | sourceId (→ chart slug) | title | description | grapherViews
           | decision history: [(decision, comment, reviewer, timestamp), ...]
```

Identify the three populations:

- **Approved** — latest decision is `approved`.
- **Awaiting revision / rejected** — latest decision is `request_revisions` or `rejected`.
- **Unreviewed** — no decision yet (skip).

If the corpus has fewer than ~10 decided lineages, note this — patterns are suggestive but not reliable.

### 2. Extract failure signals

For each `request_revisions` and `rejected` decision, extract:

- The **comment** (reviewer's stated reason).
- The **title and description** at that version.
- The **chart slug(s)** involved.
- Whether the lineage was subsequently revised and approved (recovery).

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

### 3. Identify positive signals

For approved views, look for patterns in templates, chart types, entity scopes, and time horizons that consistently pass without revision.

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

**Do not read or write any skill files before this question is answered.**

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
