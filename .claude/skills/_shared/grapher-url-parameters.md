# OWID Grapher URL Query Parameters Guide

This guide documents query parameters supported by Our World in Data Grapher URLs. Use it as a reference when constructing deep links to specific chart views (e.g. when generating "data nuggets" of a chart).

> **Canonical source:** the authoritative list of valid query-param keys lives in `packages/@ourworldindata/types/src/grapherTypes/GrapherTypes.ts` as `LegacyGrapherQueryParams` / `GRAPHER_QUERY_PARAM_KEYS`. Tab values live in `GRAPHER_TAB_QUERY_PARAMS` and chart types in `GRAPHER_CHART_TYPES` (in `GrapherConstants.ts`). If anything in this guide disagrees with those types, the types win — and this doc should be updated.

## Base URL structure

```
https://ourworldindata.org/grapher/{chart-slug}?{param1}={value1}&{param2}={value2}
```

**Example:**

```
https://ourworldindata.org/grapher/child-mortality?time=earliest..1990&country=USA~GBR~SWE~FRA~BRA~IND&tab=line
```

---

## Core parameters

### `country` — entity selection

Selects which countries/entities to display on the chart.

- **Format:** tilde-delimited (`~`) list of entity codes or names
- **Values:** entity codes (e.g. `USA`, `GBR`) or full names (e.g. `United States`)

**Examples:**

- Single entity: `country=~USA` (note the leading `~`)
- Multiple entities: `country=USA~GBR~FRA`
- Entity names: `country=United%20States~France`

**Notes:**

- A leading `~` is used when selecting a single entity to distinguish from legacy formats.
- Spaces in entity names should be URL-encoded as `%20` or `+`.
- Entity codes are preferred over full names (more concise).
- For OWID-defined regions and aggregates use codes like `OWID_WRL` (World), `OWID_HIC` (high-income), `OWID_LIC` (low-income), `OWID_AFR` (Africa), etc.
- Maximum entities varies by chart type but typically 10–15 for line charts.

---

### `time` — time range selection

Specifies the time range to display.

- **Format:** `{start}..{end}` (double-dot separator)
- **Values:** year numbers, `earliest`, or `latest`

**Examples:**

- Range: `time=2000..2020`
- From earliest: `time=earliest..2020`
- To latest: `time=1990..latest`
- Single year: `time=2020` (equivalent to `time=2020..2020`)
- Earliest only: `time=earliest` (same as `time=earliest..earliest`)
- Latest only: `time=latest` (same as `time=latest..latest`)
- All data from a year: `time=1950..latest`

**Legacy parameter:** `year` (deprecated, use `time` instead).

---

### `tab` — active tab selection

Selects which view/tab to display.

**Values:** `chart`, `map`, `table`, `line`, `scatter`, `stacked-area`, `discrete-bar`, `stacked-discrete-bar`, `slope`, `stacked-bar`, `marimekko`

**Example:** `?tab=map`

**Notes:**

- For multi-chart-type configurations, use the specific chart type name (e.g. `line`, `discrete-bar`).
- Maps require `hasMapTab: true` in the chart configuration.

---

## Axis & scale

### `xScale` / `yScale` — axis scale type

- **Values:** `linear` (default), `log`
- **Example:** `?yScale=log&xScale=linear`
- Primarily used for scatter plots and line charts. Log scales cannot display zero or negative values.

---

## Stacking & display

### `stackMode`

Controls how data is stacked in stacked charts.

- **Values:** `absolute` (default), `relative`
- **Example:** `?stackMode=relative`
- Applies to stacked area, stacked bar, and stacked discrete bar charts.

### `zoomToSelection`

Scales axes to focus on selected entities.

- **Values:** `true` to enable; omit to disable.
- **Example:** `?country=FRA~DEU&zoomToSelection=true`

### `endpointsOnly`

For scatter plots with a time range, only show the start and end points.

- **Values:** `1` to enable, `0` (default) to show all intermediate points.
- **Example:** `?tab=scatter&time=2000..2020&endpointsOnly=1`

---

## Faceting (small multiples)

### `facet`

Splits data into small-multiple charts.

- **Values:** `none` (default), `entity`, `metric`
- **Example:** `?facet=entity&country=USA~GBR~FRA~DEU`

### `uniformYAxis`

Whether faceted charts share a y-axis scale.

- **Values:** `1` (shared, default), `0` (independent)
- **Example:** `?facet=entity&uniformYAxis=0`

---

## Map parameters

### `region` — zoom map to a region

- **Values:** `World` (default), `Africa`, `Antarctica`, `Asia`, `Europe`, `NorthAmerica`, `Oceania`, `SouthAmerica`
- **Example:** `?tab=map&region=Africa`

### `globe` — 3D globe projection

- **Values:** `1` (enable), `0` (default, flat projection)
- **Example:** `?tab=map&globe=1`

### `globeRotation`

- **Format:** `{latitude},{longitude}` in degrees
- **Example:** `?tab=map&globe=1&globeRotation=-30,40`
- Only applies when `globe=1`. Latitude `-90..90`, longitude `-180..180`.

### `globeZoom`

- **Format:** decimal, default `1.0`
- **Example:** `?tab=map&globe=1&globeZoom=2.5`

### `mapSelect`

Map-view-specific entity selection (separate from `country`).

- **Format:** same as `country` (tilde-delimited)
- **Example:** `?tab=map&mapSelect=USA~CHN~IND`

---

## Table parameters

### `tableFilter`

Filters which entities appear in the data table.

- **Values:** `all` (default), `selection`, or a region name (`Africa`, `Asia`, `Europe`, ...)
- **Example:** `?tab=table&tableFilter=selection`

### `tableSearch`

Pre-fills the data-table search box.

- **Format:** URL-encoded text
- **Example:** `?tab=table&tableSearch=United%20States`

### `showSelectionOnlyInTable` (legacy)

- **Values:** `1` or `true` to show only the selection; omit to show all.
- **Example:** `?tab=table&showSelectionOnlyInTable=true`

---

## Visual toggles

### `showNoDataArea`

Visibility of the "no data" area (e.g. on Marimekko charts).

- **Values:** `1` (default, shown), `0` (hidden)
- **Example:** `?showNoDataArea=0`

### `focus` — focused series

Highlights specific series (entities or indicators) while de-emphasizing others.

- **Format:** same as `country` (tilde-delimited)
- **Example:** `?country=USA~GBR~FRA~DEU~IND&focus=USA~IND`
- Primarily used for line charts and slope charts. Can focus on entity names or indicator names.

---

## Modal & overlay

### `overlay`

Opens a specific overlay/modal on load.

- **Values:** `sources` (data sources overlay), `download` (download modal), and other internal overlay identifiers.
- **Example:** `?overlay=sources`

---

## Embed parameters

### `hideControls`

Hides interactive controls when the chart is embedded.

- **Values:** `true` to hide; omit to show (default).
- **Example:** `?hideControls=true`
- Typically used for iframe embeds. Hides entity selector, timeline controls, etc.

---

## Other

### `peerCountries`

Used to seed the entity selector with a curated set of "peer" countries for the current selection. Rarely needed when constructing deep links; check the canonical types if you need this.

---

## Complete example URLs

### Basic time range and countries

```
https://ourworldindata.org/grapher/child-mortality?time=1990..2020&country=USA~GBR~FRA~DEU~JPN
```

### Relative stacked area

```
https://ourworldindata.org/grapher/energy-consumption-by-source?stackMode=relative&country=OWID_WRL
```

### Log-scale scatter plot

```
https://ourworldindata.org/grapher/life-expectancy-vs-gdp-per-capita?xScale=log&yScale=linear&time=2019
```

### Faceted chart by entity

```
https://ourworldindata.org/grapher/co2-emissions-per-capita?facet=entity&country=USA~CHN~IND~DEU&uniformYAxis=0
```

### Map with region and selection

```
https://ourworldindata.org/grapher/life-expectancy?tab=map&region=Africa&mapSelect=NGA~KEN~ZAF~EGY
```

### Globe view with rotation

```
https://ourworldindata.org/grapher/population?tab=map&globe=1&globeRotation=20,-10&globeZoom=1.5
```

### Data table with filter

```
https://ourworldindata.org/grapher/gdp-per-capita?tab=table&tableFilter=Europe&tableSearch=Germany
```

### Focus one country while showing others for context

```
https://ourworldindata.org/grapher/co-emissions-per-capita?country=USA~CHN~IND~BRA~RUS&focus=USA
```

### Multi-parameter combo

```
https://ourworldindata.org/grapher/covid-cases-deaths?time=2020-03-01..latest&country=USA~GBR~ITA~ESP&tab=line&yScale=log&zoomToSelection=true&stackMode=absolute
```

---

## Encoding rules

1. **Spaces:** `%20` or `+` for spaces in entity names.
2. **Special characters:** URL-encode (e.g. `&` → `%26`).
3. **Tilde delimiter:** `~` separates multiple values in `country`, `focus`, `mapSelect`.
4. **Case:** entity codes are uppercase (e.g. `USA`, not `usa`).
5. **Boolean values:** use `1`/`0` or `true`/`false` depending on the parameter (see each entry above).
6. **Empty values:** `param=` (empty string) explicitly clears a parameter.

---

## Best practices

- **Validate against the canonical types.** Only emit keys that appear in `GRAPHER_QUERY_PARAM_KEYS`. Anything else will be ignored (or worse, log warnings).
- **Test URLs in a browser before relying on them.** Especially after constructing them programmatically.
- **Pick the right `tab`** to match what the view is communicating. Trend over time → `tab=line`. Cross-section ranking in a single year → `tab=discrete-bar`. Geographic distribution → `tab=map`. Two-variable relationship → `tab=scatter`. Composition → `tab=stacked-area` / `stacked-bar`.
- **Prefer `focus=` over a tight `country=` list** when a chart already has a meaningful default selection and you just want to highlight one or two entities.
- **Use `time=earliest..latest`** when you want the full available history; don't hard-code specific years unless the view is intrinsically about a fixed window.
- **Mind selection size.** More than ~15 entities clutters line charts and slows rendering.

---

## Legacy parameters

### `year` (deprecated)

Use `time` instead. `year=2000` → `time=2000`. URLs using `year` are auto-migrated but new links should use `time`.
