# Grapher editor

The chart editor behind [Our World in Data](https://ourworldindata.org/)'s admin, as a component. It takes a **grapher config** (the JSON [`@ourworldindata/grapher`](../grapher/readme.md) renders), lets a person edit it against a live preview, and hands the edited config back. Where the config is stored and where the data comes from is up to the host: OWID's admin keeps configs in its database and reads data from OWID's Data API; a static site can keep configs in JSON files and read data from a CSV.

## Using the package

### Installation

The package is published as `@ourworldindata/grapher-editor` to OWID's private npm registry at `https://packages.owid.io`, next to `@ourworldindata/grapher`. Installing it needs an auth token for that registry; in the consuming project's `.npmrc`:

```
@ourworldindata:registry=https://packages.owid.io
//packages.owid.io/:_authToken=<your auth token>
```

Then install as usual:

```bash
npm install @ourworldindata/grapher-editor
```

There are two entry points with the same API and type declarations:

- `@ourworldindata/grapher-editor` is the standalone bundle, with React bundled in, for plain HTML pages.
- `@ourworldindata/grapher-editor/react` is the library build for React apps and bundlers, with `react` and `react-dom` (19) as peer dependencies. React apps should use this one, or they ship a second copy of React.

Grapher is bundled into both, so the preview always renders with the grapher version the editor was built against. The package is ESM-only. Both share one set of type declarations, which mention React's types, so a TypeScript project using the standalone bundle without React needs `@types/react` installed too (or `skipLibCheck`).

On a page that shows the editor, include `@ourworldindata/grapher-editor/editor.css` (it contains grapher's styles too). It is the admin's stylesheet, Bootstrap included, so it also sets global styles such as `body` and link colours: give the editor a page of its own, or an iframe, rather than embedding it in a styled page. Optionally, load OWID's fonts too: `<link rel="stylesheet" href="https://ourworldindata.org/fonts.css" />`.

### Quick start

The editor needs a config, a store that says where the data comes from, and what to do on save.

```tsx
import {
    GrapherEditor,
    csvIndicatorStore,
    ColumnTypeNames,
    DimensionProperty,
    type GrapherInterface,
} from "@ourworldindata/grapher-editor/react"
import "@ourworldindata/grapher-editor/editor.css"

// Your data and its metadata, as GrapherLoader.fromCsv takes them.
const store = csvIndicatorStore({
    csv, // "entityName,year,rent_index\nBerlin,2015,100\n..."
    columnDefs: [
        {
            slug: "rent_index",
            type: ColumnTypeNames.Numeric,
            name: "Rent index",
            unit: "index (2015 = 100)",
            sourceName: "City statistics office",
        },
    ],
})

const config: GrapherInterface = {
    title: "Rents",
    dimensions: [{ property: DimensionProperty.y, slug: "rent_index" }],
}

function RentEditor({
    onSave,
}: {
    onSave: (edited: GrapherInterface) => void
}) {
    return (
        <div style={{ height: "100vh" }}>
            <GrapherEditor config={config} store={store} onSave={onSave} />
        </div>
    )
}
```

The config's `dimensions` name the store's columns by `slug`, as in a config rendered with `GrapherLoader.fromCsv`. `onSave` receives the edited config in the same form, so it renders with the same call. It may return a promise, and it may return a config, which the editor takes as what was saved (e.g. after the host normalized it). A rejection counts as a failed save and keeps the changes unsaved.

The editor reads `config`, `store` and `syncTabWithUrl` when it starts and keeps its own copy of the config while it's edited, so don't pass `onChange`'s config back in. To open a different chart, give `<GrapherEditor>` a new `key`, such as the chart's id.

Without React, mount the editor into a container:

```html
<link rel="stylesheet" href="https://…/grapher-editor/editor.css" />
<div id="editor" style="height: 100vh"></div>
<script type="module">
    import {
        mountGrapherEditor,
        csvIndicatorStore,
    } from "https://…/grapher-editor/editor.standalone.min.js"

    const editor = mountGrapherEditor(document.getElementById("editor"), {
        config,
        store: csvIndicatorStore({ csv, columnDefs }),
        onSave: (edited) => save(edited),
    })
    // editor.unmount() removes it; to open another config, mount again.
</script>
```

[`demo.html`](./demo.html) is a complete example (`yarn startDemoServer`).

### Where the data comes from: the store

The editor never talks to a database. Everything it knows about indicators comes from an `IndicatorStore`:

| Store                                                          | Dimensions name columns by    | Data and metadata from                                                     |
| -------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------- |
| `dataApiIndicatorStore({ dataApiUrl, datasets? \| catalog? })` | `variableId` (OWID indicator) | OWID's Data API; see [Offering OWID indicators](#offering-owid-indicators) |
| `csvIndicatorStore({ csv, columnDefs?, name? })`               | `slug`                        | the CSV, with metadata from `columnDefs`                                   |
| `tableIndicatorStore(owidTable, { name? })`                    | `slug`                        | an in-memory `OwidTable`                                                   |

The CSV and table stores offer every data column under "Add indicators", searched by name and slug. Column metadata (name, unit, description, sources) is shown in the editor but not edited there, because it belongs to the data rather than the chart; a dimension's `display` block overrides it for one chart.

### Offering OWID indicators

`dataApiIndicatorStore` loads data for any `variableId`, but "Add indicators" only appears when the store knows which indicators to offer. There are two ways to tell it:

- **`datasets`**: a function resolving to `[{ id, name, namespace?, version?, variables: [{ id, name }] }]`. It is called when the picker first opens, and the picker searches the result in the browser by indicator name, eight datasets a page. It suits a few thousand indicators.

    ```ts
    const store = dataApiIndicatorStore({
        dataApiUrl: "https://api.ourworldindata.org/v1/indicators",
        datasets: () => fetch("/my-indicators.json").then((r) => r.json()),
    })
    ```

- **`catalog`**, for your own search backend: an `IndicatorCatalog` with `search(query, page)`, which returns an `IndicatorSearchPage` (the matching indicators grouped by dataset, the `total` and `pageSize` to page through, and `unit: "datasets"` when `total` counts datasets). `initialQuery(datasetIds)` picks the query the picker opens on, and `fields` lists any `field:value` terms your search understands, for the picker's help. Each indicator's `column` is what picking it puts in the slot: `{ variableId }` for an OWID indicator.

### Other props

| Prop               | What it does                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `onChange`         | called with the config when it loads and after every edit, e.g. for a live output pane                        |
| `onModifiedChange` | called when the editor gains or loses unsaved changes, e.g. for a leave prompt; a new editor starts with none |
| `tabs`             | the editor tabs to show, e.g. `["basic", "data", "text", "customize", "map"]`                                 |
| `indicatorUrl`     | `(dimension) => url`: where an indicator's name in the Data tab links to; without it, names are plain text    |
| `syncTabWithUrl`   | mirror the active tab in the page URL's `?tab=` (off by default)                                              |

## Developing the package

### Where the code is

The editor's sources live in [`adminSiteClient/`](../../../adminSiteClient/) at the repo root, because OWID's admin is the package's first consumer and runs the same code. [`src/editor.public.ts`](./src/editor.public.ts) re-exports the public API from there, and the build bundles it. That makes the editor's files in `adminSiteClient/` a published API: they must not import the admin app, its settings or its router. The admin's own wiring lives next to them (`AdminGrapherEditor.tsx`, `adminEditorProviders.ts`), and the package tests fail if any of it reaches the bundle.

### Build outputs

`yarn build` (tsdown, configured in `tsdown.config.ts`) writes to `dist/`:

- `editor.react.js`: the ES module library build, published as `./react`. React is an external peer dependency; everything else, grapher included, is bundled.
- `editor.standalone.min.js`: the minified standalone bundle, published as the root export, with React bundled in too.
- `editor.css`: the stylesheet, including grapher's.
- `editor.d.ts`: the bundled type declarations, built with `tsconfig.editor-dts.json` at the repo root because the sources span two trees.

### Testing the build outputs

`yarn testPackage` packs the package (`yarn pack`, which applies `publishConfig`) and runs the tests in `packageTest/` against it: both builds import and export the public API, the admin stays out of the bundle, the standalone bundle mounts the editor over a CSV, the packed types check for a TypeScript consumer, and publint and attw pass. They aren't part of the repo-wide `yarn test`; CI runs them in the `npm packages` workflow. `yarn startDemoServer` serves `demo.html` on http://localhost:8434 against `dist/`, as a CDN consumer would load it.

### Publishing a release

Releases go to `https://packages.owid.io` (`publishConfig.registry`). From this directory, with the build verified:

```bash
yarn bumpp
```

This bumps the version in a `chore: release grapher-editor@<version>` commit and tags it. Pushed to `master`, such a commit triggers the Buildkite pipeline that publishes the package to the registry, like grapher's releases. The pipeline's steps are defined in the ops repo (`.buildkite/grapher/package_release.yml`), which needs a `grapher-editor` step before the first release.
