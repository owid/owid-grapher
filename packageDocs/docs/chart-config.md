# The chart config

The `config` object accepted by all three `GrapherLoader` factories is a standard Grapher config (`GrapherInterface`) — the same format OWID stores for every chart on the site. Commonly used fields include `title`, `subtitle`, `note`, `chartTypes`, `tab`, `hasMapTab`, and `selectedEntityNames`.

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

A browsable, field-by-field rendering of that schema is available in the [schema reference](schema-reference/index.md).
