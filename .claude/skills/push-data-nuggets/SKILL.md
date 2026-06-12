---
name: push-data-nuggets
description: Push a refined local "data nuggets" JSON file into the admin database. Each view in the file becomes a new lineage with an initial version, owned by the calling user (private editorial state). Idempotent — re-running skips lineages that already exist. Step 5 of the "data nuggets" pipeline, after `/refine-data-nuggets`.
metadata:
    internal: true
---

# Push Data Nuggets

Bridge between the local craft pipeline (generate → fact-check → refine, all writing to `data-nuggets/views/{key}-{ts}.json`) and the shared admin DB. Once a file is `status: "refined"`, push its views to the admin so they appear in your **My drafts** queue.

Each successful push creates:

- one row in `agentic_writing_lineages` owned by the calling user (editorial state: `private`)
- one row in `agentic_writing_versions` (`kind: "initial"`, `review.decision: null`)

The natural key for a lineage is `{sourceId}__{localId}`. Re-pushing the same file is a no-op for already-imported views — only new ones get inserted.

## Auth

Same as `review-agentic-writing`. Export `OWID_ADMIN_API_KEY` and `OWID_ADMIN_BASE` once; the skill's API calls use them.

## Input

A refined views JSON file path. Typical: `data-nuggets/views/{key}-{ts}.json`. The file must have `status: "refined"` (or higher).

## Steps

1. **Read and validate the file.** Confirm:
    - top-level `$schemaVersion === 1`
    - `status` is `"refined"` (warn but allow `"fact-checked"` if the user insists)
    - `views` is an array
    - each view has `id` (used as `localId`), `title`, `description`, `grapherViews`
    - top-level `inputChartSlugs` and `generatedAt` exist (used to derive `sourceId` below)

2. **Derive `sourceId`.** Pattern: `{inputChartSlugs.join("+")}-{generatedAt:YYYY-MM-DD-HH-MM-SS}`. This matches the convention the generate skill uses and keeps `lineageKey` stable across re-runs.

3. **For each view, POST to the admin:**

    ```bash
    curl -sS -X POST "$OWID_ADMIN_BASE/agentic-writing/lineages" \
      -H "Authorization: Bearer $OWID_ADMIN_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$(jq -n \
        --arg sourceId "$SOURCE_ID" \
        --arg localId "$LOCAL_ID" \
        --arg title "$TITLE" \
        --arg description "$DESCRIPTION" \
        --argjson grapherViews "$GRAPHER_VIEWS" \
        --argjson metadata "$METADATA" \
        '{sourceId:$sourceId,localId:$localId,title:$title,description:$description,payload:{grapherViews:$grapherViews},metadata:$metadata}')"
    ```

    The response includes `version` and `alreadyExisted`. Tally `inserted` vs `skipped` for the report.

4. **Surface a one-line summary to the user.** Example:
   `Pushed 18 of 20 views (2 already in DB) — go to http://localhost:3030/admin/agentic-writing to review.`

5. **(Optional follow-up)** The user can now run the `review-agentic-writing` skill, or open the UI, to walk through them.

## Guardrails

- **Don't push a file with `status: "draft"`** — the pipeline expects fact-check and refine to run first.
- **Don't strip `metadata`** (especially `factCheck`, `grapherSlugs`, `refinement`). The admin uses them.
- The push doesn't transition editorial state — newly-pushed lineages are always `private`. Submission and publication are explicit user actions in the admin UI (or via separate API calls).
