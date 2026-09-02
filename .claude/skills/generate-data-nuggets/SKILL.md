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

Alternatively (or in addition), the input can be **a piece of OWID written content** — a topic page, article, or data insight (by URL or path). In that mode you generate nuggets that carry the piece's points across the site and link back to it; see [Generating from a piece of OWID content](#generating-from-a-piece-of-owid-content) below.

## Steps

1. **Fetch the raw data** for each input slug:

    ```
    https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=false
    ```

2. **Read all existing artifacts** for this set of slugs:
    - `data-nuggets/reports/{key}-*.html` — investigation reports (HTML, read as plain text)
    - `data-nuggets/views/{key}-*.json` — any prior view files (avoid duplicating earlier views)
    - `data-nuggets/REVIEW-LEDGER.md` — every past reviewer verdict and comment, grouped by chart slug. **Read the section for each of your slugs, plus every entry sharing the structure you intend to use.** See [Learning from past reviews](#learning-from-past-reviews).

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

## Learning from past reviews

`data-nuggets/REVIEW-LEDGER.md` holds every reviewer verdict and comment to date, grouped by chart slug. Regenerate it with `yarn tsx devTools/buildReviewLedger.ts` after a fresh `pullAgenticWriting` run. After the investigation report this is the most useful input to this step, because it is the only place a human has said what they actually think.

**Read it as precedent, not as rules.** Most of what a reviewer objects to is a judgment about whether a nugget is interesting or comprehensible enough, and those judgments are context-dependent in ways a rule can't capture. The same reviewer who dismissed one simple regional comparison as "common knowledge" also wrote that "we need some nuggets that are simple like this for certain audiences." Compressing that into a rule would be a mistranslation; compressing it into "here is what they said, and here is why I think it does or doesn't apply to mine" is not.

What to read, in order:

1. **Every entry under each slug you're generating for.** The strongest signal by far. Much of the feedback is indicator-specific — how to present a composite index, which comparison groups are meaningful for this metric, what counts as common knowledge in this domain. If a past nugget on your chart was sent back, assume the same objection is live for yours until you can say why it isn't.
2. **Every entry sharing your intended structure** (the ledger's structure index). Multi-chart pairings in particular carry recurring objections that single-chart views don't.
3. **The remainder**, while the ledger is still short enough to read in one pass.

Then, for each nugget you draft, record what you expect the reviewer to say in `metadata.anticipatedCritique` (see the schema below). Two reasons it earns the keystrokes:

- It forces the precedent to bear on the draft, rather than being read and forgotten.
- It makes the prediction checkable. [[retrospective]] compares what you anticipated against what the reviewer actually wrote, which is the only real measure of whether this loop works at all.

Be honest in that field: "no close precedent" is a legitimate and useful answer, and a fabricated objection is worse than none. And don't let an all-criticism corpus make you timid — a nugget that superficially resembles a rejected one is not thereby doomed, and the absence of an approved example of some framing says nothing about that framing.

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
            "description": "Two or three short sentences describing what's shown and what's interesting — plus, where the reader needs it, one defining an index, threshold or aggregate entity. Stay factual; avoid speculation; the values cited here must come straight from the data.",
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
                "anticipatedCritique": {
                    "precedent": "prevalence-of-undernourishment+child-mortality-2026-06-16-22-44-07__view-01",
                    "objection": "Pairing two indicators that both track income was dismissed as too obvious to publish.",
                    "assessment": "Partly applies — this pairing is also income-correlated, so the description states what the second chart adds instead of leaning on the correlation itself."
                },
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
- `views[].description`: **2–3 sentences.** Two is the default: what the chart shows, and why it's interesting. Add a third **only** where it earns its place by defining a threshold, index, unit or aggregate the reader can't be assumed to know — see [Exposition](#exposition). Never a third sentence carrying an extra finding; that's a second nugget. Factual and accessible — OWID-article voice. No bullets. May contain at most one inline link in Markdown `[text](url)` syntax — see [Links in descriptions](#links-in-descriptions).
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
- `views[].metadata.anticipatedCritique`: what you expect a reviewer to object to, grounded in `REVIEW-LEDGER.md`. An object of `{precedent, objection, assessment}` — the closest past entry (its `lineageKey`, or `null` if there genuinely isn't one), the objection that entry recorded, and your honest read on whether it applies here and what you did about it. Never invent a precedent to fill the field. See [Learning from past reviews](#learning-from-past-reviews).
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

These are templates for inspiration, **not an exhaustive list and not a checklist**. Pick what the data actually supports, and feel free to invent variations. They are organized below by **comparison structure** — how many entities you show and how you relate them — because that structure is the easiest lever for ensuring variety across a run. Cutting across all of them are the "why is this interesting?" framings (outlier in level, outlier in change, flat-against-the-grain, etc.) and the cross-cutting themes — covered after the structural templates.

A good run mixes several of these structures rather than leaning on one.

### 1. Single-entity time series

The trajectory of **one entity** that is interesting in its own right. Most compelling for **noteworthy entities** where the standalone series carries weight: the World, a continental/regional average, or a very recognizable country (China, the United States, India). For the World or a near-global aggregate this is the **"state of the world"** template — the broadest-audience view and the one most likely to earn `keyInsightLevel: "key"`, especially when the state has changed meaningfully over time.
_E.g. "Global child mortality has fallen 91% since 1800"; "Renewables now generate one-third of the world's electricity."_
Render as `tab=line` with a single entity in `country=`. A single ordinary country's flat or unremarkable series usually doesn't clear the "so what?" bar on its own — give it context (template 2) instead.

### 2. Entity vs. region / world

One entity shown **against the global or its regional average**, where the contrast is the point. Use this to spotlight an outlier without the clutter of many lines — the reference line does the work of "compared to what?".
Common shapes:

- **Divergence** — entity and reference started together and pulled apart (e.g. inequality fell far faster here than in the rest of South America).
- **Convergence** — entity started far from the reference and has caught up.
- **Sustained gap** — entity has sat persistently above/below its region.

This is often the **best way to draw attention to a single entity**: broader appeal than a bare single-country line, far less visual clutter than an entity group. Use `peerCountries=parentRegions` (continent + income group + World) or an explicit `country=` listing the entity plus its regional/world aggregate.

### 3. Paired entity comparison

**Two entities** shown together because the comparison itself is the story. Works well for:

- **Peer pairs** — natural comparators like Japan vs. South Korea, or China vs. the US. Use the peer-finding tools below to pick defensible pairs (the right peers depend on the indicator).
- **Crossed trajectories** — two countries that started similar and diverged sharply, or started far apart and converged.

Render as `tab=line` with exactly the two entities in `country=`. Keep it to two so both lines read clearly in a thumbnail.

### 4. Entity group (3+)

**Three or more entities** where you genuinely need the group to make the point — e.g. one country standing apart from a set of high-income peers. **Use sparingly:** thumbnails are small, and several lines quickly become illegible. It only works when the entity of interest has a line that visibly stands out from the pack. When in doubt, prefer template 2 (entity vs. a regional average) to make the same point with one clean reference line. If you do use a group, set `focus=` on the entity you want to draw attention to.

### 5. Top / bottom N

The N highest or lowest entities. Two angles:

- **By current level** — "The ten highest under-five mortality rates in 2023 are all in Sub-Saharan Africa." Often common knowledge, so less surprising.
- **By change (first derivative)** — the N entities with the biggest increase, smallest increase, or biggest decrease over a defined window. **Usually the more interesting angle**, because rates of change are less widely known than current rankings.

Render as `tab=discrete-bar` for a single-year ranking, or `tab=line` with the N entities selected for a trend. Keep N small enough to stay legible (≈5 for lines).

### 6. Cross-country correlation (scatter)

A **scatterplot** thumbnail surfacing a relationship across countries (e.g. one indicator against another, or against GDP per capita). Simple but often striking. Render with `tab=scatter`. Requires the chart to actually support a scatter (two indicators, or a built-in scatter view).

### 7. Explanatory within-country correlation (multi-chart)

A **titled multi-chart** view showing two-plus series for the **same country** where one helps _explain_ the other — e.g. a rise in GDP per capita alongside a rise in oil production, where the oil boom plausibly accounts for the income jump. The value is comprehension: the second chart tells you _where_ the first trend came from.
Use with care — correlation is not causation. Reserve this for cases where the explanatory link is strong and near-undeniable (a dramatic, contemporaneous co-movement). Only possible with multi-chart input; use `caption` to label each chart's role.

### 8. Curious within-country contrast (multi-chart)

A **titled multi-chart** view for the same country where two indicators move in **counterintuitively divergent** ways — the contrast is the insight. E.g. life expectancy or HDI rising much faster than peers _without_ a comparable rise in GDP per capita; or fertility falling despite stagnant income. Like template 7, multi-chart and `caption`-labelled, but here the hook is the tension between the series rather than one explaining the other.

### 9. Geographic / map snapshot

A `tab=map` view showing the **spatial distribution** of an indicator — "where in the world is this high or low." Core OWID, broadly legible in a thumbnail, and reaches a wide audience. Two angles: a single-year snapshot (e.g. "malaria deaths are concentrated in a belt across central Africa"), or a map of **change** over a window. Use `tab=map` with `time=` for the year (or `time=YYYY..YYYY` where the chart supports a change map). The map shows all entities by default, so usually no `country=` is needed — but confirm the year has broad coverage so the map isn't full of gaps.

### 10. Composition over time (stacked area / bar)

How a **whole breaks into its parts** and how that mix shifts — e.g. the electricity mix by source, or deaths by cause. The story is the changing composition, not any single series. Use `tab=stacked-area` (or `stacked-discrete-bar`), and `stackMode=relative` when the share-of-total is the point rather than the absolute totals. Strongest for data that is naturally a set of components summing to a meaningful whole (energy, emissions by source, mortality by cause).

### 11. Region vs. region

Two or more **aggregates** compared directly — Africa vs. Europe, low-income vs. high-income countries. Structurally like an entity group (template 4) but built from regional/income aggregates, which gives it far broader audience than named countries while keeping the thumbnail clean (a handful of well-separated lines). A natural home for the "world is still terrible in some ways" theme (large, persistent between-region gaps). Use `tab=line` or `tab=discrete-bar` with the aggregate entities (e.g. `OWID_AFR`, `OWID_EUR`, or income-group codes) in `country=`.

### 12. Concentration / "the few that dominate"

The hook is the **concentration of the distribution itself** — "the top 10 countries account for ~70% of global X." Render as a sorted `tab=discrete-bar` for a single year, optionally paired with the share-of-total figure in the description. Best where inequality across entities is itself the surprising fact.

### 13. Reframing the same metric (per-capita ↔ total, share ↔ absolute)

The same underlying data **normalized differently to flip an intuition** — e.g. a country is the largest _absolute_ emitter but middling _per capita_, or a small total emitter but very high per person. Usually a multi-chart view (an absolute chart plus a per-capita chart, `caption`-labelled), or a single chart toggled with `stackMode=relative`. The insight is that the ranking or story reverses under the alternative framing. Multi-chart variants need both indicators available as charts.

### "Country view for the country's sake"

Cutting across templates 2–4: readers with a particular interest in a country often just want to **see where their country sits in context** — even if its trend isn't otherwise remarkable. A bar chart of Canada's maternal mortality against its peers is interesting to a Canadian regardless of whether Canada is an outlier. These views are tagged with that single country in `entities` and are usually `null` keyInsightLevel (niche but valuable for the right reader). Use `peerCountries` or an explicit peer set (see below) to build the comparison.

### "Why is it interesting?" framings (cut across the structures above)

Independently of how many entities you show, an entity earns a spot because of one of these — useful for deciding _which_ entity to feature:

- **Outlier in level** — sits far from peers right now (e.g. a Gulf state's per-capita emissions).
- **Outlier in change** — moved far more (or less) than peers over time (e.g. "Denmark's renewable share grew from 15% to 91% in 25 years").
- **Interesting because flat** — barely moved while its peers and the world changed a lot. Flatness is a story when it's against the grain.
- **Sudden change** — a sharp rise or fall over a short window.
- **Trend reversal / U-shape** — direction flips.
- **Long-run perspective** — value today vs. 50, 100, or 200 years ago.
- **Crossover / overtaking** — the specific moment one entity passes another (e.g. "China overtook the US in annual CO₂ emissions in 2006"). Lives on a paired-entity (template 3) line chart, but the _event_ is the hook.
- **Milestone / threshold crossing** — the point a series crosses a meaningful round number ("global life expectancy passed 70"; "more than half the world now lives in cities"). The threshold supplies the "so what?".
- **Before / after a known shock** — an entity's trajectory around a discrete event (a pandemic, war, famine, or major policy). Keep the window tight so the break in trend is visible, and respect the no-causation rule — show the break, don't over-claim the mechanism.
- **Anomaly / single-year spike** — a transient one-year deviation that returns to trend (a famine or disaster mortality spike, a recession dip). Distinct from _sudden change_, which is a sustained shift rather than a blip.
- **Catch-up / leapfrogging** — a late starter overtaking early leaders, or skipping a development stage entirely (mobile phones without landlines). Related to _crossover_, but the hook is specifically the leapfrog narrative.
- **Saturation / S-curve plateau** — rapid growth that flattens as it nears a ceiling (vaccination coverage approaching 100%, urbanization leveling off). The story is the _approach to the limit_, distinct from a reversal.
- **Acceleration / inflection (change in pace)** — for a monotonic series the nugget is the _second derivative_: where the trend sped up, slowed, or hit an inflection point, not the direction itself (e.g. "the decline in child mortality accelerated sharply after 2000"). This is the go-to angle for an otherwise-obvious long-run trend.
- **Punches above / below its weight (surprising peer)** — an entity whose outcome is wildly out of step with what a related metric would predict ("X has the life expectancy of a country several times richer"). The mismatch is the hook; pairs naturally with a scatter or a per-capita reframing.
- **The gap itself, closing or widening** — treat the _difference_ between two series as the quantity of interest and track whether it narrows or widens over time. Sharper than a generic convergence/divergence framing because it foregrounds the gap as the metric.
- **Myth-busting / counter to expectations** — the data contradicts a widely-held assumption; the "so what?" is the correction itself. Use carefully — the assumption being overturned must be genuinely common, not a strawman.

Scope tradeoff: a region (or the world) reaches a broader audience than a single country but aggregates away interesting variation. "Africa's child mortality vs. Europe's" has far broader appeal than "Niger's vs. the UK's." Prefer the broadest scope that still preserves the interesting signal — and remember **a narrow country comparison is never `keyInsightLevel: "key"`**, no matter how striking the number.

## Visual formats

The templates above are about the **framing** — what makes a slice of data worth showing. This section is the orthogonal question: **which chart type best renders that framing**. It's a menu of the visual formats grapher offers, not a list of nugget ideas — a single framing can usually be drawn several ways, so pick the format that makes the point most legibly **in a small thumbnail**.

Set the format with `tab=` (and the listed modifiers). Only use a format the chart actually supports — `tab=map` needs `hasMapTab: true`; `scatter`, `slope`, and `marimekko` need the chart to offer that view. When unsure, fall back to `line` or `discrete-bar`, which nearly every chart supports.

Core formats:

- **Line (`tab=line`)** — the default for change over time. Best for 1–5 series; more lines than that turn to spaghetti in a thumbnail.
- **Discrete bar (`tab=discrete-bar`)** — a single-year cross-section ranking across entities. The natural format for top/bottom N and concentration.
- **Stacked discrete bar (`tab=stacked-discrete-bar`)** — single-year composition, one bar per entity broken into components.
- **Stacked area / bar (`tab=stacked-area`, `tab=stacked-bar`)** — composition over time. Add `stackMode=relative` to show shares-of-total rather than absolute magnitudes.
- **Map (`tab=map`)** — geographic distribution in a chosen year. Supports `region=` to zoom a continent, `globe=1` for the 3-D globe, and `mapSelect=` to highlight entities.
- **Scatter (`tab=scatter`)** — the relationship between two indicators across entities at a point in time.
- **Table (`tab=table`)** — the raw data table. Rarely the most engaging thumbnail, so prefer a true chart format; use only when exact values across a few entities are themselves the point.

Specialized formats (use when they genuinely fit):

- **Connected scatter (`tab=scatter` + `time=A..B`)** — traces one or a few entities' joint path through a two-indicator space over time; a "development trajectory." `endpointsOnly=1` shows just the start and end points.
- **Slope (`tab=slope`)** — connects each entity's value at year A to year B; a clean way to show who rose and who fell across a window without a multi-line tangle. Crossing slopes (reranking) read instantly.
- **Marimekko (`tab=marimekko`)** — a value on the y-axis with a second weighting (often population) as bar _width_, so you see both a rate and how many people it applies to.
- **Dumbbell (`tab=dumbbell`)** — one row per entity with two points (e.g. two years, or two indicators) joined by a bar, sorted across entities. The most direct format for the _gap itself_ and _before/after_ framings: each connector's length is the change, comparable across entities at a glance.
- **Faceting (`facet=entity` or `facet=metric`)** — a grid of small-multiple mini-charts; use only when the _repetition_ of a pattern across entities or indicators is itself the point, since each facet gets tiny.
- **Log scale (`yScale=log`)** — a modifier on a line/scatter view: constant growth _rates_ become straight lines, exposing exponential dynamics and making wide-range comparisons legible. Use sparingly — a casual reader can misread a log axis.

### Make the thumbnail carry the claim

The chart is evidence for the sentence, not decoration. Before finalising a view, ask whether someone who reads the title and glances at the thumbnail can see the thing being claimed.

- **A rank claim needs a ranked chart.** "The US slipped from 1st to 19th" drawn as a five-country line chart shows nothing legible; a `discrete-bar` of the top 20 with the US focused shows it instantly. Reach for `tab=discrete-bar` (plus `focus=`) whenever the claim is positional.
- **Give a single-entity view a reference series.** A lone country line has no scale — add the world, or a regional/peer aggregate, so the reader can see what "high" or "falling fast" means. Tag only the focal entity in `metadata.entities`; the context series isn't what the view is about.
- **If the text leans on a threshold, show the threshold.** A claim built on a 5.0 index line or a 2.1 replacement rate is far stronger when the crossing is visible. Where grapher can't draw that reference line, pick a framing whose chart doesn't depend on one.
- **Prefer the format that needs least explaining at thumbnail size.** If the picture only makes sense after a paragraph, choose a different cut of the data.

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
- **Respect the uncertainty in the data; don't over-read exact values, extremes, or short series.** Country statistics are estimates with error bars, even when the CSV prints a precise number.
    - **Round extremes are rarely literal.** 100% (e.g. internet use) or 0% (e.g. extreme poverty) almost never means every last person — it's rounding, or a measurement floor/ceiling. Don't build a nugget on an "every single person" framing; write "virtually all" / "nearly eliminated", or cite the figure without the absolutist gloss.
    - **Short series are noisy.** A change resting on only two or three data points is mostly variance — don't headline a "doubling" or "sharp decline" off a handful of observations. Prefer findings backed by a sustained run of points, and soften or drop change-over-time claims when coverage is thin.
    - **Don't mistake a measurement break for a real change.** If a series jumps, dips, or reverses, confirm from the investigation report (and the data page) that the movement isn't an artefact of changed methodology, definition, or country coverage before writing it as a real-world trend. When in doubt, leave it out.
    - **Read aggregates for what they are.** A `World` or regional value may be unweighted (every country counts equally) or population-weighted, and may be modelled rather than a simple sum of reporting countries — see the investigation report's notes. Don't present such an aggregate as more precise than it is.
- **One nugget, one point.** Each view should make exactly one observation. If a finding contains a second point (a gap that has also widened over time, the pace of a decline after a peak), split it into its own view rather than appending it — reviewers consistently ask for multi-point nuggets to be split.
- **No causal explanations the displayed data doesn't directly support.** Don't write "the decline reflects deindustrialisation and the shift to renewables" when the view only shows an emissions line. Either cut the "why" (leave deeper context to articles and data insights), or add a chart to the view that actually shows the explanatory variable (e.g. a population chart to support "the reason is population growth").
- **Precise titles.** Name the metric explicitly ("China overtook the US **in annual CO₂ emissions**", not just "China overtook the US"). Any change-over-time claim needs its baseline year ("has nearly doubled **since 1990**"). Use present perfect tense ("has fallen", "has doubled") when the data runs to the present.
    - **Say what domain the title is about.** "Sub-Saharan Africa and South Asia still trail the rest of the world" — at what? A title the reader can't place without looking at the chart has failed.
    - **State the direction of the finding.** If the story is a decline, the title should say something declined. Don't leave the direction to be inferred from numbers in the description.
    - **Numerals, not written-out fractions** — "75%", not "three-quarters".
    - **One clause, conventionally phrased.** Cut trailing subordinate clauses that qualify the finding ("British inequality surged in the 1980s and never fully receded" → "British inequality surged in the 1980s"), and unpack contorted constructions ("East Asia went from 15% of Western Europe's income to over half" → "Per capita income in East Asia was 15% of Western Europe's in 1950; today it is over half").
- **Every numeric claim must come from a computation you ran in this session.** Before writing "X fell from A to B" or "the ratio is N×", actually compute A, B, and N from the CSV and copy the printed result. Memory and estimation are forbidden. Investigation reports are a good starting point but do not exempt you from re-confirming any value you cite.
- **Numbers a reader can hold in their head.** Cite figures at the precision the claim needs, which is almost always less than the CSV prints.
    - **Round hard.** Two decimals on a Gini, not three. "$2k" and "$3.4k", not "$2,037" and "$3,437". "Over 50%", not "51.6%". Exact values belong on the data page, not in a nugget.
    - **Give every currency figure its basis.** "$56,568" is unreadable without knowing which dollars these are — name the international-dollar/price-year basis, in a clause.
    - **Keep bare index values out of the prose.** An HDI of 0.878, a gain of +0.060, a Democracy Index score of 4.92 — these mean nothing to a non-specialist and actively cause readers to disengage. State the substantive claim (the rank, the change, the comparison) and let the chart carry the index values. If an index score genuinely is the point, define the scale first — see [Exposition](#exposition).
- **OWID article voice**: factual, accessible, lightly engaged. Avoid sensationalism and speculation.
- **No social/political context** in the description text — leave it to the data.
- **No bullets in `description`.** Write prose.
- **Don't invent entities.** Only use entity codes/names that appear in the CSV's `Code` and `Entity` columns.
- **Don't reuse the same `(title, description)` shape across views.** A run that's mostly "X has fallen by Y% since Z" is boring.
- **Don't repeat earlier insights.** Read prior view files for these slugs and skip already-covered angles. Add the angle as a fresh view only if you can say something materially new.
- **Multi-chart views are valuable but rarer.** They need a genuine story across indicators, not just two unrelated charts pasted together. If the multi-chart input doesn't yield strong cross-indicator stories, generate single-chart views instead.

## Exposition

More nuggets are sent back for being unreadable than for being wrong. A nugget citing a number the reader cannot interpret has communicated nothing. Spend the third sentence (see [Schema field notes](#schema-field-notes)) on whichever of these the view actually needs:

- **Define any threshold you invoke.** If the text leans on a line in the data — replacement fertility of 2.1, a Democracy Index score of 5.0, an undernourishment reporting floor — say in-text what the threshold means and what sits on either side of it. "Below the 5.0 threshold" is meaningless to a reader who doesn't know the scale.
- **Never invent a threshold or category label.** Only use a cut-off or label the source itself defines. Don't coin "extreme inequality" for a Gini of 0.5+ and present it as though it were the source's term. If you need a cut-off the source doesn't supply, say plainly that it is your own ("above 0.5 — a level reached by only 13 countries since 2015").
- **Explain what an index measures before quoting its values.** For any composite index (HDI, Democracy Index, Gini), a bare score carries no meaning. Give its range and roughly what it captures, in a clause.
- **Name the members of a non-obvious aggregate.** "Western offshoots", "East Asia", "upper-middle-income economies" and most regional groupings are opaque — add a short "which includes X, Y and Z" the first time the view leans on one. A reader can't judge a claim about a group they can't picture.
- **Justify a non-obvious comparison group.** If you compare low-income countries against _upper-middle_-income ones rather than high-income ones, say why (usually: the obvious comparator is pinned at a floor or ceiling and shows nothing). An unexplained choice reads as arbitrary or cherry-picked.
- **Explain the mechanism when the metric is unfamiliar.** For a risk factor or cause of death, a clause on how it actually harms people ("high blood pressure, which damages arteries and drives strokes and heart disease") orients a reader who doesn't think about the topic.

Concision still applies — each of these is a clause or one short sentence, never a paragraph. The test: could a reader who has never met the term parse the nugget's central claim without leaving the page?

## Links in descriptions

A `description` may contain inline hyperlinks written in **Markdown link syntax**: `[linked text](https://ourworldindata.org/...)`. The admin and downstream surfaces render these as real links. Use them to point readers at deeper OWID explanations, methodology, or caveats that don't fit in two sentences — without overloading the nugget text itself.

Rules:

- **Link to OWID content** (articles, topic pages, data insights), using absolute `https://ourworldindata.org/...` URLs.
- **At most one link per description**, on a short, meaningful phrase — not the whole sentence, and never a bare URL.
- The link is for _depth and caveats_, not for smuggling in a claim the chart doesn't support. The sentence must still read correctly with the link text as plain words.
- A description link does **not** replace the `grapherViews` URL — that's still the chart the nugget points at. The link is an _additional_ pointer to prose.

_E.g. "World literacy has risen from 12% in 1820 to 87% today, though [reading comprehension lags well behind basic literacy](https://ourworldindata.org/...)."_

## Generating from a piece of OWID content

Instead of starting from a chart slug, you can generate nuggets from a specific piece of OWID writing — a **topic page, article, or data insight**. The goal is a set of nuggets that carry the piece's key points across the site and social media, each linking back to the piece for deeper exploration.

When the input is a content URL/path (rather than, or alongside, chart slugs):

1. **Read the piece in full.** Understand its central argument, the charts and data it leans on, the order in which it builds its case, and the caveats it raises. Inventory every grapher chart it embeds or links — those slugs are your `grapherViews` sources.
2. **Still verify every number from the data.** The article tells you _what's interesting_; it does not exempt you from the rule that every cited value comes from a computation you ran against the chart's CSV this session. Fetch the CSVs for the charts the piece uses and recompute.
3. **Pick the load-bearing points.** Which 8–15 claims would a reader most want to carry away? Favour what the article foregrounds, plus strong **complementary** slices its data supports but doesn't spell out.
4. **Write the nuggets** with the normal schema and all the guidance above — each standing alone (comprehensible without the article) while pointing at the specific chart that shows it.
5. **Link back to the source.** Put a single inline link to the article in the `description` (see [Links in descriptions](#links-in-descriptions)) so readers can reach the full explanation, methodology, and caveats. Lean on the link for any "why" or nuance the chart alone can't justify, rather than over-claiming in the nugget text.
6. **Respect the piece's framing and caveats.** Don't strip a finding of a qualification the article was careful to include, and don't harden a relationship the article treats cautiously.

## Output

A single JSON file at `data-nuggets/views/{key}-{YYYY-MM-DD-HH-MM-SS}.json`. Report the path back to the user so they can pass it to [[fact-check-data-nuggets]] next.
