# Grapher editor

The chart editor behind [Our World in Data](https://ourworldindata.org/)'s admin, as a component. It takes a **grapher config** (the JSON `@ourworldindata/grapher` renders), lets a person edit it against a live preview, and hands the edited config back. Where the config lives and where indicator data comes from are the host's business: OWID's admin stores configs in its database and reads data from OWID's Data API; a static site can keep configs in JSON files and read data from a CSV.

This is the same code OWID's own chart editor runs on, published as a package. This readme covers installing and using it; the shaping notes behind it are internal.

## Using the package

### Installation

The package is published as `@ourworldindata/grapher-editor` to OWID's private npm registry at `https://packages.owid.io`, alongside `@ourworldindata/grapher`. Installing requires an auth token for that registry; in the consuming project's `.npmrc`:

```
@ourworldindata:registry=https://packages.owid.io
//packages.owid.io/:_authToken=<your auth token>
```

Then install as usual:

```bash
npm install @ourworldindata/grapher-editor
```

Two entry points share the same API and type declarations. The root export (`@ourworldindata/grapher-editor`) is the standalone bundle with React and grapher baked in, for plain HTML pages. `@ourworldindata/grapher-editor/react` is the library build for React apps and bundlers, with `react` and `react-dom` (19) as peer dependencies. React apps must use `/react`, or they would ship a second copy of React. Grapher itself is bundled into both builds, so the editor's preview always renders with the grapher version the editor was built against; a host that also renders charts with `@ourworldindata/grapher` carries two copies. The package is ESM-only.

On any page that shows the editor, include the stylesheet `@ourworldindata/grapher-editor/editor.css` (it contains grapher's styles too) and, optionally, OWID's fonts: `<link rel="stylesheet" href="https://ourworldindata.org/fonts.css" />`.

### Quick start

Three things are required: a config, a store that says where indicator data and metadata come from, and what to do when the user saves.

```tsx
import {
    GrapherEditor,
    csvIndicatorStore,
} from "@ourworldindata/grapher-editor/react"
import "@ourworldindata/grapher-editor/editor.css"

// Your data and its metadata, in the same form GrapherLoader.fromCsv takes.
const store = csvIndicatorStore({
    csv, // "entityName,year,rent_index\nBerlin,2015,100\n..."
    columnDefs: [
        {
            slug: "rent_index",
            type: "Numeric",
            name: "Rent index",
            unit: "index (2015 = 100)",
            sourceName: "City statistics office",
        },
    ],
})

function RentEditor({ config, onSave }) {
    return (
        <div style={{ height: "100vh" }}>
            <GrapherEditor config={config} store={store} onSave={onSave} />
        </div>
    )
}
```

The config references columns by slug (`ySlugs`, `xSlug`, `colorSlug`, `sizeSlug`), exactly like a config rendered with `GrapherLoader.fromCsv`. What `onSave` receives is in the same form, so it renders with the same call.

For a page without React, mount into a sized container:

```html
<link rel="stylesheet" href="https://…/grapher-editor/editor.css" />
<div id="editor" style="height: 100vh"></div>
<script type="module">
    import {
        mountGrapherEditor,
        csvIndicatorStore,
    } from "https://…/grapher-editor/editor.standalone.min.js"

    mountGrapherEditor(document.getElementById("editor"), {
        config,
        store: csvIndicatorStore({ csv, columnDefs }),
        onSave: (edited) => save(edited),
    })
</script>
```

A complete working example is [`demo.html`](./demo.html) (`yarn startDemoServer`).

### Where indicators come from: the store

The editor never touches a database. Everything it knows about indicators arrives through an `IndicatorStore`:

| Store                                             | Configs reference columns by                | Data and metadata from                                    |
| ------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------- |
| `dataApiIndicatorStore({ dataApiUrl, catalog? })` | `dimensions[].variableId` (OWID indicators) | OWID's Data API; `catalog` is what "Add indicator" offers |
| `csvIndicatorStore({ csv, columnDefs })`          | slugs (`ySlugs`, …)                         | the CSV; metadata from `columnDefs`                       |
| `tableIndicatorStore(owidTable)`                  | slugs                                       | an in-memory `OwidTable`                                  |

Column metadata (name, unit, description, sources) is shown in the editor but never edited: it belongs to the data source, not to the chart. The slug-based stores can't persist per-dimension display overrides (`dimensions[].display`), a limitation of the config format rather than of the editor.

### The other props

| Prop                             | What it does                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `onChange`                       | fires on every edit with the current config, e.g. for a live output pane                                                           |
| `baseConfig`                     | a config this one is a patch against: its values show as inherited, and only the differences are saved                             |
| `indicators`                     | overrides `store.catalog`; `null` hides "Add indicator"                                                                            |
| `details`                        | details-on-demand definitions, for validating `[term](#dod:term)` links in text fields                                             |
| `topicSlugs`                     | suggestions for the origin-URL field                                                                                               |
| `tabs`                           | restrict the tabs shown, e.g. `["basic", "data", "text", "customize", "map"]`                                                      |
| `environment`                    | Data API and catalog URLs (default: OWID's public ones) and optional OWID admin/site URLs to link to                               |
| `initialQueryParams`             | open the editor in a particular chart view rather than the authored one                                                            |
| `onDirtyChange`                  | fires when the editor gains or loses unsaved changes, for a leave prompt                                                           |
| `syncTabWithUrl`                 | mirror the active tab into the page URL's `?tab=` (off by default)                                                                 |
| `extraTabs`, `renderSaveButtons` | for hosts that keep a chart _record_ around the config (OWID's admin adds its revisions, references, tags and publishing this way) |

## Developing the package

### Where the code is

The editor's sources live in [`adminSiteClient/`](../../../adminSiteClient/) at the repo root, because OWID's admin is the package's first consumer and runs the same code. `src/index.ts` re-exports the public API from there; the build bundles it. Moving the files into this package is a later, mechanical step.

### Build outputs

`yarn build` (tsdown, config in `tsdown.config.ts`) writes to `dist/`:

- `editor.react.js`: the ES module library build, published as `./react`. React is an external peer dependency; everything else, grapher included, is bundled.
- `editor.standalone.min.js`: the minified standalone bundle, published as the root export. React is bundled in too.
- `editor.css`: the stylesheet, including grapher's.
- `editor.d.ts`: the bundled type declarations, built from `tsconfig.editor-dts.json` at the repo root (the sources span two trees).

### Testing the build outputs

`yarn testPackage` packs the package (`yarn pack`, which applies `publishConfig`) and runs the smoke tests in `packageTest/` against `dist/`: both builds import, export the public API, a CSV store translates configs, and the standalone bundle mounts the editor into a DOM. These are not part of the repo-wide `yarn test`. `yarn startDemoServer` serves `demo.html` on http://localhost:8434 against `dist/`, exactly as a CDN consumer would load it.

### Publishing a release

Releases go to `https://packages.owid.io` (set as `publishConfig.registry`). From this directory, with the build verified:

```bash
yarn bumpp
```

This bumps the version and tags `grapher-editor@<version>`. The publish pipeline that picks up `@ourworldindata/grapher` tags needs the same treatment for this tag before the first release; until then, publishing is manual.
