<!-- GENERATED FILE — DO NOT EDIT -->
<!-- Source: sibling .md sidecars in packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ -->
<!-- Regenerate: yarn generateComponentsReference -->

# OWID Archie Components Reference

Generated reference for every component authors can use in Gdocs / content-repo files. 
Every example in this doc is parsed through archieToEnriched at generation time; CI fails on drift.

## Components

- [Additional Charts](#additional-charts) — `{.additional-charts}`
- [Align](#align) — `{.align}`
- [All Charts](#all-charts) — `{.all-charts}`
- [Aside](#aside) — `{.aside}`
- [Bespoke Component](#bespoke-component) — `{.bespoke-component}`
- [Blockquote](#blockquote) — `{.blockquote}`
- [Callout](#callout) — `{.callout}`
- [Chart](#chart) — `{.chart}`
- [Chart Rows](#chart-rows) — `{.chart-rows}`
- [Chart Story](#chart-story) — `{.chart-story}`
- [Code](#code) — `{.code}`
- [Conditional Section](#conditional-section) — `{.conditional-section}`
- [Cookie Notice](#cookie-notice) — `{.cookie-notice}`
- [Country Profile Selector](#country-profile-selector) — `{.country-profile-selector}`
- [Cta](#cta) — `{.cta}`
- [Data Callout](#data-callout) — `{.data-callout}`
- [Data Callout Group](#data-callout-group) — `{.data-callout-group}`
- [Donor List](#donors) — `{.donors}`
- [Entry Summary](#entry-summary) — `{.entry-summary}`
- [Expandable Paragraph](#expandable-paragraph) — `{.expandable-paragraph}`
- [Expander](#expander) — `{.expander}`
- [Explore Data Section](#explore-data-section) — `{.explore-data-section}`
- [Explorer Tiles](#explorer-tiles) — `{.explorer-tiles}`
- [Featured Data Insights](#featured-data-insights) — `{.featured-data-insights}`
- [Featured Metrics](#featured-metrics) — `{.featured-metrics}`
- [Gray Section](#gray-section) — `{.gray-section}`
- [Guided Chart](#guided-chart) — `{.guided-chart}`
- [Heading](#heading) — `{.heading}`
- [Homepage Intro](#homepage-intro) — `{.homepage-intro}`
- [Homepage Search](#homepage-search) — `{.homepage-search}`
- [Horizontal Rule](#horizontal-rule) — `{.horizontal-rule}`
- [Html](#html) — `{.html}`
- [Image](#image) — `{.image}`
- [Key Indicator](#key-indicator) — `{.key-indicator}`
- [Key Indicator Collection](#key-indicator-collection) — `{.key-indicator-collection}`
- [Key Insights](#key-insights) — `{.key-insights}`
- [Latest Data Insights](#latest-data-insights) — `{.latest-data-insights}`
- [Linear Topic Page Table of Contents](#ltp-toc) — `{.ltp-toc}`
- [Missing Data](#missing-data) — `{.missing-data}`
- [Narrative Chart](#narrative-chart) — `{.narrative-chart}`
- [Numbered List](#numbered-list) — `{.numbered-list}`
- [People](#people) — `{.people}`
- [People Rows](#people-rows) — `{.people-rows}`
- [Person](#person) — `{.person}`
- [Pill Row](#pill-row) — `{.pill-row}`
- [Prominent Link](#prominent-link) — `{.prominent-link}`
- [Pull Chart](#pull-chart) — `{.pull-chart}`
- [Pull Quote](#pull-quote) — `{.pull-quote}`
- [Recirc](#recirc) — `{.recirc}`
- [Research and Writing](#research-and-writing) — `{.research-and-writing}`
- [Resource Panel](#resource-panel) — `{.resource-panel}`
- [SDG Grid](#sdg-grid) — `{.sdg-grid}`
- [SDG Table of Contents](#sdg-toc) — `{.sdg-toc}`
- [Side by Side](#side-by-side) — `{.side-by-side}`
- [Simple Text](#simple-text) — `{.simple-text}`
- [Socials](#socials) — `{.socials}`
- [Static Viz](#static-viz) — `{.static-viz}`
- [Sticky Left](#sticky-left) — `{.sticky-left}`
- [Sticky Right](#sticky-right) — `{.sticky-right}`
- [Subscribe Banner](#subscribe-banner) — `{.subscribe-banner}`
- [Table](#table) — `{.table}`
- [Text](#text) — `{.text}`
- [Topic Page Intro](#topic-page-intro) — `{.topic-page-intro}`
- [Unordered List](#list) — `{.list}`
- [Video](#video) — `{.video}`


## Additional Charts

`{.additional-charts}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/AdditionalCharts.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/AdditionalCharts.md`

A subtle way of linking to multiple charts — each line of body becomes a
separate item, typically a link to a chart.

## When to use

- Offering readers a small set of related charts without giving them
  visual prominence.

## When NOT to use

- You want thumbnails or descriptions per item — use `{.chart-rows}`.
- You need a full-page listing of all charts on a topic — use
  `{.all-charts}` on a topic page.

The content between the opening `{.additional-charts}` and closing `{}` must
be a bulleted list inside the Google Doc — the gdoc pipeline converts that
into the `list` items this block expects. Plain text lines aren't enough;
the archie parser needs a true list structure. Because that structure comes
from Google Docs layout, not pure ArchieML text, this component has no
standalone `@example`.


## Align

`{.align}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Align.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Align.md`

Aligns a block of text horizontally. Affects text only — images, charts,
and other visual blocks are not re-aligned by this wrapper.

## When to use

- To center or right-align a heading or short paragraph inline with prose.

## When NOT to use

- To align images, charts, or other visual blocks — those blocks have their
  own size/visibility controls.
- For full-width styled sections; prefer `{.gray-section}`.

## Variations

- `alignment`: `left` | `center` | `right`

### Centered text

```archie
{.align}
alignment: center
[.+content]
Centered text

A centered heading
[]
{}
```


## All Charts

`{.all-charts}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/AllCharts.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/AllCharts.md`

Shows all Grapher charts that share a tag with the current article. "Key
charts" (those pinned via the admin) appear at the top; the `[.top]`
section lets you override or extend that ordering for this article.

## When to use

- Topic pages that should surface every chart associated with the topic.

## When NOT to use

- You want to hand-pick a small number of related charts — use
  `{.chart-rows}` or `{.additional-charts}`.

### All charts on a topic with pinned top charts

```archie
{.all-charts}
heading: Interactive Charts on Poverty
[.top]
url: https://ourworldindata.org/grapher/size-poverty-gap-countries

url: https://ourworldindata.org/grapher/gdp-per-capita-maddison-2020
[]
{}
```


## Aside

`{.aside}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Aside.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Aside.md`

A plaintext caption placed to the right or left of a body paragraph. Useful
for short side notes that shouldn't interrupt the main reading flow.

## When to use

- A short aside or annotation next to a paragraph.

## When NOT to use

- Prefer `{.callout}` when the note needs a title, icon, or rich text.
- Prefer `{.recirc}` when linking to related content.

## Variations

- `position`: `right` (default) | `left`
- Placement in the document matters: put the aside before a paragraph for
  `left`, after the paragraph for `right`.
- `caption` is plaintext only.

### Left-positioned aside

```archie
{.aside}
caption: I will be to the left of the following paragraph.
position: left
{}
```


## Bespoke Component

`{.bespoke-component}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/BespokeComponent.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/BespokeComponent.md`

A self-contained custom data viz component bundled under
`bespoke/projects/` and embedded via Shadow DOM. Each bundle can
expose multiple variants and accepts a free-form `config` map.
Undocumented in the author reference (developer-facing).


## Blockquote

`{.blockquote}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Blockquote.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Blockquote.md`

A way to cite an excerpt from another source. Renders as an indented,
quoted passage with an optional attribution line.

## When to use

- Quoting a longer passage from a person, paper, or publication.

## When NOT to use

- Prefer `{.pull-quote}` when you want to re-emphasize a phrase from the
  article itself (styled as a centered, italicized h1).

## Variations

- `citation` can be plain text (e.g. a person's name) or a URL starting
  with `http`, in which case it renders as a link.

### Plain-text citation

```archie
{.blockquote}
citation: Bastian Herre
[.+text]
Measuring the state of democracy across the world helps us understand the extent to which people have political rights and freedoms.
[]
{}
```


## Callout

`{.callout}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Callout.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Callout.md`

A small gray-background block used to draw attention to meta-textual
information — e.g. "data was last updated", caveats about methodology,
or short editorial notes.

## When to use

- Flagging data freshness, caveats, or other meta-textual notes.
- Short side notes that should stand out from the main body.

## When NOT to use

- Prefer `{.aside}` for a plaintext caption placed to the side of a
  paragraph.
- Prefer `{.data-callout}` when interpolating live chart data.

## Variations

- `title` is optional.
- `icon` is optional; only the `info` icon is supported.
- The text block can contain paragraphs, headings, and lists.

If placed inside a key insight, make the first line (e.g. "What you should
know about this data") an h5 so the correct CSS applies.

### With title and info icon

```archie
{.callout}
title: Update
icon: info
[.+text]
This article uses data from 2020

But the conclusions are solid.

[]
{}
```


## Chart

`{.chart}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Chart.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Chart.md`

A Grapher chart, explorer, or MDIM embed. The default component for showing
an interactive Our World in Data chart inline.

## When to use

- A standalone chart readers should be able to interact with.
- An explorer (same block, different URL under `/explorers/`).
- An MDIM, with or without controls (set `hideControls=true` in the URL).

## When NOT to use

- Prefer `{.narrative-chart}` when the chart is making a specific argument
  in the article — narrative charts lock selection/title so future data
  updates don't change the point being made.
- Prefer `{.pull-chart}` to reference a chart without giving it full width.

## Variations

- `size`: `narrow` | `wide` (default) | `widest`
- `visibility`: `mobile` | `desktop` — pair two chart blocks to swap
  aspect ratio between layouts. Omit to show in both.
- `peerCountries`: `parentRegions` | `gdpPerCapita` | `population` |
  `dataRange` | `defaultSelection` | `neighbors` — controls which peer
  countries are offered in the country selector.

### Basic

```archie
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{}
```

### Narrow, desktop only

```archie
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
size: narrow
visibility: desktop
peerCountries: parentRegions
{}
```

### Explorer with controls hidden

```archie
{.chart}
url: https://ourworldindata.org/explorers/food-footprints?hideControls=true
{}
```


## Chart Rows

`{.chart-rows}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ChartRows.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ChartRows.md`

A vertical list of small chart thumbnails with descriptive text, each row
linking to a chart. Used standalone, or inside a `{.guided-chart}` where
clicking a row updates the guided-chart's main chart rather than
navigating away.

## When to use

- Presenting multiple related chart views compactly.
- Offering alternative cuts of the same data inside a guided chart.

## When NOT to use

- You only have one chart to reference — use `{.pull-chart}`.
- The charts are the main subject — use full-width `{.chart}` blocks.

## Variations

- `kicker`: short label above the rows (defaults to "More views of this
  data" at render time).
- `title` and `source`: only shown in standalone mode; hidden when nested
  inside a `{.guided-chart}`.

### Standalone chart rows

```archie
{.chart-rows}
kicker: More views of this data
title: Daily incomes by decile
source: Global Carbon Budget (2025)

[.rows]
image: chart-1-thumbnail.png
url: https://ourworldindata.org/grapher/daily-income-decile-1
[.+content]
The poorest decile has seen modest gains since 1980.
[]

image: chart-2-thumbnail.png
url: https://ourworldindata.org/grapher/daily-income-decile-10
[.+content]
The richest decile has seen the largest absolute gains.
[]
[]
{}
```


## Chart Story

`{.chart-story}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ChartStory.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ChartStory.md`

A carousel of charts, each paired with a narrative caption and a block
of technical text shown below the chart.

## When to use

- Telling a step-by-step story across several views of the same (or
  related) charts, where each step needs its own prose and technical notes.

## When NOT to use

- A simple list of alternative chart views — use `{.chart-rows}`.
- A single chart with inline narration — use `{.guided-chart}`.

### Two-slide chart story

```archie
[.chart-story]
narrative: Text for slide 1, an overview of the world
chart: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{.technical}
The poverty gap index is a measure that reflects both the depth and prevalence of poverty.
Extreme poverty is defined as living below the international poverty line of $1.90 per day
{}

narrative: Slide two looks at Africa
chart: https://ourworldindata.org/grapher/military-expenditure-share-gdp?region=Africa
{.technical}
Data is measured in international-$.
{}
[]
```


## Code

`{.code}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Code.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Code.md`

A block of text rendered verbatim in a monospace font. Use to include
code samples or markup that should not be interpreted.

## When to use

- To display snippets of code, config, or markup in the article body.

## When NOT to use

- To embed executable HTML — use `{.html}` instead.

### Verbatim iframe markup

```archie
[.+code]
<iframe src="https://ourworldindata.org/grapher/children-per-woman-un" loading="lazy"></iframe>
[]
```


## Conditional Section

`{.conditional-section}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ConditionalSection.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ConditionalSection.md`

A wrapper that includes or excludes its inner content based on the
current rendering context (for example the current entity on a
country profile page). Undocumented in the author reference.


## Cookie Notice

`{.cookie-notice}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/CookieNotice.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/CookieNotice.md`

Renders the site's cookie-consent notice. Internal block — not documented
for authors.


## Country Profile Selector

`{.country-profile-selector}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/CountryProfileSelector.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/CountryProfileSelector.md`

A country selector UI used on country-profile pages to let readers
jump to a specific country's profile. Undocumented in the author
reference.


## Cta

`{.cta}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Cta.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Cta.md`

A simple link rendered with an arrow. Colored blue in data insights, red
in other contexts.

## When to use

- A single, visually prominent call-to-action link.

## When NOT to use

- Prefer `{.prominent-link}` for a richer link tile with title, description,
  and thumbnail.
- Prefer `{.recirc}` for a list of related links.

### Basic

```archie
{.cta}
url: https://ourworldindata.org/grapher/life-expectancy
text: Check this out!
{}
```


## Data Callout

`{.data-callout}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/DataCallout.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/DataCallout.md`

A callout whose text interpolates live values from a Grapher chart at the
`url`. Use `$latestTime()` and `$latestValue()` to pull the most recent
data point. For multi-y charts, pass a column name, e.g.
`$latestTime(emissions_total)`.

## When to use

- Surfacing a "latest value" summary for a specific entity.
- Country profiles where copy should adapt to per-country data.

## When NOT to use

- Prefer `{.callout}` for static meta-textual notes not driven by chart
  data.

## Variations

- Include `time` in the grapher URL to pin to a specific year instead of
  the latest point.
- If the referenced chart has no data for the current entity, the entire
  section won't render — useful for country profiles.

### Country life expectancy

```archie
{.data-callout}
url: https://ourworldindata.org/grapher/life-expectancy?country=CAN
[.+content]
In $latestTime(), Canada's life expectancy was $latestValue()
[]
{}
```


## Data Callout Group

`{.data-callout-group}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/DataCallout.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/DataCalloutGroup.md`

A container wrapping one or more `{.data-callout}` blocks (and any
surrounding headings/text) so they hide together when none of the child
callouts have data for the current entity. If every callout in the group
ends up empty for a given country/audience, the whole group — heading
included — disappears.

## When to use

- On country profiles where a section heading should only appear if at
  least one of its `{.data-callout}` children actually has data.
- To keep a heading and a set of related data callouts visually and
  logically grouped.

## When NOT to use

- For a single callout — use a bare `{.data-callout}` instead.
- When each callout should hide independently — the whole group hides or
  shows as a unit.

## Variations

- `content` is an array of any enriched blocks, but it's only useful when
  it contains at least one `{.data-callout}` (otherwise the visibility
  filtering has nothing to act on).

```archie
{.data-callout-group}
[.+content]
{.text}
## Population
{}

{.data-callout}
title: Total population
value: {{population}}
{}

{.data-callout}
title: Population density
value: {{population_density}}
{}
[]
{}
```


## Donor List

`{.donors}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/DonorList.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/DonorList.md`

A rendered list of OWID's donors, pulled from a curated source. No
props.

## When to use

- On the donate / about page where the donor list should appear.

## When NOT to use

- Anywhere else.

### Basic

```archie
{.donors}
{}
```


## Entry Summary

`{.entry-summary}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/EntrySummary.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/EntrySummary.md`

A table-of-contents-style summary with explicit text/slug pairs. Because
the summary headings can differ from the actual headings in the document,
the text and slug are serialized explicitly rather than derived. Internal
block — not documented for authors.


## Expandable Paragraph

`{.expandable-paragraph}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ExpandableParagraph.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ExpandableParagraph.md`

Displays a short preview of content on page load with a "Show more" button
that reveals the rest inline. Any Archie block is supported inside.

## When to use

- Keeping a long passage compact while still offering the full text inline.

## When NOT to use

- Prefer `{.expander}` when you want a distinct boxed affordance for
  large tables or technical sections.

### Basic

```archie
[.+expandable-paragraph]
Any Archie block is supported here
[]
```


## Expander

`{.expander}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Expander.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Expander.md`

A rectangular box that conceals content until the reader clicks to reveal
it. Useful for large tables, technical detail, or optional methodology
that would otherwise interrupt the main narrative.

## When to use

- Hiding long technical descriptions behind a click.
- Wrapping a large table or dense methodology section.

## When NOT to use

- Prefer `{.expandable-paragraph}` for a short preview of inline text with
  a "Show more" link.

## Variations

- `heading` is optional context above the box.
- `title` is the clickable headline.
- `subtitle` is optional secondary text.

### Technical detail expander

```archie
{.expander}
heading: Additional information
title: Which data sources and definitions do we rely on?
subtitle: Nunc tincidunt pharetra diam ut accumsan.
[.+content]
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
[]
{}
```


## Explore Data Section

`{.explore-data-section}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ExploreDataSection.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ExploreDataSection.md`

A blue-background section with a chart icon and title, wrapping any
Gdoc content. Used on linear topic pages to group the
"explore the data" charts/explorers.

## When to use

- On linear topic pages to introduce the charts-and-data portion of
  the page.

## When NOT to use

- On regular topic pages or articles.

## Variations

- `title` defaults to "Explore the data" if omitted.

### Basic

```archie
{.explore-data-section}
title: Will default to "Explore the data"
[.+content]
Content here.
[]
{}
```


## Explorer Tiles

`{.explorer-tiles}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ExplorerTiles.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ExplorerTiles.md`

A grid of tiles linking to data explorers. Typically shown on the
homepage. Each tile pulls its icon from the explorer's tag in admin.

## When to use

- On the homepage to feature OWID data explorers.

## When NOT to use

- For a single explorer embed — use `{.chart}` with the explorer URL.

## Variations

- Supply exactly 4 explorer URLs. Each explorer must be tagged in
  admin and the tag must have an icon in the tag-icons folder.

### Four explorers

```archie
{.explorer-tiles}
title: Data explorers
subtitle: Interactive visualization tools.
[.explorers]
url: https://ourworldindata.org/explorers/poverty-explorer
url: https://ourworldindata.org/explorers/energy
url: https://ourworldindata.org/explorers/co2
url: https://ourworldindata.org/explorers/global-health
[]
{}
```


## Featured Data Insights

`{.featured-data-insights}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/FeaturedDataInsights.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/FeaturedDataInsights.md`

Displays data insights related to the current topic. The document
must have a topic tag so the block knows what to filter by. No props.

## When to use

- On linear topic pages (and similar topic-scoped pages) to surface
  related data insights.

## When NOT to use

- On documents without a topic tag — the block has nothing to query.

### Basic

```archie
{.featured-data-insights}
{}
```


## Featured Metrics

`{.featured-metrics}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/FeaturedMetrics.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/FeaturedMetrics.md`

Displays featured metrics related to the current topic. The document
must have a topic tag. No props.

## When to use

- On linear topic pages to surface the headline metrics for the
  topic.

## When NOT to use

- On documents without a topic tag.

### Basic

```archie
{.featured-metrics}
{}
```


## Gray Section

`{.gray-section}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/GraySection.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/GraySection.md`

A full-width section with a light-gray background. Wraps any other
ArchieML content to visually set it apart from the surrounding prose.

## When to use

- To group a small set of related blocks into a visually distinct section
  (e.g. a methods callout that includes a heading and a few paragraphs).

## When NOT to use

- For single-block callouts — use `{.callout}` instead (smaller, inline).
- For recirculation modules — use `{.recirc}`.

### A heading and some content on a gray background

```archie
[.+gray-section]
A heading within a gray section

Some content
[]
```


## Guided Chart

`{.guided-chart}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/GuidedChart.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/GuidedChart.md`

A scroll-driven chart where links in the body text drive updates to a
single chart (Grapher or MDIM; explorers are not supported). Link syntax
is a grapher URL prefixed with `#guide:` — e.g.
`#guide:https://ourworldindata.org/grapher/life-expectancy?country=~NZL`.
All `#guide:` links in the section must share the same slug; only query
params (selection, time, tab, etc.) can change.

## When to use

- Walking readers through different views of the same chart inline.
- Pairing a chart with prose where clicking phrases updates the chart.

## When NOT to use

- The chart and text are independent — use `{.chart}` in a `{.sticky-left}`
  / `{.sticky-right}` layout.
- You need more than one chart slug — guided-chart sections must have
  exactly one chart.

## Variations

- Can contain a `{.chart-rows}` block — clicking a row updates the main
  chart rather than navigating away. In guided-chart mode, `title` and
  `source` on the chart-rows are hidden.

### Sticky-left layout with a chart and guided links

```archie
[.+guided-chart]
{.sticky-left}
[.+left]
{.chart}
url: https://ourworldindata.org/grapher/life-expectancy
{}
[]
[.+right]
I am a link that will update the chart to show New Zealand when clicked
[]
{}
[]
```


## Heading

`{.heading}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Heading.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Heading.md`

A section heading. Authored via Google Docs text styles (Heading 1,
Heading 2, Heading 3) — the level is derived from the docs style. Start
sections with h1; nest with h2, then h3.


## Homepage Intro

`{.homepage-intro}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/HomepageIntro.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/HomepageIntro.md`

The large introduction block on the homepage: OWID mission copy
paired with a grid of four featured tiles.

## When to use

- Only on the homepage (`type: homepage`).

## When NOT to use

- Anywhere else. The mission text is hard-coded for the homepage
  layout.

## Variations

- Exactly four entries must be supplied under `[.featured-work]`.
- `kicker` is free text (e.g. "Article - 10 Min Read",
  "Announcement").
- `isNew: true` shows a red "NEW" pill on that tile.
- gdoc URLs auto-resolve title/description; external URLs require
  those fields explicitly.

### Four featured tiles

```archie
{.homepage-intro}

[.featured-work]
url: https://docs.google.com/document/d/1iH_m2GlsBuif80sDwfg0fNGZmpf9X0-TFM5oHQr9fPA/edit
kicker: Article - 10 Min Read
isNew: true

url: https://docs.google.com/document/d/1KCSkpWvSml9KZaqTO7TGWsUDpACZIxBoqs9Yw62Klx8/edit
kicker: Article - 10 Min Read

url: https://docs.google.com/document/d/1PvKMIDp0Npp-t_5F-tNp-w9Y2Lq4ifjWDJHEVQQ6bNw/edit
kicker: Article - 10 Min Read

url: https://docs.google.com/document/d/11t6XP9vKLDHeiDOcfaPOoc4TeQxHRixSjEikAlbGe0A/edit
title: We updated our topic page on Artificial Intelligence
kicker: Announcement
[]

{}
```


## Homepage Search

`{.homepage-search}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/HomepageSearch.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/HomepageSearch.md`

A wide section with a site-wide search bar. No props.

## When to use

- Only on the homepage (`type: homepage`), near the top.

## When NOT to use

- Elsewhere. The site header already exposes search.

### Basic

```archie
{.homepage-search}
{}
```


## Horizontal Rule

`{.horizontal-rule}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/HorizontalRule.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/HorizontalRule.md`

A thin, light-gray line that divides two large sections of an article.
Typically precedes an h1 heading.

## When to use

- To separate major sections of an article, especially before a new h1.

## When NOT to use

- Between paragraphs within the same section — use whitespace / headings.

Note: Google Docs' built-in "Horizontal line" (Insert menu) also renders
as this block.

### Basic

```archie
{.horizontal-rule}
{}
```


## Html

`{.html}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Html.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Html.md`

Raw HTML escape hatch. The inner value is rendered as HTML, so this block
supports things that inline Google Docs formatting doesn't — such as
iframes or inline styling.

## When to use

- To embed external iframes (YouTube, third-party tools).
- For the very rare case where inline styling is needed and nothing else
  will do.

## When NOT to use

- Regular text styling — use Google Docs formatting (bold, italic, links,
  superscript / subscript) instead.
- Code samples to display verbatim — use `{.code}`.
- OWID charts — use `{.chart}` or `{.narrative-chart}`.

### Inline styled span

```archie
html: This is text that can use features like <span style="color:red">this will be red</span>.
```

### Iframe embed

```archie
html: <iframe src="https://www.youtube.com/watch?v=dQw4w9WgXcQ" />
```


## Image

`{.image}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Image.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Image.md`

A static image uploaded to the OWID admin. The `filename` must match an
image registered in the admin (where default alt text is also set).

## When to use

- Photographs, illustrations, diagrams, and static (non-interactive)
  visuals.
- Static grapher exports where the reader doesn't need to interact with
  the chart — consider `hasOutline: true` for clean white-background
  screenshots so they read as visuals rather than floating artwork.

## When NOT to use

- Interactive charts — use `{.chart}` or `{.narrative-chart}`.
- Flagship data visualizations with metadata — use `{.static-viz}`.
- Videos — use `{.video}`.

## Variations

- `size`: `narrow` | `wide` (default) | `widest`
- `visibility`: `mobile` | `desktop` — pair two image blocks to swap
  aspect ratio between layouts.
- `smallFilename`: dedicated mobile image (should be ≥1600px wide).
- `hasOutline`: `true` | `false` — adds a 1px light-gray outline, useful
  for images with white backgrounds.

### Full featured

```archie
{.image}
filename: default-featured-image.png
smallFilename: default-featured-image.png
alt: my alt text that is optional
size: narrow
caption: I am a caption that would appear below the image
hasOutline: true
visibility: desktop
{}
```

### Minimal

```archie
{.image}
filename: default-featured-image.png
{}
```


## Key Indicator

`{.key-indicator}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/KeyIndicators.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/KeyIndicator.md`

A single data-driven card linking to a Grapher datapage. Shows a custom
title, a short narrative, and an embedded chart pulled from the linked
datapage's indicator. Almost always used as a member of a
`{.key-indicator-collection}` (the homepage accordion of indicators).

## When to use

- As one entry inside `{.key-indicator-collection}`.
- Stand-alone in the rare case you want a single highlighted indicator
  with custom narrative text and source attribution.

## When NOT to use

- For a generic chart embed without datapage context — use `{.chart}`.
- For a non-data card with static text — use `{.callout}` or
  `{.data-callout}`.

## Variations

- `datapageUrl` (required): URL of the Grapher datapage; can include
  query parameters like `?time=earliest..latest` to control the default
  view.
- `title` (required): the headline shown above the narrative.
- `text` (required): the narrative paragraph(s).
- `source` (optional): attribution string; defaults to the indicator's
  `attributionShort` if omitted.

### Standalone key indicator

```archie
{.key-indicator}
datapageUrl: https://ourworldindata.org/grapher/life-expectancy
title: How did people's life expectancy change over time?
[.+text]
Life expectancy has more than doubled in the last two centuries.
[]
source: Long-run data from UN World Population Prospects
{}
```


## Key Indicator Collection

`{.key-indicator-collection}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/KeyIndicators.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/KeyIndicatorCollection.md`

An accordion collection of "key indicators" — datapage-linked charts
with a title, text summary, and source. Shown on the homepage.

## When to use

- On the homepage to surface key indicator datapages (child
  mortality, extreme poverty, etc.).

## When NOT to use

- Elsewhere — use `{.chart}` or `{.pull-chart}` to highlight a single
  chart in an article.

## Variations

- Each `{.key-indicator}` inside `[.+indicators]` needs a
  `datapageUrl` that links to a grapher backed by a datapage.

### Two indicators

```archie
{.key-indicator-collection}

[.+indicators]

{.key-indicator}
datapageUrl: https://ourworldindata.org/grapher/child-mortality?time=earliest..latest
title: What share of children died before their fifth birthday?
source: Long-run estimates combining data from UN & Gapminder
[.+text]
What could be more tragic than the death of a young child?
[]
{}

{.key-indicator}
datapageUrl: https://ourworldindata.org/grapher/share-of-population-in-extreme-poverty
title: What share of the population is living in extreme poverty?
[.+text]
The UN sets the 'International Poverty Line' as a worldwide comparable definition.
[]
{}

[]

{}
```


## Key Insights

`{.key-insights}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/KeyInsights.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/KeyInsights.md`

A slide carousel of "key insights" — the core takeaways of a topic
page. Each slide has a title, optional visual (chart, narrative chart,
or image), and a body of rich content.

## When to use

- Near the top of a topic page, summarising the most important
  findings on the topic.

## When NOT to use

- On articles or data insights.

## Variations

- Each slide's visual is either a `url` (grapher/explorer), a
  `narrativeChartName`, or a `filename` (image). Use at most one.

### With mixed visuals

```archie
{.key-insights}
heading: Key Insights on Poverty
[.insights]

title: The age dependency ratio changes by country
url: https://ourworldindata.org/grapher/age-dependency-breakdown
[.+content]
All sorts of content can go in here.
[]

title: This slide uses an image
filename: default-featured-image.png
[.+content]
Blah blah.
[]

title: This slide uses a narrative chart
narrativeChartName: global-life-expectancy-has-doubled
[.+content]
Blah blah blah.
[]

[]
{}
```


## Latest Data Insights

`{.latest-data-insights}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/LatestDataInsights.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/LatestDataInsights.md`

A grey section on the homepage listing the most recent published data
insights. Automatically hidden if fewer than 4 published data
insights exist. No props.

## When to use

- On the homepage (`type: homepage`).

## When NOT to use

- Elsewhere — data insights are surfaced via their own page and the
  homepage carousel.

### Basic

```archie
{.latest-data-insights}
{}
```


## Linear Topic Page Table of Contents

`{.ltp-toc}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/LTPToc.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/LTPToc.md`

Specialised table of contents for linear topic pages. Primary section
lists page sections; secondary shows cards to all data and writing on
the topic.

## When to use

- On linear topic pages, near the top, to let readers jump between
  sections and to related data/writing.

## When NOT to use

- On regular topic pages (use the auto-generated sticky nav).
- On articles (use Google Docs headings; TOC is auto-derived).

## Variations

- `title` defaults to "Sections" if omitted.

### Default title

```archie
{.ltp-toc}
{}
```

### Custom title

```archie
{.ltp-toc}
title: On this page
{}
```


## Missing Data

`{.missing-data}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/MissingData.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/MissingData.md`

Placeholder block indicating that data is missing for the current entity.
Internal block — not documented for authors.


## Narrative Chart

`{.narrative-chart}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/NarrativeChart.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/NarrativeChart.md`

A chart derivative that can only be viewed inside an article. Narrative
charts are the preferred way of embedding charts in articles — they let
you pin the title, country selection, time range, and chart type so that
future data updates don't change the point being made.

## When to use

- The chart is making a specific argument and the selection/title matters.
- You want editorial control independent of the underlying Grapher config.

## When NOT to use

- The reader is meant to freely explore — use `{.chart}` instead.
- For explorers or MDIMs — narrative charts don't wrap those; use `{.chart}`.

## Variations

- `size`: `narrow` | `wide` (default) | `widest`.

### Basic

```archie
{.narrative-chart}
name: global-life-expectancy-has-doubled
{}
```


## Numbered List

`{.numbered-list}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/NumberedList.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/NumberedList.md`

An ordered (numbered) list. Unlike unordered lists — which are derived
from Google Docs bullet formatting — numbered lists must be declared
explicitly in ArchieML. Nested lists are not supported.

### Basic

```archie
[.numbered-list]
* Numbered
* List
[]
```


## People

`{.people}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PeopleRows.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/People.md`

A flat list of `{.person}` items — distinct from `{.people-rows}` which
arranges them in a configurable column grid. `{.people}` is a bare
container, leaving layout to the parent context.

## When to use

- When you need a sequence of person cards without the explicit row/column
  grid layout of `{.people-rows}`.
- As an intermediate structure when downstream rendering will handle
  layout (e.g. embedded in a custom section).

## When NOT to use

- For a standard team or board grid with 2- or 4-column layout — use
  `{.people-rows}` instead.

## Variations

- `items` is an array of `{.person}` blocks. See `{.person}` for the
  fields available on each.

Note: this block has no current usage in the content repo and no canonical
archie example. Reach for `{.people-rows}` instead for new content.


## People Rows

`{.people-rows}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PeopleRows.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PeopleRows.md`

A grid of `{.person}` cards, used on about pages to present team
members. Wraps an inner `[.+people]` list of people blocks.

## When to use

- On about pages (`type: about-page`) to list team, board, or
  advisors.

## When NOT to use

- Elsewhere.

## Variations

- `columns`: `2` or `4` — 4 suits compact cards, 2 suits cards with
  longer bios.

### Two-column row

```archie
{.people-rows}
columns: 2

[.+people]
{.person}
image: Max Roser.jpeg
name: Professor Max Roser
title: Founder and Executive Co-Director
url: https://docs.google.com/document/d/1NfXOk8HVohVYjzJ1rtZYuw8h7kB9cWd5Kqxj4Dg1-WQ/edit
[.+text]
Max is the founder of Our World in Data.
[]
[.socials]
type: x
url: https://x.com/MaxCRoser
text: @MaxCRoser
[]
{}
[]
{}
```


## Person

`{.person}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PeopleRows.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Person.md`

A single person card — image, name, optional title, optional link,
narrative bio text, and optional social links. Nested inside `{.people}`
(flat list) or `{.people-rows}` (column grid).

## When to use

- Inside `{.people-rows}` to populate a team / advisor / board grid.
- Inside `{.people}` for a flat list of cards.

## When NOT to use

- As a top-level block — `{.person}` is meant to be nested inside a
  collection.

## Variations

- `image` (optional): asset filename to display.
- `name` (required): the person's name.
- `title` (optional): role / job title shown under the name.
- `url` (optional): link wrapping the card.
- `text` (required): one or more paragraphs of bio / description.
- `socials` (optional): array of social links. Each has `type` (e.g. `x`,
  `mastodon`, `bluesky`, `threads`), `url`, and `text` (display label).

```archie
{.person}
image: Max Roser.jpeg
name: Max Roser
title: Founder and Executive Co-Director
url: https://ourworldindata.org/team/max-roser
[.+text]
Max is the founder of Our World in Data and an Associate Professor at the
University of Oxford.
[]
[.socials]
type: x
url: https://x.com/MaxCRoser
text: @MaxCRoser
[]
{}
```


## Pill Row

`{.pill-row}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PillRow.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PillRow.md`

A small grey bar of pill-shaped links, usually with a heading to the
left. Used on the homepage below the nav and on author pages to list
topic chips.

## When to use

- On the homepage, below the nav, to feature a short list of
  articles.
- On author pages, to list the topics the author writes about.

## When NOT to use

- As a general-purpose inline list — use `{.cta}`, `{.recirc}`, or
  normal links instead.

## Variations

- Pill `text` is optional when the URL is a gdoc link — the gdoc
  title is used.

### Basic

```archie
{.pill-row}
title: Popular Articles
[.pills]
text: Optimism & Pessimism
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk/edit

text: Life Expectancy
url: https://ourworldindata.org/grapher/life-expectancy
[]
{}
```


## Prominent Link

`{.prominent-link}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ProminentLink.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ProminentLink.md`

A visually prominent link tile. When pointing at another Google Doc
registered in the admin, all fields (title, description, thumbnail) are
auto-fetched; you can override any of them, and for non-gdoc URLs you
must supply them.

## When to use

- Driving readers to a single, key related article or chart.

## When NOT to use

- Prefer `{.recirc}` for a small gray list of multiple related links.
- Prefer `{.cta}` for a simple arrow link.

## Variations

- Gdoc URL: all fields auto-fetched; pass just `url`.
- External URL or overrides: supply `title`, `description`, `thumbnail`.

### Gdoc URL (auto-fetched)

```archie
{.prominent-link}
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk
{}
```

### External URL with explicit fields

```archie
{.prominent-link}
url: https://ourworldindata.org
title: About Our World In Data
description: A simple description
thumbnail: default-featured-image.png
{}
```


## Pull Chart

`{.pull-chart}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PullChart.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PullChart.md`

A chart pull — the chart equivalent of a pull quote. Shows a small chart
thumbnail alongside descriptive text, letting you reference a chart inline
without giving it full width.

## When to use

- Referencing a chart to support a point without interrupting the reading
  flow with a full-width interactive chart.
- The chart is ancillary and readers can click through for the full view.

## When NOT to use

- The chart is the main subject of the paragraph — use `{.chart}` or
  `{.narrative-chart}` for a full-width interactive.
- You want a list of several charts — use `{.chart-rows}`.

## Variations

- `align`: `left-center` (default) | `right-center` — which side the
  thumbnail sits on.

### Left-aligned pull chart

```archie
{.pull-chart}
align: left-center
image: hpv-vaccines-thumbnail.png
url: https://ourworldindata.org/grapher/population
[.+content]
Global population has grown rapidly over the past two centuries. Click through to explore the data by country.
[]
{}
```


## Pull Quote

`{.pull-quote}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PullQuote.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/PullQuote.md`

A centered, italicized h1 used to re-emphasize a phrase from the surrounding
body text. The quote is visually set alongside a paragraph of `content`.

## When to use

- Highlight a key phrase within an article to draw the reader's eye.

## When NOT to use

- Prefer `{.blockquote}` when citing an external source — pull quotes are
  meant to re-emphasize something from the article itself.

## Variations

- `align`: `left` | `left-center` | `right-center` | `right`

### Left-center aligned

```archie
{.pull-quote}
quote: I am a left-center aligned quote that should span multiple lines.
align: left-center
[.+content]
Suspendisse commodo turpis nunc, sit amet cursus odio porttitor scelerisque.
[]
{}
```


## Recirc

`{.recirc}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Recirc.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Recirc.md`

A small gray block, usually placed to the side of body text, that links
readers to related content (articles, graphers, explorers, MDIMs, or
external URLs).

## When to use

- Surfacing related reading alongside an article.
- Linking to charts, explorers, MDIMs, or external sources without
  interrupting the main flow.

## When NOT to use

- Prefer `{.prominent-link}` for a single, more visually prominent link
  tile.
- Prefer `{.resource-panel}` on linear topic pages when you want a sticky
  sidebar CTA.

## Variations

- `align`: `left` | `center` | `right`
- Each link can use the linked document's own title/subtitle, or override
  them via `title` and `subtitle`.

### Centered recirc with mixed links

```archie
{.recirc}
title: More Articles on Mammals
align: center

[.links]
url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk

url: https://docs.google.com/document/d/1Lo3CtGGESA3iQVrlhlQZbtG15ecUNt1Qfk2X3iBlwIk
title: Example of a custom title
subtitle: Suscipit provident ratione omnis earum.
[]
{}
```


## Research and Writing

`{.research-and-writing}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ResearchAndWriting.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ResearchAndWriting.md`

A mosaic of article tiles linking to related work. Used to showcase
further reading at the bottom of topic and linear topic pages, and on
author pages as the "All work" section.

## When to use

- At the bottom of a topic page to link to the main articles and
  secondary reads on that topic.
- On linear topic pages (use `variant: featured` for a compact look).
- On author pages to surface the author's work.

## When NOT to use

- Inside regular articles — use `{.recirc}` or `{.prominent-link}`
  for inline recommendations.

## Variations

- `primary` is required (one or more tiles); `secondary`, `more`, and
  `rows` sections are optional.
- `hide-date: true` hides article dates across the block.
- `hide-authors: true` hides authors (common on author pages where
  the author is already implicit).
- `variant: featured` — compact rendering used on linear topic pages.
- Links can be gdoc URLs (metadata auto-resolved) or external links
  (supply `title`, `authors`, `filename`).
- A `{.latest}` block inside auto-pulls latest articles not already
  featured (used on author pages).

### Full mosaic

```archie
{.research-and-writing}

[.primary]
url: https://wikipedia.org
authors: Author 1, Author 2
title: What are Bananas?
subtitle: There is no single definition of bananas.
filename: bananas.jpg
[]

[.secondary]
url: https://ourworldindata.org/optimism-and-pessimism
title: Optimism and Pessimism
authors: Max Roser
filename: default-featured-image.png
[]

{.more}
heading: More Key Articles on Poverty
[.articles]
url: https://ourworldindata.org/poverty
title: The history of the end of poverty has just begun
authors: Max Roser

url: https://ourworldindata.org/poverty-growth-needed
title: The economies that are home to the poorest billions of people need to grow
authors: Max Roser
[]
{}

[.rows]
heading: A row of articles
[.articles]
url: https://ourworldindata.org/optimism-and-pessimism
title: Optimism and Pessimism
authors: Max Roser
filename: default-featured-image.png

url: https://ourworldindata.org/wrong-about-the-world
title: Most of us are wrong about how the world has changed
authors: Max Roser
filename: default-featured-image.png
[]
[]
{}
```

### Featured variant (linear topic pages)

```archie
{.research-and-writing}
variant: featured
{}
```


## Resource Panel

`{.resource-panel}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ResourcePanel.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/ResourcePanel.md`

A sidebar CTA used on linear topic pages that links to a small set of
charts and, if tagged, the data catalog. On desktop it sticks to the
top-right of the intro section; on mobile it appears inline where placed
in the gdoc.

## When to use

- The intro of a linear topic page, to surface the topic's key charts.

## When NOT to use

- Prefer `{.recirc}` for a simple list of related links outside LTPs.

## Variations

- `icon`: currently only `chart` is supported.
- `kicker` is a short label rendered above the title.
- `buttonText` is the label of the bottom call-to-action button.

### LTP intro resource panel

```archie
{.resource-panel}
kicker: Resources
icon: chart
title: Data on this topic
buttonText: See all data on this topic
[.links]
url: https://ourworldindata.org/grapher/access-to-clean-fuels-and-technologies-for-cooking
subtitle: World Health Organization - Global Health Observatory (2025)

url: https://ourworldindata.org/grapher/annual-co2-emissions-per-country
subtitle: Global Carbon Budget (2024)
[]

{}
```


## SDG Grid

`{.sdg-grid}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SDGGrid.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SDGGrid.md`

A grid of tiles for the UN Sustainable Development Goals. Legacy
block used on the SDG tracker. Undocumented in the author reference.


## SDG Table of Contents

`{.sdg-toc}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SDGToc.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SDGToc.md`

Table of contents for the SDG tracker. Legacy block. Undocumented in
the author reference.


## Side by Side

`{.side-by-side}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SideBySide.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SideBySideContainer.md`

A two-column layout with left and right columns of roughly equal weight.
Collapses to a single column at the smartphone breakpoint (stays
side-by-side on tablets, unlike `{.sticky-right}` / `{.sticky-left}`).

## When to use

- Two visuals or short blocks of text to compare side-by-side.
- Layouts that should remain two-column even on tablets.

## When NOT to use

- When one column is long-form text and the other a visual that should
  stay visible — use `{.sticky-right}` or `{.sticky-left}`.

### Two text blocks side-by-side

```archie
{.side-by-side}
[.+left]
I am content on the left.
[]
[.+right]
I am content on the right.
[]
{}
```


## Simple Text

`{.simple-text}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SimpleText.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SimpleText.md`

A plain-text fragment without any inline formatting (no bold, italics,
or links). Used as an internal primitive for blocks whose text must be
flat — for example, inside `{.code}` — and is not authored directly in
ArchieML.


## Socials

`{.socials}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Socials.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Socials.md`

A list of social / contact links. Used on author pages (as the
`[socials]` section) and inside `{.person}` blocks on about pages.

## When to use

- On an author page to link to the author's social profiles and
  email.
- Inside a `{.person}` block on an about page.

## When NOT to use

- Inline in article body — use normal links.

## Variations

- `type` values: `link`, `email`, `x`, `facebook`, `instagram`,
  `youtube`, `linkedin`, `threads`, `mastodon`, `bluesky`.

### Author socials

```archie
[socials]
url: saloni@ourworldindata.org
text: saloni@ourworldindata.org
type: email

url: https://twitter.com/salonium
text: @salonium
type: x
[]
```


## Static Viz

`{.static-viz}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/StaticViz.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/StaticViz.md`

An "enhanced image" block for flagship data visualizations. Registered
in the admin with a description and a source-data link; renders as a
regular image but a "Download" action opens a modal exposing the
additional metadata.

## When to use

- Flagship / bespoke data visualizations where readers should be able
  to inspect or download the underlying data.

## When NOT to use

- Regular photos, screenshots, or illustrations — use `{.image}`.
- Interactive charts — use `{.chart}` or `{.narrative-chart}`.

## Variations

- `size`: `narrow` | `wide` (default) | `widest`
- `hasOutline`: `true` | `false`

### Basic

```archie
{.static-viz}
name: grapher-static-viz-demo
{}
```


## Sticky Left

`{.sticky-left}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/StickyLeft.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/StickyLeftContainer.md`

A two-column layout where the left column sticks to the viewport as the
reader scrolls through the (typically longer) right column. Mirror of
`{.sticky-right}`. Collapses to a single column at the tablet breakpoint.

## When to use

- Long-form text on the right discussing a chart or visual on the left —
  so the visual stays visible as the reader scrolls.

## When NOT to use

- When the sticky side should be the right column — use `{.sticky-right}`
  (more common).
- For roughly equal-weight columns — use `{.side-by-side}`.

### Chart on the left sticks, text on the right

```archie
{.sticky-left}
[.+left]
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{}
Sticky left content.
[]
[.+right]
Right content.
[]
{}
```


## Sticky Right

`{.sticky-right}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/StickyRight.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/StickyRightContainer.md`

A two-column layout where the right column sticks to the viewport as the
reader scrolls through the (typically longer) left column. Collapses to a
single column at the tablet breakpoint.

## When to use

- Long-form text on the left that discusses a chart, image, or visual on
  the right — so the visual stays visible as the reader scrolls.
- Guided-chart sections where the chart is in the right column.

## When NOT to use

- Two roughly equal-weight blocks that should collapse at a narrower
  breakpoint — use `{.side-by-side}` instead.
- When the sticky side should be the left column — use `{.sticky-left}`.

### Text on the left, chart sticks on the right

```archie
{.sticky-right}
[.+left]
Content on the left. Lorem ipsum dolor sit amet.
[]
[.+right]
{.chart}
url: https://ourworldindata.org/grapher/military-expenditure-share-gdp
{}
Content on the right that sticks as the user scrolls.
[]
{}
```


## Subscribe Banner

`{.subscribe-banner}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SubscribeBanner.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/SubscribeBanner.md`

A small gray block inviting readers to subscribe. Added automatically to
every article and linear topic page; only include this block manually if
you want an additional copy inline.

## When to use

- Embedding a subscribe CTA inline within an article.

## When NOT to use

- The default subscribe banner is inserted automatically. To disable it
  on a specific article, set `hide-subscribe-banner: true` in the
  front-matter instead of using this block.

## Variations

- `align`: `left` | `center` | `right`

### Centered

```archie
{.subscribe-banner}
align: center
{}
```


## Table

`{.table}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Table.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Table.md`

A simple table, built from a native Google Docs table wrapped in an
archie block. Three header templates are supported.

## When to use

- Small-to-medium tables that are best authored directly in Google Docs.

## When NOT to use

- For very large or complex tables, wrap a Google Docs table inside an
  `{.expander}` so it can be hidden by default.

## Variations

- `template`: `header-column` | `header-row` | `header-column-row`
- `size`: `narrow` | `wide` — defaults to spanning 6 columns; use `wide`
  for full width.
- `caption` is optional and supports rich text (including links).

Note: the actual `<table>` markup is authored directly in Google Docs; the
block wrapper only configures the template, size, and caption.

A `{.table}` block in archie only configures the wrapper (template, size,
caption); the actual rows come from a native Google Docs table placed
between the opening `{.table}` and closing `{}` inside the Gdoc. Because the
rows can't be expressed in pure ArchieML text, this component has no
standalone `@example`.


## Text

`{.text}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Text.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Text.md`

A paragraph of prose. This is the default block generated from plain
text in a Google Doc — authors don't usually write it explicitly.
Text spans support Google Docs formatting (bold, italic, links,
superscript, subscript), refs, and details-on-demand links.


## Topic Page Intro

`{.topic-page-intro}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/TopicPageIntro.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/TopicPageIntro.md`

The introduction section of a topic page. Renders the topic title,
optional download button, optional related-topics chips, and an intro
body of rich text.

## When to use

- Included on every topic page (`type: topic-page`) as the first block
  of the body.

## When NOT to use

- On non-topic-page documents (articles, data insights, linear topic
  pages, homepage, etc.).

## Variations

- `download-button` is optional — omit if there is no canonical
  dataset to offer for download.
- `related-topics` entries can be gdoc links (metadata resolves
  automatically) or external URLs (must supply `text`).

### Basic

```archie
{.topic-page-intro}
{.download-button}
text: Download all data on this topic
url: https://github.com/owid
{}

[.related-topics]
url: https://docs.google.com/document/d/1g_38g_DYBW8yhTJ2-heHJ4UFwBju41xlZGfirV7VZak/edit

url: https://ourworldindata.org/co2-and-other-greenhouse-gas-emissions
text: CO₂ and Greenhouse Gas Emissions
[]

[+.content]
Intro text for this topic page.
[]
{}
```

### Minimal (content only)

```archie
{.topic-page-intro}
[+.content]
A short introduction to the topic.
[]
{}
```


## Unordered List

`{.list}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/UnorderedList.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/List.md`

An unordered (bulleted) list. Produced automatically from Google Docs
bullet formatting — authors don't usually write this block explicitly
in ArchieML. Nested lists are not supported.


## Video

`{.video}` — defined in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Video.ts`, documented in `packages/@ourworldindata/types/src/gdocTypes/archieMLComponents/Video.md`

An embedded video hosted on OWID's CloudFlare. Videos are not hosted in
Google Drive — a developer must upload the compressed video first
(compress via Handbrake before uploading).

## When to use

- Short screencasts, animations, or motion visuals that need autoplay /
  loop behavior.

## When NOT to use

- External videos (YouTube, Vimeo) — use an iframe inside an `{.html}`
  block.
- Static imagery — use `{.image}`.

## Variations

- `shouldLoop`: `true` | `false`
- `shouldAutoplay`: `true` | `false`
- `visibility`: `mobile` | `desktop`
- `filename` is the poster / preview image (same aspect ratio as the
  video, usually the first frame) and must be registered in the admin.

### Looping autoplay with a poster image

```archie
{.video}
url: https://assets.ourworldindata.org/videos/bunny.mp4
filename: bunny-poster.jpg
shouldLoop: true
shouldAutoplay: true
visibility: desktop
caption: I am a caption for this video. I can have links.
{}
```
