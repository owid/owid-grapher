# Getting started

[`GrapherLoader`](api/index.md) is the main entry point: pick a data source via one of its static factories, then `mount` it into a sized container element.

!!! warning "Private package — restricted access"

    Installing the package requires an auth token for OWID's private registry, which is not generally available at the moment — see [Installation & access](#installation-access) below.

## Which entry point?

The package has two entry points sharing the same API and type declarations — pick by whether your page already has React:

| Entry point                     | What it is                                                                | Use it in …                                                   |
| ------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `@ourworldindata/grapher`       | the standalone bundle: minified, with React baked in                      | plain HTML pages, static sites, and apps that don't use React |
| `@ourworldindata/grapher/react` | the library build, with `react` and `react-dom` (19) as peer dependencies | React apps and anywhere else React is already a dependency    |

React apps must use `/react`: importing the root export there would silently ship a second copy of React alongside the one your app already has.

## With a bundler

=== "Non-React"

    Import from the root export, the standalone bundle with React baked in. `mount` just needs a sized container element:

    ```js
    import { GrapherLoader } from "@ourworldindata/grapher"
    import "@ourworldindata/grapher/grapher.css"

    // the container needs an explicit size, e.g. `aspect-ratio: 850 / 600`
    GrapherLoader.fromApi({
        config: {
            title: "Life expectancy",
            selectedEntityNames: ["World", "Africa", "Europe"],
            dimensions: [{ property: "y", variableId: 1118466 }],
        },
    }).mount(document.querySelector("#chart"))
    ```

=== "React"

    Import from `/react`, which uses your app's own copy of React:

    ```tsx
    import { useEffect, useRef } from "react"
    import { DimensionProperty, GrapherLoader } from "@ourworldindata/grapher/react"
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

### Styles and fonts

- **Styles** (required): import `@ourworldindata/grapher/grapher.css`, or link it as a stylesheet.
- **Fonts** (optional): charts are designed for **Lato** and **Playfair Display** and fall back to system fonts if absent. Load them yourself, or link OWID's font stylesheet: `<link rel="stylesheet" href="https://ourworldindata.org/fonts.css" />`.

## Plain HTML (standalone bundle)

For static sites or non-React applications, use the standalone bundle (`dist/grapher.standalone.min.js`), which has React baked in. In an installed package it is the root `@ourworldindata/grapher` export; the relative paths below are for `dist/` files copied onto a static host or CDN.

```html
<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Embed Grapher</title>
        <link rel="stylesheet" href="https://ourworldindata.org/fonts.css" />
        <link rel="stylesheet" href="path/to/dist/grapher.css" />
        <style>
            #chart {
                width: 100%;
                max-width: 800px;
                aspect-ratio: 850 / 600;
            }
        </style>
    </head>
    <body>
        <div id="chart"></div>

        <script type="module">
            import { GrapherLoader } from "./path/to/dist/grapher.standalone.min.js"

            GrapherLoader.fromCsv({
                config: {
                    title: "My Custom Chart",
                    selectedEntityNames: ["France", "Germany"],
                },
                csvUrl: "./data.csv",
                columnDefs: [
                    {
                        slug: "indicator_slug",
                        type: "Numeric",
                        name: "Indicator Name",
                        unit: "units",
                    },
                ],
            }).mount(document.getElementById("chart"))
        </script>
    </body>
</html>
```

A complete working example lives in the repository: [`demo.html`](https://github.com/owid/owid-grapher/blob/master/packages/@ourworldindata/grapher/demo.html) with [`demo.csv`](https://github.com/owid/owid-grapher/blob/master/packages/@ourworldindata/grapher/demo.csv), which shows all three `GrapherLoader` variants.

## Installation & access

!!! warning "Not generally available"

    `@ourworldindata/grapher` is published to OWID's private registry at `https://packages.owid.io` under a proprietary license. Installing it requires an auth token for that registry, which is not generally available at the moment.

Point your package manager at the registry:

=== "npm"

    In the consuming project's `.npmrc`:

    ```
    @ourworldindata:registry=https://packages.owid.io
    //packages.owid.io/:_authToken=<your auth token>
    ```

    ```bash
    npm install @ourworldindata/grapher
    ```

=== "Yarn"

    In the consuming project's `.yarnrc.yml`:

    ```yaml
    npmScopes:
        ourworldindata:
            npmRegistryServer: "https://packages.owid.io"
            npmAuthToken: "<your auth token>"
    ```

    ```bash
    yarn add @ourworldindata/grapher
    ```

The package is **ESM-only**. It ships two entry points — see [Which entry point?](#which-entry-point) above for choosing between the root export and `/react`.
