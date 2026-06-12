---
name: fact-check-data-nuggets
description: Verify every claim in a draft "data nuggets" JSON file against the underlying OWID data. Annotates each view in place with a `factCheck` block and bumps the file `status` to `fact-checked`. Step 3 of the "data nuggets" pipeline.
metadata:
    internal: true
---

# Fact-check Data Nuggets

Read a draft "data nuggets" JSON file and ruthlessly verify every claim against the raw OWID data. Annotate each view in place with a `factCheck` block. This is **step 3** of the pipeline, between [[generate-data-nuggets]] and [[refine-data-nuggets]].

You are acting as a data journalist / science communicator's fact-checker. Your job is rigor: every number, every comparison, every trend assertion must be backed by the data, or it gets flagged.

## Input

A path to a views file: `data-nuggets/views/{key}-{ts}.json` (typically `status: "draft"`).

## Steps

1. **Read the views file.** If `status` is not `"draft"`, warn but proceed — re-running fact-check on an already-checked file is sometimes useful.

2. **Fetch the raw data** for every slug listed in `inputChartSlugs` **and** every additional slug appearing in any `views[].grapherViews[].slug` (multi-chart views may legitimately reference slugs beyond the input set):

    ```
    https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=false
    ```

    Cache loaded DataFrames so you only fetch each slug once per run.

3. **For each view, check every claim.** Specifically:
    - **Numeric claims:** every value cited in `title` or `description` (e.g. "fell 91%", "$11,219", "5.91%") must be reproducible from the CSV with simple operations. Recompute it.
    - **Trend claims:** "rising", "falling", "doubled", "tripled", "U-shape" — verify by checking the time series for the entity(ies) named, over the period implied.
    - **Comparison claims:** "X times more than", "the highest", "the lowest", "above the world average" — verify against the actual values in the relevant year.
    - **Period framing:** "since 1990", "in 2024" — verify the data actually covers that period for the entities named.
    - **Superlatives — special attention.** Words like _only_, _first_, _largest_, _worst_, _highest_, _lowest_, _fastest_, _never_, _unprecedented_ are easy to write and hard to verify. For each one, run a sweep that would disprove it: if a view claims "the only multi-year reversal since 1950," compute year-on-year diffs across the full series and look for counterexamples. Spot-checking the cited numbers is not enough — the superlative is its own claim.

4. **Validate each `grapherViews[]` entry**:
    - The `slug` must resolve to a live chart — the CSV fetch in step 2 establishes this.
    - Every key in `queryParams` must be in `GRAPHER_QUERY_PARAM_KEYS` (canonical source: `packages/@ourworldindata/types/src/grapherTypes/GrapherTypes.ts`).
    - Every entity code/name in `country`, `focus`, `mapSelect` must appear in the relevant chart's `Code` or `Entity` column.
    - The `tab=` value must be one of the documented options (see [`grapher-url-parameters.md`](../_shared/grapher-url-parameters.md)).
    - `time=` range must intersect the data's actual year coverage. **Check per entity**, not just for the chart as a whole — if `time=1900..latest` is set but one selected entity's data starts in 1950, that's a minor issue worth flagging (the chart will trim, but the framing in the description may overstate coverage).
    - **Every entity in `country=` must have data at the selected time — especially for single-year views (`time=latest`, `time=2024`).** An entity with no observation at that year silently drops out of the rendered chart; a title saying "Five countries…" over a chart rendering four is a **major** issue. Verify the count of entities that will actually render matches any count stated in the title or description.
    - **The rendered entities must exactly match the entities the text discusses.** Flag any extra entity in `country=` that the title/description never mentions (a stray comparison line), and any missing `country=` param on a `tab=discrete-bar` or `tab=line` view (the chart's default selection will render entities the text doesn't cover). Treat these as `corrected`-level fixes: adjust `country=` to exactly the entities the view is about.
    - The constructed `url` must be consistent with `queryParams` (no missing or extra params).

5. **Decide a status per view:**
    - `passed` — every claim and every URL detail checks out as-is.
    - `corrected` — there were issues but they were small enough to fix in place (a wrong year, an off-by-a-decimal value, an invalid `tab`, a missing entity in `country=`). Update the view's fields and record what changed.
    - `issues_found` — there are claims that can't be fixed cleanly (e.g. the data simply doesn't support the framing). Leave the view's content alone, list the issues, and flag for human review.

6. **Annotate each view's `metadata.factCheck`** in place:

    ```json
    {
        "checkedAt": "2026-05-22T15:01:00Z",
        "checkedBy": "claude-opus-4-7",
        "status": "passed",
        "issues": [
            {
                "field": "description",
                "severity": "minor",
                "claim": "fell 92% since 1800",
                "actual": "fell 91.4% since 1800",
                "resolution": "corrected"
            }
        ]
    }
    ```

    Field rules:
    - `status`: one of `"passed"`, `"corrected"`, `"issues_found"`.
    - `severity`: one of `"minor"`, `"major"`.
    - `resolution`: one of `"corrected"` (fixed in place), `"flagged"` (left for human review), `"noted"` (non-blocking observation; status can still be `"passed"`).
    - `issues` is typically `[]` for `status: "passed"` but a `"passed"` status can carry `"noted"`-resolution entries when something is worth recording but not problematic (e.g. rounding clarifications, partial entity coverage).
    - If you edited `title` or `description`, also add `originalTitle` / `originalDescription` keys to the `factCheck` block to preserve the pre-fix text for audit. Omit those keys entirely when you did not edit the field.

7. **Bump the file-level `status`** from `"draft"` to `"fact-checked"`.

8. **Write the updated JSON back to the same path.** This is an in-place mutation — do not create a new file.

9. **Report a short summary** back to the user: counts by status (passed / corrected / issues_found), and a brief listing of any `issues_found` views so the user knows what needs human review.

## Guidance

- **Be rigorous, not pedantic.** Rounding differences in the third significant figure aren't worth flagging; an off-by-a-decade or wrong-direction trend is.
- **Don't soften flagged issues.** If a claim is wrong, say so plainly in the `issues[].actual` field. The point of this step is to catch problems before refinement.
- **Don't rewrite for style.** Style is the next skill's job. Touch `title` / `description` only when correcting a factual error.
- **Don't introduce new claims.** Your corrections should adjust existing claims to match the data, not invent new framings.
- **Preserve view IDs and ordering.** Don't reshuffle the array.

## Output

The same JSON file at `data-nuggets/views/{key}-{ts}.json`, mutated in place with `status: "fact-checked"` and each view's `factCheck` populated. Report counts back to the user.
