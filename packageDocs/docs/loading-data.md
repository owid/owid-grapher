# Loading data

`GrapherLoader` supports three data sources, one per factory:

| Factory     | Data source                            | Use when …                                          |
| ----------- | -------------------------------------- | --------------------------------------------------- |
| `fromTable` | an in-memory `OwidTable`               | you want to build or transform the table yourself   |
| `fromCsv`   | a CSV string, inline or fetched by URL | you have the data as CSV                            |
| `fromApi`   | the OWID data API (indicator IDs)      | you want to show Our World in Data's own indicators |

See the [API reference](api/index.md) for their full options.

## The CSV column contract

CSV data — whether passed inline (`csv`), fetched from a URL (`csvUrl`), or used to construct an `OwidTable` — must contain `entityName`, `entityCode`, and `entityId` columns plus a `year` (or `day`) column, followed by one or more value columns:

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

`fromTable` accepts the same data as a pre-built table (`new OwidTable(csvString, columnDefs)`), useful when you want to construct or transform the data programmatically first.

For `fromApi`, the config's `dimensions` array says which indicators to fetch; indicator IDs can be found via the [OWID data catalog](https://docs.owid.io/projects/etl/api/). Data loading starts at construction time, so the chart shows a loading state until the data arrives.

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
