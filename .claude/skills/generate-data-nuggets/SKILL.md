---
name: generate-data-nuggets
description: Given one or more OWID chart slugs (and ideally an existing investigation report), generate a JSON file of "data nuggets" — short, comprehensible, link-backed views of the data that a casual user would find engaging. Step 2 of the "data nuggets" pipeline.
metadata:
    internal: true
---

# Generate Data Nuggets

Given one or more OWID chart slugs (and ideally an existing report from [[investigate-chart]]), write a set of brief "data nuggets" that surface engaging slices, comparisons, and stories from the data. Each view points the user at a specific OWID grapher URL (or a small collage of URLs) that displays exactly the data being described.

This is **step 2** of the "data nuggets" pipeline. Output is a JSON file consumed by [[fact-check-data-nuggets]] and [[refine-data-nuggets]].

You are acting as an experienced Python developer and data communicator working with the OWID ecosystem.

## Input

One or more chart slugs (e.g. `child-mortality`, or `gdp-per-capita-worldbank oil-production`). Optionally a path to an existing report at `data-nuggets/reports/{key}-*.html`.

## Steps

1. **Fetch the raw data** for each input slug:

    ```
    https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=false
    ```

2. **Read all existing artifacts** for this set of slugs:
    - `data-nuggets/reports/{key}-*.html` — investigation reports (HTML, read as plain text)
    - `data-nuggets/views/{key}-*.json` — any prior view files (avoid duplicating earlier views)

    Use the latest report by timestamp as the primary input if multiple exist. The report is HTML — you can read it as text; the content is the prose, tables, and metadata, not the styling.

3. **Use `data-nuggets/.scratch/`** for any working files. Do not pollute the repo root.

4. **Read the URL reference doc** at [`grapher-url-parameters.md`](../_shared/grapher-url-parameters.md). Every URL you emit must use only parameters from `GRAPHER_QUERY_PARAM_KEYS` (canonical source in `packages/@ourworldindata/types/src/grapherTypes/GrapherTypes.ts`).

5. **Draft 8–15 data nuggets** that vary along the dimensions described in the **Variety** section below. Each view is a self-contained slice of the data that is **(a)** comprehensible without OWID context, **(b)** backed by specific values from the data, and **(c)** pointable-at via a working grapher URL.

6. **Validate every URL.** For each view, mentally walk through what the URL would render and check it matches the description. Validate:
    - Every key is in the documented set.
    - Every entity in `country=` / `focus=` / `mapSelect=` exists in the data.
    - **The rendered entities exactly match the text.** Always set an explicit `country=` param listing precisely the entities the title/description names — never rely on the chart's default selection (it will render entities your text doesn't mention), and never include extra comparison lines the text doesn't discuss. If the title says "five countries", the chart must show exactly five.
    - `tab=` matches the chart type you're describing.
    - `time=` falls within the data's actual coverage — **for each selected entity**, not just the chart overall. An entity with no data at the selected year silently drops out of the rendered chart.

7. **Write the views** to `data-nuggets/views/{key}-{YYYY-MM-DD-HH-MM-SS}.json` using the schema below. `{key}` is the input slug (single-chart) or slugs joined with `+` in the order given (multi-chart) — preserve user order so the key is predictable.

## Output schema

```json
{
    "$schemaVersion": 1,
    "inputChartSlugs": ["child-mortality"],
    "generatedAt": "2026-05-22T14:32:00Z",
    "generatedBy": "claude-opus-4-7",
    "status": "draft",
    "views": [
        {
            "id": "view-01",
            "title": "Child mortality has fallen 91% globally since 1800",
            "description": "Two short sentences describing what's shown and what's interesting. Stay factual; avoid speculation; the values cited here must come straight from the data.",
            "grapherViews": [
                {
                    "slug": "child-mortality",
                    "url": "https://ourworldindata.org/grapher/child-mortality?tab=line&country=OWID_WRL&time=earliest..latest",
                    "queryParams": {
                        "tab": "line",
                        "country": "OWID_WRL",
                        "time": "earliest..latest"
                    },
                    "caption": null
                }
            ],
            "metadata": {
                "grapherSlugs": ["child-mortality"],
                "entities": ["OWID_WRL"],
                "createdAt": "2026-05-22T14:32:00Z",
                "createdBy": "claude-opus-4-7",
                "approvedAt": null,
                "approvedBy": null,
                "publishedAt": null,
                "publishedBy": null,
                "embedding": [],
                "keyInsightLevel": null,
                "factCheck": null,
                "refinement": null
            }
        }
    ]
}
```

### Schema field notes

- `status`: always `"draft"` at the end of this step. Downstream skills bump it to `"fact-checked"` then `"refined"`.
- `views[].id`: stable, zero-padded per file (`view-01`, `view-02`, ...).
- `views[].title`: short and scannable. Aim for ≤ 12 words. State the finding, not a category.
- `views[].description`: 2 sentences max. Factual and accessible — OWID-article voice. No bullets.
- `views[].grapherViews`: array with **1 or more** entries.
    - A single-chart view has one entry.
    - A multi-chart "collage/carousel" view (e.g. GDP jump + oil-production jump for the same country) has multiple entries. Use `caption` to label each chart's role in that case.
- `views[].grapherViews[].queryParams`: parsed object. Keys must come from `GRAPHER_QUERY_PARAM_KEYS`.
- `views[].grapherViews[].url`: fully constructed URL. Must be consistent with `queryParams`.
- `views[].metadata.grapherSlugs`: deduplicated list of all slugs referenced by this view's `grapherViews`, in first-appearance order.
- `views[].metadata.entities`: **the focal entities the view spotlights**, as entity codes (`["NER", "SMR"]`, `["OWID_AFR", "OWID_EUR"]`, `["OWID_WRL"]`). This is a relevance tag: a reader interested in those entities should find the view relevant. Rules:
    - If the view uses `focus=`, the focal entities are the focused ones.
    - Otherwise they're the entities in `country=` that the view is actually _about_ (drop pure-context entities — e.g. a world line shown only for scale).
    - A purely global view is `["OWID_WRL"]`.
    - Use this honestly: "An 82-fold gap separates Niger from San Marino" is `["NER", "SMR"]` — relevant to people interested in Niger or in the poorest places, but **niche**, not global. That niche-ness should be reflected in a low `keyInsightLevel`.
- `views[].metadata.embedding`: leave as `[]`. A future step will populate.
- `views[].metadata.keyInsightLevel`: `null` (default), `"notable"`, or `"key"`. **Be conservative — see the calibration below.** Most views are `null`.
- `views[].metadata.factCheck` / `refinement`: leave as `null`. Filled by later skills.

### keyInsightLevel calibration

This is the single most over-used field. Get it right at generation time so the refine step has less to undo.

- **`"key"`** — reserved for a _small minority_ of views (aim for well under 10%). A key view speaks to a **broad audience about the state of the world** — typically a global or near-global fact, especially where the world has changed meaningfully over time. Examples: "Renewables now generate one-third of the world's electricity"; "Global child mortality has fallen 91% since 1800". **A narrow country comparison is never key**, no matter how striking the number. "An 82-fold gap separates Niger from San Marino" is not key. "Denmark's renewable share grew from 15% to 91%" is not key.
- **`"notable"`** — clearly above-average and worth featuring, but not a global headline. Regional comparisons ("Africa's child-mortality rate is 14 times Europe's"), important single-country stories, and strong cross-indicator stories live here.
- **`null`** — solid but ordinary, or intrinsically niche (most country-pair and single-country views).

Rule of thumb on scope vs. audience: **world > region > country** for breadth of appeal. The world and regions aggregate across interesting variation, so they reach a broader audience; a single-country or country-pair view is intrinsically narrower. A genuinely global state-of-the-world shift is the only thing that earns `"key"`.

## Variety

A good generation run varies across these axes:

- **Time horizon:** some views span the full available history; others zoom to a specific recent decade or year.
- **Entity scope:** some are global; some compare a handful of notable entities; some focus on a single entity in context.
- **Direction of finding:** positive trends, ongoing challenges, surprises, milestones, persistent gaps.
- **Statistical lens:** absolute levels vs. rates of change vs. ratios/multiples vs. rankings.
- **Audience:** some accessible to a general visitor; some that reward a more careful reader.
- **Chart type:** mix `line`, `discrete-bar`, `map`, `scatter`, `stacked-area`, etc. — whichever genuinely matches the view.

## View templates

These are templates for inspiration, **not an exhaustive list and not a checklist**. Pick what the data actually supports, and feel free to invent variations.

### "State of the world"

A global or near-global fact about where things stand — strongest when the state has **changed meaningfully over time**. Broadest possible audience; this is the template most likely to earn `keyInsightLevel: "key"`.
_E.g. "Renewables now generate one-third of the world's electricity"; "Global child mortality has fallen 91% since 1800."_

### "Interesting entity"

A country (or region) whose story is interesting in its own right. Of interest to people _in_ that place, but also to anyone who then wonders "what happened there?" Interesting entities tend to be **outliers** — relative to the world or to their peers — in current state or in change over time. Sub-types worth thinking of as their own templates:

- **Outlier in level** — sits far from peers right now (e.g. a Gulf state's per-capita emissions).
- **Outlier in change** — moved far more (or less) than peers over time (e.g. "Denmark's renewable share grew from 15% to 91% in 25 years").
- **Cross-indicator micro-story** — a small narrative where one indicator's move explains another's (e.g. "Equatorial Guinea's oil came online in the late 1990s and lifted GDP 14-fold"). Only possible with multi-chart input.
- **Counterintuitive / thematic** — multiple indicators move in surprising directions, or the entity exemplifies a broader theme like growth–emissions decoupling (e.g. "Germany has grown 48% richer and cut CO₂ per person by 49%").
- **Interesting because flat** — the entity barely moved while its peers and the world changed a lot. Flatness is a story when it's against the grain.

Scope tradeoff: a region (or the world) reaches a broader audience than a single country but aggregates away interesting variation. "Africa's child mortality vs. Europe's" has far broader appeal than "Niger's vs. the UK's." Prefer the broadest scope that still preserves the interesting signal.

### "Country view for the country's sake"

Readers with a particular interest in a country often just want to **see where their country sits in context** — even if its trend isn't otherwise remarkable. A bar chart of Canada's maternal mortality against its peers is interesting to a Canadian regardless of whether Canada is an outlier. These views are tagged with that single country in `entities` and are usually `null` keyInsightLevel (niche but valuable for the right reader). Use `peerCountries` or an explicit peer set (see below) to build the comparison.

### "Top / bottom N"

The N highest or lowest entities — defined either by **current state** ("The ten highest under-five mortality rates in 2023 are all in Sub-Saharan Africa") or by **change over time** ("The 5 countries with the fastest growth in life expectancy since 1990"). Render as `tab=discrete-bar` for a single year, or `tab=line` with the N entities selected for a trend.

### Other useful angles

- **Sudden change** — a sharp rise or fall over a short window.
- **Trend reversal / U-shape** — direction flips.
- **Convergence / divergence** — groups pulling together or apart.
- **Long-run perspective** — value today vs. 50, 100, or 200 years ago.

## Cross-cutting themes

Independently of template, OWID likes views that touch these recurring themes. Tag-worthy framings, not separate templates — a "state of the world" or "interesting entity" view can also carry one of these:

- **"The world is improving"** — long-run progress that's easy to lose sight of. _E.g. "China and South Korea each cut their child mortality by 98% since 1960."_
- **"The world is still terrible in some ways"** — large remaining gaps and unsolved problems. _E.g. "Africa's child-mortality rate is 14 times Europe's."_

Aim for a mix across a generation run; both themes are true at once and the contrast is part of what makes the data engaging.

## Finding peer countries

Several templates (especially "country view for the country's sake" and outlier-vs-peers comparisons) need a sensible set of **peer countries** for a given entity. Two ways to get them:

1. **Let grapher choose, via the `peerCountries` query param.** This is the easiest — no computation needed. Valid values:
    - `peerCountries=neighbors` — geographically neighboring countries
    - `peerCountries=gdpPerCapita` — countries with similar GDP per capita
    - `peerCountries=population` — countries with similar population
    - `peerCountries=parentRegions` — the entity's continent, income group, and World
    - `peerCountries=dataRange` — a spread of countries across the data's range
    - `peerCountries=auto` — grapher picks (defaults to neighbors)

    Example: `?country=~CAN&peerCountries=gdpPerCapita&tab=discrete-bar&time=latest` selects Canada plus economically-similar peers. The `peerCountries` key is in `GRAPHER_QUERY_PARAM_KEYS`, so it passes URL validation.

2. **Compute peers yourself** when you want to name them explicitly in `country=` (and in `entities`). The building blocks live in `@ourworldindata/utils`:
    - `getParentRegions(name)` — the entity's continent + income group + World aggregates.
    - `getContinentForCountry(name)` and `getCountryNamesForRegion(region)` — to enumerate same-continent peers.
    - For income-group peers, intersect with the relevant `OWID_HIC | OWID_UMC | OWID_LMC | OWID_LIC` membership.

    For a quick interactive lookup you can also just inspect the regions data — e.g. continent and income-group membership — and hand-pick 4–6 recognizable peers. Prefer well-known countries so the comparison is legible.

When in doubt, the `peerCountries=parentRegions` param gives the cleanest, most defensible context (the country against its continent, income group, and the world) with zero computation.

## Writing guidance

- **Clear the "so what?" bar.** Skip findings a general reader already assumes are true ("global CO₂ emissions have risen", "the world population has grown", "a new record was set last year" for a steadily rising series). For monotonic long-run trends, the nugget is the **change in pace** — acceleration, plateau, or slowdown — not the direction itself.
- **One nugget, one point.** Each view should make exactly one observation. If a finding contains a second point (a gap that has also widened over time, the pace of a decline after a peak), split it into its own view rather than appending it — reviewers consistently ask for multi-point nuggets to be split.
- **No causal explanations the displayed data doesn't directly support.** Don't write "the decline reflects deindustrialisation and the shift to renewables" when the view only shows an emissions line. Either cut the "why" (leave deeper context to articles and data insights), or add a chart to the view that actually shows the explanatory variable (e.g. a population chart to support "the reason is population growth").
- **Precise titles.** Name the metric explicitly ("China overtook the US **in annual CO₂ emissions**", not just "China overtook the US"). Any change-over-time claim needs its baseline year ("has nearly doubled **since 1990**"). Use present perfect tense ("has fallen", "has doubled") when the data runs to the present.
- **Every numeric claim must come from a computation you ran in this session.** Before writing "X fell from A to B" or "the ratio is N×", actually compute A, B, and N from the CSV and copy the printed result. Memory and estimation are forbidden. Investigation reports are a good starting point but do not exempt you from re-confirming any value you cite.
- **OWID article voice**: factual, accessible, lightly engaged. Avoid sensationalism and speculation.
- **No social/political context** in the description text — leave it to the data.
- **No bullets in `description`.** Write prose.
- **Don't invent entities.** Only use entity codes/names that appear in the CSV's `Code` and `Entity` columns.
- **Don't reuse the same `(title, description)` shape across views.** A run that's mostly "X has fallen by Y% since Z" is boring.
- **Don't repeat earlier insights.** Read prior view files for these slugs and skip already-covered angles. Add the angle as a fresh view only if you can say something materially new.
- **Multi-chart views are valuable but rarer.** They need a genuine story across indicators, not just two unrelated charts pasted together. If the multi-chart input doesn't yield strong cross-indicator stories, generate single-chart views instead.

## Output

A single JSON file at `data-nuggets/views/{key}-{YYYY-MM-DD-HH-MM-SS}.json`. Report the path back to the user so they can pass it to [[fact-check-data-nuggets]] next.
