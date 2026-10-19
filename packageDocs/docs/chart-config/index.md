# The chart config

The `config` object accepted by all three `GrapherLoader` factories is a [`GrapherProgrammaticInterface`](../api/reference/interfaces/GrapherProgrammaticInterface.md): a standard Grapher config (`GrapherInterface`) — the same format OWID stores for every chart on the site — plus [options beyond the schema](#options-beyond-the-schema). Commonly used fields include `title`, `subtitle`, `note`, `chartTypes`, `tab`, `hasMapTab`, and `selectedEntityNames`.

```js
GrapherLoader.fromCsv({
    config: {
        title: "Life expectancy",
        subtitle: "The period life expectancy at birth.",
        chartTypes: ["LineChart"],
        hasMapTab: true,
        selectedEntityNames: ["France", "Germany"],
    },
    csvUrl: "./data.csv",
}).mount(container)
```

The authoritative definition of every field is the JSON schema at
[`https://files.ourworldindata.org/schemas/grapher-schema.011.json`](https://files.ourworldindata.org/schemas/grapher-schema.011.json),
maintained in [`packages/@ourworldindata/grapher/src/schema/`](https://github.com/owid/owid-grapher/tree/master/packages/@ourworldindata/grapher/src/schema)
and also shipped with the package as `@ourworldindata/grapher/grapher-schema.json`.

A browsable, field-by-field rendering of that schema is available in the [schema reference](../schema-reference/index.md).

## Options beyond the schema

The config also accepts options that control how the chart is embedded and which parts of its interface are shown, rather than what it shows. They aren't part of the persisted schema; the full list is in the [`GrapherProgrammaticInterface`](../api/reference/interfaces/GrapherProgrammaticInterface.md) reference. The ones you're most likely to need:

- `canonicalUrl` — the URL of the chart's own page, which the title and the "Explore the data" button link to and the share menu shares. By default it's derived from `slug` (as `/grapher/<slug>`, for published configs), which only resolves on ourworldindata.org. Pass `null` if the chart has no such page: the title is then plain text, and the "Explore the data" button and share menu are not shown.
- `hideDownloadButton`, `hideShareButton`, `hideDonateButton`, `hideFullscreenButton` — set to `true` to remove these buttons below the chart. The "Donate" button is only shown when the chart is rendered inside an iframe.
- `hideTitle`, `hideSubtitle`, `hideNote`, `hideEntityControls`, `hasTableTab` — trim parts of the chart's interface.

```js
GrapherLoader.fromCsv({
    config: { ...config, canonicalUrl: null },
    csvUrl: "./data.csv",
}).mount(container)
```

## Requiredness

The schema describes **persisted** configs, which must carry `$schema` and `dimensions`. Configs passed to `GrapherLoader` are looser — `$schema` is never needed (but recommended!), and `dimensions` is only required for [`fromApi`](../api/index.md#grapherloaderfromapi-config-dataapiurl), where it says which indicators to fetch.
