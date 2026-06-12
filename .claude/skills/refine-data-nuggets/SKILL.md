---
name: refine-data-nuggets
description: Final editorial pass on a fact-checked "data nuggets" JSON file. Sharpens titles, tightens descriptions, flags duplicates, and bumps the file `status` to `refined`. Step 4 of the "data nuggets" pipeline.
metadata:
    internal: true
---

# Refine Data Nuggets

Read a fact-checked "data nuggets" JSON file and apply a final editorial pass: sharpen titles, tighten descriptions, flag duplicates, ensure consistent voice. This is **step 4** (and currently the last) of the pipeline.

You are acting as a senior editor experienced in OWID-style technical writing and content strategy. Your job is polish, not fact-checking — assume the [[fact-check-data-nuggets]] step has already verified the numbers.

## Input

A path to a views file: `data-nuggets/views/{key}-{ts}.json` (typically `status: "fact-checked"`).

## Steps

1. **Read the views file.** If `status` is not `"fact-checked"`, stop and tell the user to run [[fact-check-data-nuggets]] first. Continue only if the user explicitly asks you to refine an unchecked file.

2. **For each view, refine in place:**
    - **Title (≤ ~12 words):** the finding stated plainly. Cut filler ("there has been a"), front-load the headline number/entity, remove indicator-name redundancy if the chart context already implies it. Avoid quote marks, ALL CAPS, and emoji. Don't make titles clickbaity — OWID voice is calm.
    - **Title precision:** the metric must be named explicitly ("China overtook the US **in annual CO₂ emissions**", not just "China overtook the US"); any change-over-time claim needs its baseline year ("has nearly doubled **since 1990**"); use present perfect tense ("has fallen", "has doubled") when the data runs to the present. Fixing these is rewording existing facts, not adding new claims — the year must already appear in the view's text or `time=` param.
    - **Description (≤ 2 sentences):** one sentence stating what the chart shows, one sentence saying why it's interesting. Prose, not bullets.
    - **Cut redundant complement sentences** that merely restate the headline figure's remainder ("The remaining 180-plus countries account for the other 40%"). They add no information and pad the description.
    - **🚫 No new numeric claims.** This is the hardest rule and the easiest to break. **Before** writing any edited title or description, list the numbers already present in the existing fact-checked text. Your edit may only use values from that list — never a percentage, ratio, year, or count that wasn't in the previous version. If you find yourself wanting to add one, stop and either drop the framing, or kick the file back to [[fact-check-data-nuggets]] for verification.
    - **Voice:** factual, accessible, lightly engaged. Match OWID article tone.

3. **De-duplicate.** Scan all views for near-duplicates (same finding stated two ways, same entity comparison at different time windows that collapse to the same point). Mark one as canonical and the others with `metadata.refinement.duplicateOf: "view-XX"` so a downstream surface can suppress them.

4. **Set `keyInsightLevel` where warranted.** This field is chronically over-used — your main job here is to pull it back.
    - **`"key"`** is reserved for views that speak to a **broad audience about the state of the world** — global or near-global facts, especially where the world has changed meaningfully over time. Use the `entities` tag as a gate: **if `entities` is anything other than `["OWID_WRL"]` (or an otherwise genuinely global framing), it is almost certainly not key.** A narrow country comparison is never key, however striking the number. Aim for well under 10% of a file at `"key"`.
        - Key: "Renewables now generate one-third of the world's electricity."
        - Not key (demote to `notable` or `null`): "An 82-fold gap separates Niger from San Marino"; "Denmark's renewable share grew from 15% to 91%."
    - **`"notable"`** — clearly above-average but not a global headline: regional comparisons ("Africa's child-mortality rate is 14 times Europe's"), important single-country stories, strong cross-indicator stories.
    - **`null`** — solid-but-ordinary, or intrinsically niche (most country-pair and single-country views).

    Concretely: scan every `"key"`. If its `entities` aren't purely global, demote it — to `null` for niche country pairs, `"notable"` for single-country or regional stories. Promote a view _to_ `"key"` only if it's a genuine global state-of-the-world shift the generator under-rated. Scope drives appeal: **world > region > country.**

5. **Annotate each view's `metadata.refinement`** in place:

    ```json
    {
        "refinedAt": "2026-05-22T15:30:00Z",
        "refinedBy": "claude-opus-4-7",
        "changes": [
            { "field": "title", "before": "...", "after": "..." },
            { "field": "description", "before": "...", "after": "..." }
        ],
        "duplicateOf": null,
        "notes": "Optional one-liner about the editorial decision, if non-obvious."
    }
    ```

    - `changes` lists only fields you actually touched. Empty array if you made no changes.
    - `duplicateOf` is the `id` of the canonical view this one duplicates, or `null`.

6. **Bump the file-level `status`** from `"fact-checked"` to `"refined"`.

7. **Write the updated JSON back to the same path.** In-place mutation; do not create a new file.

8. **Report a short summary**: how many titles/descriptions were edited, how many duplicates were flagged, how many were promoted to `"key"`.

## Guidance

- **Don't rewrite for the sake of rewriting.** A view that's already clear and tight should pass through with `changes: []`.
- **Don't introduce new numeric claims.** Refinement edits the framing of existing facts; it never adds new ones. If you find yourself wanting to add a number, send the file back through [[fact-check-data-nuggets]] instead.
- **Don't change `grapherViews[]` URLs.** That's part of the data contract — the URL was validated upstream.
- **Don't reorder or drop views.** Stable `id`s and ordering matter for diffing across runs. Mark duplicates with `duplicateOf` rather than removing them — downstream surfaces decide what to suppress.
- **Don't soften corrections** the fact-checker made. If a value was corrected from 92% to 91%, your refinement keeps 91%.
- **Watch for repetitive sentence shapes.** A file where every description starts with "Between X and Y, ..." reads as machine output. Vary the openings.

## Output

The same JSON file at `data-nuggets/views/{key}-{ts}.json`, mutated in place with `status: "refined"` and each view's `refinement` populated. Report counts back to the user.
