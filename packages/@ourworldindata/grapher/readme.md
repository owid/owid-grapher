# Grapher

Grapher is [Our World in Data](https://ourworldindata.org/)'s client-side data exploration and visualization library. A chart is a JSON **config** (what to show: title, chart type, selected entities, …) plus the **data** it renders, which Grapher can ingest from several sources.

**📖 Full documentation: [docs.owid.io/projects/grapher](https://docs.owid.io/projects/grapher/)** — quickstarts, data loading, the chart config schema, API reference, and how the library works internally. The docs source lives in [`packageDocs/`](../../../packageDocs/) at the repo root. This readme covers the essentials of installing and using the package, plus notes for [developing the package itself](#developing-the-package).

## Using the package

### Installation

The package is published as `@ourworldindata/grapher` to OWID's private npm registry at `https://packages.owid.io`, so installing it requires an auth token for that registry. Point your package manager at it — for npm, in the consuming project's `.npmrc`:

```
@ourworldindata:registry=https://packages.owid.io
//packages.owid.io/:_authToken=<your auth token>
```

(For Yarn Berry, set the equivalent `npmScopes.ourworldindata.npmRegistryServer` and `npmAuthToken` in `.yarnrc.yml`.) Then install as usual:

```bash
npm install @ourworldindata/grapher
```

`react` and `react-dom` (19) are peer dependencies of the library build; the standalone bundle (the `@ourworldindata/grapher/standalone` export) has them baked in. The package is ESM-only.

Two things to include on any page that shows a chart:

- **Styles**: import `@ourworldindata/grapher/grapher.css` (or link it as a stylesheet).
- **Fonts** (optional but recommended): charts are designed for **Lato** and **Playfair Display** and fall back to system fonts if they're absent. Load them yourself, or include OWID's font stylesheet like the demo pages do: `<link rel="stylesheet" href="https://ourworldindata.org/fonts.css" />`.

### Quick start

`GrapherLoader` is the main entry point: pick a data source via one of its static factories (`fromTable`, `fromCsv`, `fromApi`), then `mount` it into a sized container element.

```tsx
import { useEffect, useRef } from "react"
import { DimensionProperty, GrapherLoader } from "@ourworldindata/grapher"
import "@ourworldindata/grapher/grapher.css"

function LifeExpectancyChart() {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const loader = GrapherLoader.fromApi({
            config: {
                title: "Life expectancy",
                selectedEntityNames: ["World", "Africa", "Europe"],
                dimensions: [
                    { property: DimensionProperty.y, variableId: 1118466 },
                ],
            },
        }).mount(ref.current!)

        return () => loader.dispose()
    }, [])

    return <div style={{ aspectRatio: "850 / 600" }} ref={ref} />
}
```

For loading your own data (CSV or in-memory tables), providing source metadata, the standalone bundle for non-React pages, sizing, and the full `GrapherLoader` API, see the [documentation](https://docs.owid.io/projects/grapher/). A complete working example of all three data sources is in [`demo.html`](./demo.html) (`yarn startDemoServer`).

## Developing the package

### Build outputs

Running the build script produces the following outputs under `dist/`:

- `grapher.js`: The ES module library build. React and React DOM are marked as external peer dependencies (ideal for modern React apps or bundler environments).
- `grapher.standalone.min.js`: The minified standalone bundle. All dependencies (including React and React DOM) are bundled, enabling plug-and-play usage directly in any HTML page.
- `grapher.css`: The stylesheet containing all Grapher layouts and components styles.
- `grapher-schema.json`: The latest JSON schema for Grapher configs, also available through the `@ourworldindata/grapher/grapher-schema.json` package export.
- `grapher.d.ts`: TypeScript declaration entry point for the public API.

To compile these assets:

```bash
cd packages/@ourworldindata/grapher
yarn build
```

### Testing the build outputs

Two tools help verify the built package (both expect `yarn build` to have run first):

- `yarn testPackage` verifies the package as it would be published. It first packs it to `dist-package/grapher.tgz` (`yarn testPackage:pack` — a `yarn pack`, which applies `publishConfig`, then runs two checks over that tarball, each of which can also run individually after a pack:
    - `yarn testPackage:vitest` runs the smoke tests in `packageTest/`: they import both JS builds, mount a chart from the built code into a DOM, typecheck a simulated external consumer against the tarball's bundled type declarations — with `moduleResolution: bundler` and `nodenext`, plus a full check of the declaration bundle itself — and run a [publint](https://publint.dev) pass over the tarball's packaging metadata (with one known publint false positive excepted, documented in `packageTest/publint.packagetest.ts`). These tests are intentionally not part of the repo-wide `yarn test` since they depend on `dist/` and the packed tarball.
    - `yarn testPackage:attw` runs an [`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong.github.io) pass over the tarball's types/exports wiring. It checks the `esm-only` profile since the package ships no CJS, and excludes the `./grapher.css` entrypoint, which isn't a resolvable module.
- `yarn startDemoServer` serves this directory on http://localhost:8433 via `http-server` and opens `/demo.html`, which shows the three `GrapherLoader` variants. It's a plain static server, so the demo page loads `dist/` exactly like a CDN consumer would.

### Documentation

The public docs site at [docs.owid.io/projects/grapher](https://docs.owid.io/projects/grapher/) is built from `packageDocs/` at the repo root and deployed by the [Deploy package docs](../../../.github/workflows/deploy-docs-cf.yml) workflow. The API reference and schema reference pages are generated (`yarn buildDocsApi` / `yarn buildDocsSchema`, both after a `yarn build`); the rest is hand-written — keep it in sync when changing the public API or consumer-facing behavior. Preview locally with `yarn startPackageDocsServer` from the repo root.

### Publishing a release

Releases go to OWID's private registry at `https://packages.owid.io` (set as `publishConfig.registry`). From this directory, with the build verified (`yarn build` + `yarn testPackage`):

```bash
yarn bumpp
```

Once that commit & tag are pushed to `master`, a Buildkite pipeline runs a publish and will put the package release both onto our private npm registry, and will make the built files available on our Tailnet.
