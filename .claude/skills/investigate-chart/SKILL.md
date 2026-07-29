---
name: investigate-chart
description: Conduct a thorough data investigation of one or more OWID charts and write a self-contained HTML report on patterns, entity trajectories, and overarching trends. Step 1 of the "data nuggets" pipeline. Input is one or more chart slugs (e.g. `child-mortality`, or `gdp-per-capita-worldbank oil-production`).
metadata:
    internal: true
---

# Investigate Chart

Conduct a data-driven investigation of one or more Our World in Data (OWID) charts and write a self-contained HTML report. The HTML format lets you embed live grapher charts, static thumbnails, and rich tables for human reviewers — while still being plain text for the next agent in the pipeline to consume.

This is **step 1** of the "data nuggets" pipeline. Output feeds [[generate-data-nuggets]].

You are acting as a PhD-level data researcher specializing in the OWID ecosystem. Stay close to the data values; do not speculate or import outside context.

## Input

One or more chart slugs. Each lives at `https://ourworldindata.org/grapher/{slug}` and shows data over time for many entities.

## Steps

1. **Fetch each slug's data** as CSV:

    ```
    https://ourworldindata.org/grapher/{slug}.csv?v=1&csvType=full&useColumnShortNames=false
    ```

    Load each into a pandas DataFrame. Long format with columns `Entity`, `Code`, `Year`, and one or more value columns. Use `data-nuggets/.scratch/` for any working files.

2. **Analyze structure**: columns, dtypes, value ranges, entity count, year coverage, sparseness.

3. **Examine rankings** at the earliest year, latest year, and a few midpoints. Note top/bottom entities in each era and entities that changed rank significantly.

4. **Examine each entity's trajectory.** For each entity:
    - Data coverage (year range, % of years with data)
    - First and latest values
    - Decadal (or other appropriate-interval) snapshots
    - A brief trajectory summary

    For entities with population < ~10M, a one-line summary is fine. For the most populous entities and major regional aggregates (`OWID_WRL`, `OWID_HIC`, `OWID_LIC`, continents, etc.), go deeper. Population data:

    ```
    https://ourworldindata.org/grapher/population.csv?v=1&csvType=full&useColumnShortNames=false
    ```

5. **Examine overarching patterns**: global trajectory, divergence vs. convergence, regional disparities, income-group patterns, biggest gainers/losers, entities with minimal change. **For multi-chart input**, also examine cross-indicator relationships — coincident sudden changes, entities where the indicators move together or in opposition.

6. **Write the report** to `data-nuggets/reports/{key}-{YYYY-MM-DD-HH-MM-SS}.html`.
    - Single-chart: `{key}` is the slug, e.g. `child-mortality-2026-05-22-14-32-00.html`.
    - Multi-chart: `{key}` is the input slugs joined with `+` in the order given (preserve user order), e.g. `gdp-per-capita-worldbank+oil-production-2026-05-22-14-32-00.html`.

    Use the template below.

## Report template

Use this as a starting point. Use semantic HTML (`<section>`, `<h2>`, `<table>`, `<figure>`) and keep CSS inline in `<style>` at the top — the file should render standalone with no external assets except for the embedded OWID iframes.

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Investigation: {chart name(s)}</title>
        <meta name="owid:slugs" content="{slug1},{slug2}" />
        <meta name="owid:author" content="{your model name and version}" />
        <meta name="owid:generated" content="{YYYY-MM-DDTHH:MM:SSZ}" />
        <style>
            body {
                font-family: -apple-system, system-ui, sans-serif;
                max-width: 900px;
                margin: 2rem auto;
                padding: 0 1rem;
                line-height: 1.5;
                color: #111;
            }
            h1,
            h2,
            h3 {
                line-height: 1.2;
            }
            section {
                margin: 2.5rem 0;
            }
            iframe.grapher {
                width: 100%;
                height: 600px;
                border: 0;
            }
            table {
                border-collapse: collapse;
                margin: 0.75rem 0;
                font-size: 0.92rem;
            }
            th,
            td {
                border: 1px solid #ddd;
                padding: 4px 8px;
                text-align: right;
            }
            th:first-child,
            td:first-child {
                text-align: left;
            }
            details {
                margin: 0.5rem 0;
            }
            .meta {
                color: #666;
                font-size: 0.9rem;
            }
        </style>
    </head>
    <body>
        <header>
            <h1>Data Investigation: {chart name(s)}</h1>
            <p class="meta">
                Slugs: {slug1}, {slug2} · Generated: {YYYY-MM-DD HH:MM} ·
                Author: {model name}
            </p>
            <p>
                <strong>Summary.</strong>
                {1–2 sentence overview of the report.}
            </p>
            <p class="meta">Prompt: {include the prompt you were given here}</p>
        </header>

        <!-- One embed per input slug, top-of-report for orientation -->
        <section id="chart-embeds">
            <h2>Charts</h2>
            <figure>
                <iframe
                    class="grapher"
                    src="https://ourworldindata.org/grapher/{slug1}"
                    loading="lazy"
                    allow="web-share; clipboard-write"
                ></iframe>
                <figcaption>{slug1}</figcaption>
            </figure>
        </section>

        <section id="overarching-patterns">
            <h2>Overarching patterns</h2>
            <!-- Subsections for global trajectory, regional/income groups,
                 distribution & convergence, biggest movers, etc.
                 Use <h3> for subsections, prose for findings,
                 HTML <table> for snapshots. -->
        </section>

        <section id="entity-summaries">
            <h2>Entity summaries</h2>
            <!-- Use <details><summary> for less-important entities to keep
                 the report scannable. Use full <h3> sections for major ones. -->

            <h3 id="entity-USA">United States (USA)</h3>
            <p class="meta">
                Data coverage: 1946–2024 (79 years, 100% complete).
            </p>
            <p>{2–6 sentences on trajectory.}</p>
            <table>
                <thead>
                    <tr>
                        <th>Year</th>
                        <th>{indicator}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>1960</td>
                        <td>...</td>
                    </tr>
                    ...
                </tbody>
            </table>

            <details>
                <summary>Smaller entities (collapsed)</summary>
                <h3 id="entity-FOO">Foo (FOO)</h3>
                <p class="meta">...</p>
                <p>One-line trajectory.</p>
            </details>
        </section>

        <!-- Multi-chart input only: a section on cross-indicator stories -->
        <section id="cross-indicator">
            <h2>Cross-indicator patterns</h2>
            <!-- Entities where the indicators move together / in opposition;
                 coincident sudden changes; notable joint stories. -->
        </section>
    </body>
</html>
```

### Embedding charts

- **Live iframe (rich, for human review):**
    ```html
    <iframe
        class="grapher"
        src="https://ourworldindata.org/grapher/{slug}?{params}"
        loading="lazy"
        allow="web-share; clipboard-write"
    ></iframe>
    ```
- **Static SVG thumbnail (lightweight, no JS):**
    ```html
    <img
        src="https://ourworldindata.org/grapher/{slug}.svg?{params}"
        alt="{slug}"
    />
    ```
- **Static PNG thumbnail:** same as SVG with `.png`.

Use iframes for the top-of-report orientation embeds. Use thumbnails inline where you want to illustrate a finding without dominating the page. Always include `alt`/`figcaption`.

## Guidance

- **Every numeric claim in the report must come from the same Python session that produced your analysis.** Never type a number from memory or estimate. If a claim needs a value you haven't already printed (e.g. data-coverage years for a specific entity, a percentage decline you want to cite), run a quick computation first and copy the result. The mental model: any number in the report should be traceable to a printed line of script output.
- **Verify data coverage before citing it.** Don't assume an entity or aggregate has data for a given year — check. OWID regional and income-group aggregates often start much later than country data.
- **Understand how aggregates are computed before you interpret them.** Before citing a `World`, continental, or income-group value, check the chart's data page metadata and the source/processing documentation to learn _how_ that aggregate was produced. Two questions matter most, and the report should record the answers:
    - **Weighting.** Is the aggregate a simple unweighted mean across entities (so Cape Verde counts as much as China), or is it population-weighted (or weighted by some other denominator)? This changes what the number _means_: an unweighted average of country rates is not "the world's rate." Many OWID per-capita/rate aggregates are population-weighted and many "average across countries" figures are not — don't assume; confirm from the metadata.
    - **Coverage and imputation.** Is the aggregate just a sum or mean over the countries that happen to report data that year, or did the researchers estimate the full universe (modelling, or supplementing with other sources, to cover missing countries)? This is critical for sparse historical data — e.g. a `World` child-mortality value for 1800 is typically a modelled estimate drawn from many sources, not an average of the two or three countries with raw observations. A bare sum-of-available-countries aggregate silently changes meaning as coverage grows over time, which can manufacture a spurious "trend."
      Note in the report which aggregates are population-weighted vs. unweighted, which are modelled vs. observed, and over which years each aggregate is trustworthy, so the generate step doesn't over-read them.
- **Watch for measurement breaks and definitional changes in the series.** A jump, dip, or trend reversal can be an artefact of _how the data was measured_ rather than a real-world change: a methodology or definition change, a new survey instrument, a shift in which countries report, or a series spliced from two sources. Before reading any movement as real, check the data page metadata and source documentation for breaks in comparability, and look in the data itself for tell-tale signs — a discontinuity exactly at a year where the source or country set changes, a level shift with no gradual run-up, or entities appearing/disappearing around the break. Flag any such break in the report (state which years are and aren't comparable) so the generate step doesn't attribute a measurement artefact to a real trend. _E.g. an apparent rise in undernourishment in low-income countries since the mid-2010s is only worth a nugget if it survives scrutiny of whether the measurement or definition changed over that window — interesting if real, misleading if it's a measurement break._
- **Refer back to the data values for every claim.** Don't rely on prior knowledge.
- **Be thorough.** Sparse reports lead to sparse, repetitive views downstream.
- **Past 50–75 years is most relevant.** Some indicators have data back centuries for a handful of countries — note long-run context briefly but don't dwell.
- **Multi-chart:** treat each chart's data on its own first, then explicitly look for cross-indicator stories. Surface these in the "Cross-indicator patterns" section.
- **No speculation.** If the data shows a pattern, describe it. Don't attribute causes the data doesn't document.
- **HTML hygiene:** use semantic elements, keep inline CSS minimal, ensure the file opens standalone in a browser. The next agent in the pipeline reads this file as text — keep it parseable.

## Output

A single HTML file at `data-nuggets/reports/{key}-{YYYY-MM-DD-HH-MM-SS}.html`. Report the path back so it can be passed to [[generate-data-nuggets]] next.
