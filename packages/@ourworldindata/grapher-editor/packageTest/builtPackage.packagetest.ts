/**
 * @vitest-environment happy-dom
 */

// Smoke tests for the build outputs in dist/: are both JS builds importable,
// do they export the public API, does a CSV store translate configs the way
// the source does, and can the built code mount the editor into a DOM
// container? Requires `yarn build` to have run first; run via `yarn testPackage`.

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { beforeAll, describe, expect, it } from "vitest"

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(pkgDir, "dist")

const npmBuildPath = path.join(distDir, "editor.react.js")
const standalonePath = path.join(distDir, "editor.standalone.min.js")
const cssPath = path.join(distDir, "editor.css")
const dtsPath = path.join(distDir, "editor.d.ts")

const PUBLIC_FUNCTIONS = [
    "GrapherEditor",
    "mountGrapherEditor",
    "dataApiIndicatorStore",
    "tableIndicatorStore",
    "csvIndicatorStore",
    "OwidTable",
]

const csv = `entityName,year,rent_index,region
Berlin,2015,100,DE
Berlin,2020,131,DE
Vienna,2015,100,AT
Vienna,2020,112,AT`

function assertPublicApi(mod: Record<string, any>): void {
    for (const name of PUBLIC_FUNCTIONS) {
        expect(typeof mod[name], `export ${name}`).toBe("function")
    }
    expect(mod.defaultEditorEnvironment.dataApiUrl).toMatch(/^https:\/\//)

    const store = mod.csvIndicatorStore({
        csv,
        columnDefs: [
            { slug: "rent_index", type: "Numeric", name: "Rent index" },
        ],
    })
    const editorConfig = store.toEditorConfig({
        ySlugs: "rent_index",
        colorSlug: "region",
    })
    expect(editorConfig.dimensions).toEqual([
        { property: "y", variableId: 1 },
        { property: "color", variableId: 2 },
    ])
    expect(store.fromEditorConfig(editorConfig)).toEqual({
        ySlugs: "rent_index",
        colorSlug: "region",
    })
}

beforeAll(() => {
    for (const file of [npmBuildPath, standalonePath, cssPath, dtsPath]) {
        if (!fs.existsSync(file))
            throw new Error(
                `Missing build output ${path.relative(pkgDir, file)} — run \`yarn build\` in packages/@ourworldindata/grapher-editor first.`
            )
    }
})

describe("editor.react.js (npm build)", () => {
    it("exports the public API and translates a CSV config", async () => {
        const mod = await import(pathToFileURL(npmBuildPath).href)
        assertPublicApi(mod)
    })

    it("leaves react external", () => {
        const source = fs.readFileSync(npmBuildPath, "utf8")
        expect(source).toMatch(/from\s*["']react["']/)
    })
})

describe("editor.standalone.min.js (CDN bundle)", () => {
    it("exports the public API", async () => {
        const mod = await import(pathToFileURL(standalonePath).href)
        assertPublicApi(mod)
    })

    it("mounts the editor into a container from a CSV store", async () => {
        const mod = await import(pathToFileURL(standalonePath).href)
        const container = document.createElement("div")
        document.body.appendChild(container)
        const store = mod.csvIndicatorStore({
            csv,
            columnDefs: [
                { slug: "rent_index", type: "Numeric", name: "Rent index" },
            ],
        })
        const handle = mod.mountGrapherEditor(container, {
            config: { title: "Rents", ySlugs: "rent_index" },
            store,
            onSave: () => undefined,
        })
        // The editor renders its tab strip synchronously; the chart follows
        // once the (synchronous, in-memory) table is applied.
        await new Promise((resolve) => setTimeout(resolve, 500))
        expect(
            container.querySelectorAll(".nav-tabs .nav-link").length
        ).toBeGreaterThan(3)
        handle.unmount()
    })
})

describe("editor.css and editor.d.ts", () => {
    it("ship the editor's and grapher's styles and the public types", () => {
        const css = fs.readFileSync(cssPath, "utf8")
        expect(css).toContain(".ChartEditorPage")
        expect(css).toContain(".GrapherComponent")
        const dts = fs.readFileSync(dtsPath, "utf8")
        expect(dts).toContain("GrapherEditorProps")
        expect(dts).toContain("IndicatorStore")
        expect(dts).toContain("mountGrapherEditor")
    })
})
