# Grapher

Grapher is [Our World in Data](https://ourworldindata.org/)'s client-side data exploration and visualization library — the code behind every interactive chart on ourworldindata.org, available as the `@ourworldindata/grapher` npm package. A chart is a JSON **config** (title, chart type, selected entities, …) plus the tabular **data** it renders, which Grapher can ingest from an in-memory table, a CSV, or OWID's data API.

!!! warning "Private package — restricted access"

    `@ourworldindata/grapher` is published to OWID's **private registry** under a **proprietary license**. Installing it requires an auth token that is not generally available at the moment — see [Installation & access](getting-started.md#installation-access).

```js
import { GrapherLoader } from "@ourworldindata/grapher"
import "@ourworldindata/grapher/grapher.css"

GrapherLoader.fromCsv({
    config: { title: "GDP per capita" },
    csvUrl: "./data.csv",
    columnDefs: [
        { slug: "gdpPerCapita", type: "Numeric", name: "GDP per capita" },
    ],
}).mount(document.getElementById("chart"))
```

## Where to go next

- [Getting started](getting-started.md) — bundler (React and non-React) and plain-HTML quick starts, styles and fonts, installation.
- [Loading data](loading-data.md) — the three data sources and the metadata you can attach to columns.
- [The chart config](chart-config/index.md) — what a config is, and the full field reference.
- [API](api/index.md) — `GrapherLoader` and the other public exports.
- [How Grapher works](how-grapher-works.md) — the internal pipeline from config to pixels.
