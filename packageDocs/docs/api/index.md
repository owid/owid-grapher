# API

The public surface of `@ourworldindata/grapher` is small: the [`GrapherLoader`](reference/classes/GrapherLoader.md) class, the types you need to build configs and column defs, and a few lower-level exports for advanced embedding.

A complete, generated listing of every exported symbol lives under [Generated reference](reference/index.md).

## `GrapherLoader`

[`GrapherLoader`](reference/classes/GrapherLoader.md) orchestrates dataset downloading, metadata normalization, state management, container sizing, and React rendering.

### Static factories

#### `GrapherLoader.fromTable({ config, data })`

Initializes a chart from an in-memory [`OwidTable`](reference/classes/OwidTable.md).

- **`config`** ([`GrapherInterface`](reference/interfaces/GrapherInterface.md)): the standard Grapher configuration object.
- **`data`** (`OwidTable`): an `OwidTable` instance containing the rows.

#### `GrapherLoader.fromCsv({ config, csv, csvUrl, columnDefs })`

Parses CSV data — inline or fetched from a URL — automatically creating an `OwidTable` inside Grapher.

- **`config`** (`GrapherInterface`): Grapher configuration.
- **`csv`** (`string`): CSV content as an inline string. Exactly one of `csv` and `csvUrl` must be given (the types enforce this). The CSV must include `entityName`, `entityCode`, `entityId`, and `year` (or `day`) columns, plus one or more value columns.
- **`csvUrl`** (`string`): URL pointing to a CSV file of the same format.
- **`columnDefs`** (`OwidColumnDef[]`, optional): definitions describing the types, names, colors, and formatting of each column — see [Providing metadata](../loading-data.md#providing-metadata).

#### `GrapherLoader.fromApi({ config, dataApiUrl })`

Loads data directly from the Our World in Data catalog/indicators API.

- **`config`** (`GrapherInterface`): Grapher configuration. Must include a `dimensions` array listing the required indicator IDs (e.g. `{ property: "y", variableId: 1118466 }`) — the types enforce this.
- **`dataApiUrl`** (`string`, optional): custom indicators base URL. Defaults to `"https://api.ourworldindata.org/v1/indicators/"`.

### Instance methods & properties

- **`mount(container: HTMLElement): this`** — renders the chart inside the target container. Container resizes are observed and update the chart bounds automatically. The chart renders lazily: it stays empty until the container is scrolled into view. Throws if the loader is already mounted; call `dispose()` first to re-mount.
- **`dispose(): void`** — unmounts the chart, cleans up the React root, and disconnects all observers.
- **`ready`** (`Promise<void>`) — resolves once the chart's data has loaded (immediately for `fromTable` and inline-CSV `fromCsv`). Rejects if fetching fails, in which case the chart stays in its loading state; failures are also logged to the console, so awaiting is optional.
- **`grapherState`** (`GrapherState`) — the underlying mutable MobX state of the chart. Read properties or modify them programmatically (e.g. changing `selectedEntityNames` on the fly).

### Sizing

The chart fills its container: give the container an explicit size (the `aspect-ratio: 850 / 600` used in the examples matches Grapher's default proportions) and the chart lays itself out to fit, re-rendering when the container resizes. A container with zero width or height renders nothing — as does one that hasn't been scrolled into view yet, since rendering is lazy.

### TypeScript

The package ships bundled type declarations. Besides `GrapherLoader` and its option types (`FromTableOptions`, `FromCsvOptions`, `FromApiOptions`), it exports the types you need to build configs and column definitions: [`GrapherInterface`](reference/interfaces/GrapherInterface.md), `OwidChartDimensionInterface`, `OwidColumnDef`, and the enums `DimensionProperty` and [`ColumnTypeNames`](reference/enums/ColumnTypeNames.md).

One gotcha: fields like `columnDefs[].type` and `dimensions[].property` are enum-typed, so in TypeScript write `type: ColumnTypeNames.Numeric` and `property: DimensionProperty.y` where plain-JavaScript examples use `"Numeric"` and `"y"`.

## Other exports

- [**`OwidTable`**](reference/classes/OwidTable.md) — our dataframe class, for constructing in-memory data (see [Loading data](../loading-data.md)).
- **`Grapher`** and **`FetchingGrapher`** — the React components Grapher is built from, exported for advanced embedding scenarios (they're what OWID's own sites use). They require wiring up a `GrapherState` or OWID-specific endpoints; for almost all external use, `GrapherLoader` is the recommended entry point.
