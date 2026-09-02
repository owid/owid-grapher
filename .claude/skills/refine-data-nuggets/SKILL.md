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

    Then read `data-nuggets/REVIEW-LEDGER.md` — the sections for this file's chart slugs, plus any entry sharing its structure. A large share of what reviewers send back is editorial rather than factual (phrasing, false precision, an unexplained term, a title that doesn't say what it's about), which is squarely your remit and your last chance to catch it. Treat those comments as precedent rather than rules: they tell you what this reviewer notices, not what the answer is.

2. **For each view, refine in place:**
    - **Title (≤ ~12 words):** the finding stated plainly. Cut filler ("there has been a"), front-load the headline number/entity, remove indicator-name redundancy if the chart context already implies it. Avoid quote marks, ALL CAPS, and emoji. Don't make titles clickbaity — OWID voice is calm.
    - **Title precision:** the metric must be named explicitly ("China overtook the US **in annual CO₂ emissions**", not just "China overtook the US"); any change-over-time claim needs its baseline year ("has nearly doubled **since 1990**"); use present perfect tense ("has fallen", "has doubled") when the data runs to the present. Fixing these is rewording existing facts, not adding new claims — the year must already appear in the view's text or `time=` param. Also: the title must name the domain it is about (one a reader can't place without the chart has failed); it must state the direction of the finding rather than leaving it to be inferred; prefer numerals to written-out fractions ("75%", not "three-quarters"); and cut trailing subordinate clauses that qualify the finding ("British inequality surged in the 1980s and never fully receded" → "British inequality surged in the 1980s").
    - **Description (2–3 sentences):** one sentence stating what the chart shows, one saying why it's interesting, and — only where the view needs it — one defining a threshold, index, unit or aggregate entity the reader can't be assumed to know. Prose, not bullets. Don't use a third sentence to fit in another finding; that's a second nugget.
    - **Sentences must follow one another.** Each sentence has to read as a continuation of the one before. A second sentence introducing a fact the first never hinted at ("Africa's decline began late…" after an opening that only stated a gap) is an orphan — rewrite it to extend the opening claim, or cut it.
    - **Plain phrasing over compressed phrasing.** Unpack literary constructions into direct statements: "A band of countries that peaked around 1990 has been shrinking for three decades" → "The populations of several Eastern European countries peaked around 1990 and have been shrinking for decades". Split any sentence carrying both a semicolon and an em-dash into two.
    - **Round to human-readable numbers.** Two decimals on an index, not three; "$2k" and "$3.4k", not "$2,037" and "$3,437"; "over 50%", not "51.6%". State the basis of any currency figure. Keep bare index values (an HDI of 0.878, a gain of +0.060) out of the prose entirely — they carry no meaning for a general reader and cause disengagement. **Rounding a number or dropping one is not a new numeric claim**, so this is squarely within your remit; adding one is not.
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
- **Preserve inline description links.** Keep any `[text](url)` Markdown link the generator added; you may reword the link text for tone, but don't drop the link, repoint it elsewhere, or add a new link to a source you haven't verified.
- **Don't reorder or drop views.** Stable `id`s and ordering matter for diffing across runs. Mark duplicates with `duplicateOf` rather than removing them — downstream surfaces decide what to suppress.
- **Don't soften corrections** the fact-checker made. If a value was corrected from 92% to 91%, your refinement keeps 91%.
- **Watch for repetitive sentence shapes.** A file where every description starts with "Between X and Y, ..." reads as machine output. Vary the openings.

## Output

The same JSON file at `data-nuggets/views/{key}-{ts}.json`, mutated in place with `status: "refined"` and each view's `refinement` populated. Report counts back to the user.
