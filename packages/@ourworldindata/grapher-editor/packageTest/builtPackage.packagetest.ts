/**
 * @vitest-environment happy-dom
 */

// Smoke tests for the build outputs in dist/: are both JS builds importable,
// do they export the public API, did the admin stay out of the bundle, and
// can the built code mount the editor into a DOM container?
//
// Requires `yarn build` to have run first; execute via `yarn testPackage`.

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import {
    assertFilesExist,
    readImportSpecifiers,
    stubImmediateIntersectionObserver,
    // oxlint-disable-next-line import-x-js/no-relative-packages
} from "../../packageTest-common.mts"

afterEach(() => {
    vi.unstubAllGlobals()
})

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(pkgDir, "dist")

const npmBuildPath = path.join(distDir, "editor.react.js")
const standalonePath = path.join(distDir, "editor.standalone.min.js")
const cssPath = path.join(distDir, "editor.css")

const PUBLIC_FUNCTIONS = [
    "GrapherEditor",
    "mountGrapherEditor",
    "dataApiIndicatorStore",
    "tableIndicatorStore",
    "csvIndicatorStore",
    "OwidTable",
]

const csv = `entityName,year,rent_index
Berlin,2015,100
Berlin,2020,131
Vienna,2015,100
Vienna,2020,112`

const columnDefs = [{ slug: "rent_index", type: "Numeric", name: "Rent index" }]

function assertHasPublicExports(mod: Record<string, unknown>): void {
    for (const name of PUBLIC_FUNCTIONS)
        expect(typeof mod[name], `export ${name}`).toBe("function")
}

beforeAll(() => {
    assertFilesExist(
        pkgDir,
        [npmBuildPath, standalonePath, cssPath],
        "`yarn build`"
    )
})

describe("npm build (dist/editor.react.js)", () => {
    it("is importable and exports the public API", async () => {
        const mod = await import(pathToFileURL(npmBuildPath).href)
        assertHasPublicExports(mod)
    })

    it("keeps react and react-dom external", async () => {
        const specifiers = await readImportSpecifiers(npmBuildPath)
        expect(specifiers).toContain("react")
        expect(specifiers).toContain("react-dom/client")
    })

    it("contains no runtime require calls", () => {
        // See the same test in ../../grapher/packageTest/builtPackage.packagetest.ts
        expect(fs.readFileSync(npmBuildPath, "utf8")).not.toMatch(/__require\(/)
    })

    it("bundles none of the admin around the editor", () => {
        // The editor's sources sit among the admin's (adminSiteClient/), so
        // one stray import pulls in the admin app, its API client or its
        // router. The source map lists every module that went in.
        const { sources } = JSON.parse(
            fs.readFileSync(`${npmBuildPath}.map`, "utf8")
        ) as { sources: string[] }
        const adminOnly = sources.filter((source) =>
            /adminSiteClient\/Admin(App|AppContext)?\.tsx?$|settings\/clientSettings|node_modules\/(react-router|react-router-dom|@tanstack\/react-query)\//.test(
                source
            )
        )
        expect(adminOnly).toEqual([])
    })
})

describe("standalone bundle (dist/editor.standalone.min.js)", () => {
    it("is importable and exports the public API", async () => {
        const mod = await import(pathToFileURL(standalonePath).href)
        assertHasPublicExports(mod)
    })

    it("has no external imports and runs no __require calls", async () => {
        const specifiers = await readImportSpecifiers(standalonePath)
        expect([...specifiers].filter((s) => !s.startsWith("."))).toEqual([])
        expect(fs.readFileSync(standalonePath, "utf8")).not.toMatch(
            /__require\(/
        )
    })

    it("mounts the editor over a CSV and previews the chart", async () => {
        stubImmediateIntersectionObserver()
        const { csvIndicatorStore, mountGrapherEditor } = await import(
            pathToFileURL(standalonePath).href
        )
        const container = document.createElement("div")
        document.body.appendChild(container)

        const handle = mountGrapherEditor(container, {
            config: {
                title: "Rents",
                dimensions: [{ property: "y", slug: "rent_index" }],
                selectedEntityNames: ["Berlin", "Vienna"],
            },
            store: csvIndicatorStore({ csv, columnDefs }),
            onSave: () => undefined,
        })

        await vi.waitFor(() => {
            expect(
                container.querySelectorAll(".nav-tabs .nav-link").length
            ).toBeGreaterThan(3)
            // The preview has drawn the chart, not just its wrapper
            expect(
                container.querySelector(".GrapherComponent svg")
            ).toBeTruthy()
        })
        expect(
            container.querySelector(".GrapherComponent")?.textContent
        ).toContain("Rents")

        handle.unmount()
        expect(container.innerHTML).toBe("")
        container.remove()
    })
})

describe("stylesheet (dist/editor.css)", () => {
    it("contains the editor's and grapher's styles", () => {
        const css = fs.readFileSync(cssPath, "utf8")
        expect(css).toContain(".ChartEditorPage")
        expect(css).toContain(".GrapherComponent")
    })
})
