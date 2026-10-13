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
    csvIndicatorStore,
    dataApiIndicatorStore,
    defaultEditorEnvironment,
    mountGrapherEditor,
    type ConfigEditor,
    type GrapherEditorProps,
    type GrapherInterface,
    type IndicatorStore,
} from "@ourworldindata/grapher-editor"
import {
    GrapherEditor,
    mountGrapherEditor as mountGrapherEditorReact,
} from "@ourworldindata/grapher-editor/react"

// Both entrypoints share the same declaration bundle.
mountGrapherEditorReact satisfies typeof mountGrapherEditor
GrapherEditor satisfies unknown

const config: GrapherInterface = {
    title: "Rents",
    dimensions: [{ property: DimensionProperty.y, slug: "rent_index" }],
}

const store: IndicatorStore = csvIndicatorStore({
    csv: "entityName,year,rent_index",
    columnDefs: [
        { slug: "rent_index", type: ColumnTypeNames.Numeric, name: "Rent index" },
    ],
})

const props: GrapherEditorProps = {
    config,
    store,
    environment: { ...defaultEditorEnvironment, etlWizardUrl: undefined },
    indicatorUrl: (dimension) => dimension.slug && "/columns/" + dimension.slug,
    onSave: (patch: GrapherInterface, editor: ConfigEditor) => {
        void editor.isModified
        return patch
    },
    onDirtyChange: (isModified: boolean) => void isModified,
    tabs: ["basic", "text"],
}

const handle = mountGrapherEditor(document.body, props)
void (dataApiIndicatorStore({ dataApiUrl: "https://example.org" }) satisfies IndicatorStore)
handle.unmount()

// @ts-expect-error onSave is required
mountGrapherEditor(document.body, { config, store })

// @ts-expect-error tabs only takes the editor's own tab names
mountGrapherEditor(document.body, { ...props, tabs: ["nonexistent"] })
`

describePackedPackage({
    packageName: "@ourworldindata/grapher-editor",
    tarballPath: path.join(pkgDir, "dist-package/grapher-editor.tgz"),
    declarationFile: "dist/editor.d.ts",
    manifest: {
        main: "dist/editor.standalone.min.js",
        types: "dist/editor.d.ts",
        exports: { "./editor.css": "./dist/editor.css" },
        peerDependencies: ["@types/react", "react", "react-dom"],
        files: ["dist/editor.css", "dist/editor.react.js"],
    },
    maxEntries: 20,
    // csstype is required by @types/react.
    typeDependencies: ["@types/react", "@types/react-dom", "csstype"],
    allowedTypeImports: /^react(-dom)?(\/|$)/,
    consumerSource: CONSUMER_SOURCE,
})
