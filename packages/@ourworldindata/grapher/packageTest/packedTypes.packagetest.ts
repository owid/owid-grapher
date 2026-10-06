// Typechecks the packed package from an external consumer project; see
// describePackedPackage for what exactly is checked.
//
// Requires `yarn build` and `yarn testPackage:pack` to have run first;
// execute via `yarn testPackage` (or just this vitest part via
// `yarn testPackage:vitest`).

import * as path from "node:path"
import { fileURLToPath } from "node:url"
// oxlint-disable-next-line import-x-js/no-relative-packages
import { describePackedPackage } from "../../packageTest-common.mts"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Exercises the public API surface, incl. @ts-expect-error guards that the
// types didn't collapse to `any`.
const CONSUMER_SOURCE = `import {
    ColumnTypeNames,
    DimensionProperty,
    Grapher,
    GrapherLoader,
    OwidTable,
    type FromApiOptions,
    type FromCsvOptions,
    type FromTableOptions,
    type GrapherInterface,
} from "@ourworldindata/grapher"
import { GrapherLoader as GrapherLoaderReact } from "@ourworldindata/grapher/react"

// Both entrypoints share the same declaration bundle.
GrapherLoaderReact satisfies typeof GrapherLoader

const config: GrapherInterface = { title: "Smoke test chart" }

const tableOptions: FromTableOptions = { config, data: new OwidTable() }
const loader: GrapherLoader = GrapherLoader.fromTable(tableOptions)
loader.mount(document.body)
loader.grapherState.externalBounds satisfies unknown
const ready: Promise<void> = loader.ready
void ready
loader.dispose()

const csvOptions: FromCsvOptions = {
    config,
    csvUrl: "https://example.org/data.csv",
    columnDefs: [
        { slug: "gdp", type: ColumnTypeNames.Numeric, name: "GDP" },
    ],
}
GrapherLoader.fromCsv(csvOptions)
GrapherLoader.fromCsv({ config, csv: "entityName,entityCode,entityId,year" })

// @ts-expect-error csv and csvUrl are mutually exclusive
GrapherLoader.fromCsv({ config, csv: "entityName", csvUrl: "./data.csv" })

// @ts-expect-error one of csv and csvUrl is required
GrapherLoader.fromCsv({ config })

const apiOptions: FromApiOptions = {
    config: {
        ...config,
        dimensions: [{ property: DimensionProperty.y, variableId: 1118466 }],
    },
}
GrapherLoader.fromApi(apiOptions)

// @ts-expect-error csvUrl must be a string
GrapherLoader.fromCsv({ config, csvUrl: 123 })

// @ts-expect-error fromTable requires a data table
GrapherLoader.fromTable({ config })

// @ts-expect-error fromApi requires dimensions in the config
GrapherLoader.fromApi({ config })

console.log(Grapher.name)
`

describePackedPackage({
    packageName: "@ourworldindata/grapher",
    tarballPath: path.join(pkgDir, "dist-package/grapher.tgz"),
    declarationFile: "dist/grapher.d.ts",
    manifest: {
        main: "dist/grapher.standalone.min.js",
        types: "dist/grapher.d.ts",
        exports: { "./grapher-schema.json": "./dist/grapher-schema.json" },
        // Only the react peer deps (and their types).
        peerDependencies: ["@types/react", "react", "react-dom"],
        files: [
            "dist/grapher.css",
            "dist/grapher-schema.json",
            "dist/grapher.react.js",
        ],
    },
    maxEntries: 20,
    // csstype is required by @types/react.
    typeDependencies: ["@types/react", "@types/react-dom", "csstype"],
    // react and react-dom (incl. subpaths like react/jsx-runtime), which
    // consumers have anyway since they're peer dependencies.
    allowedTypeImports: /^react(-dom)?(\/|$)/,
    consumerSource: CONSUMER_SOURCE,
})
