# Loading data

`GrapherLoader` supports three data sources, one per factory:

| Factory     | Data source                            | Use when …                                          |
| ----------- | -------------------------------------- | --------------------------------------------------- |
| `fromTable` | an in-memory `OwidTable`               | you want to build or transform the table yourself   |
| `fromCsv`   | a CSV string, inline or fetched by URL | you have the data as CSV                            |
| `fromApi`   | the OWID data API (indicator IDs)      | you want to show Our World in Data's own indicators |

See the [API reference](api/index.md) for their full options.

## The CSV column contract

CSV data — whether passed inline (`csv`), fetched from a URL (`csvUrl`), or used to construct an `OwidTable` — must contain an `entityName` column and a `year` (or `day`) column, followed by one or more value columns. `entityCode` and `entityId` columns are optional.

## `fromCsv`: CSV data

Pass the CSV inline as `csv`, or have it fetched from a URL with `csvUrl` (exactly one of the two — the types enforce this):

```js
import { GrapherLoader } from "@ourworldindata/grapher"

GrapherLoader.fromCsv({
    config: { title: "GDP per capita" },
    csv: `entityName,entityCode,entityId,year,gdpPerCapita
United States,USA,1,2000,36330
United States,USA,1,2020,63544`,
    columnDefs: [
        { slug: "gdpPerCapita", type: "Numeric", name: "GDP per capita" },
    ],
}).mount(container)
```

## `fromTable`: an in-memory table

`fromTable` accepts the same data as a pre-built [`OwidTable`](api/reference/classes/OwidTable.md), useful when you want to construct or transform the data programmatically before handing it to the chart:

```js
import { GrapherLoader, OwidTable } from "@ourworldindata/grapher"

const table = new OwidTable(csvString, [
    { slug: "gdpPerCapita", type: "Numeric", name: "GDP per capita" },
])

GrapherLoader.fromTable({
    config: { title: "GDP per capita" },
    data: table,
}).mount(container)
```

## `fromApi`: OWID's data API

For `fromApi`, the config's `dimensions` array says which indicators to fetch; indicator IDs can be found via the [OWID data catalog](https://docs.owid.io/projects/etl/api/). Data loading starts at construction time, so the chart shows a loading state until the data arrives:

```js
GrapherLoader.fromApi({
    config: {
        title: "Life expectancy",
        selectedEntityNames: ["World", "Africa", "Europe"],
        dimensions: [{ property: "y", variableId: 1118466 }],
    },
}).mount(container)
```

### Customizing the API URL

`dataApiUrl` overrides the base URL the indicators are fetched from; it defaults to `https://api.ourworldindata.org/v1/indicators/`. For each indicator, the loader requests `<variableId>.data.json` and `<variableId>.metadata.json` relative to that base. This is useful for pointing a chart at self-hosted copies of indicator files — note that the URL must currently contain `v1/indicators`, other formats are rejected:

```js
GrapherLoader.fromApi({
    config: {
        title: "Life expectancy",
        dimensions: [{ property: "y", variableId: 1118466 }],
    },
    dataApiUrl: "https://api.example.org/v1/indicators/",
}).mount(container)
```

## Providing metadata

`columnDefs` carries more than display config: source and description metadata passed there feeds the chart's "Data source" footer line and the sources modal behind "Learn more about this data". Without it, the footer stays empty and the modal shows a "no source information" notice.

```js
GrapherLoader.fromCsv({
    config: { title: "Cows per capita" },
    csvUrl: "./cows.csv",
    columnDefs: [
        {
            slug: "cows",
            type: "Numeric",
            name: "Cows per capita",
            unit: "cows",
            // description shown below the indicator title in the modal
            descriptionShort: "The average number of cows per person.",
            // "What you should know about this data" — a markdown string
            // (not the legacy array of bullet points)
            descriptionKey: "Includes dairy and beef cattle.",
            // source information
            sourceName: "Global Cow Census (2024)",
            sourceLink: "https://example.org/cow-census",
            dataPublishedBy: "Cow Census Institute",
            timespan: "2000-2020", // shown as "Date range"
            // citation & attribution metadata, one entry per upstream source
            origins: [
                {
                    producer: "Cow Census Institute",
                    title: "Global Cow Census",
                    urlMain: "https://example.org/cow-census",
                    dateAccessed: "2024-05-01", // shown as "Last updated"
                    citationFull:
                        "Cow Census Institute (2024). Global Cow Census.",
                },
            ],
        },
    ],
}).mount(container)
```

The footer's attribution line is assembled from `sourceName` and the origins' producers (or set it directly via the config's `sourceDesc`). `additionalInfo`, `descriptionFromProducer`, and `presentation` (e.g. `titlePublic`, `attributionShort`) are also supported — see the `OwidColumnDef` type for the full surface.
