/**
 * @vitest-environment happy-dom
 */

// Smoke tests for the build outputs in dist/: are the npm build and the CDN
// bundle importable, do they export the public API, and can the built code
// actually mount a chart into a DOM container?
//
// Requires `yarn build` to have run first; execute via `yarn testPackage`.

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { defaultGrapherConfig } from "../src/schema/defaultGrapherConfig.js"

afterEach(() => {
    vi.unstubAllGlobals()
})

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(pkgDir, "dist")

const npmBuildPath = path.join(distDir, "grapher.js")
const standalonePath = path.join(distDir, "grapher.standalone.min.js")
const cssPath = path.join(distDir, "grapher.css")
const schemaPath = path.join(distDir, "grapher-schema.json")
const dtsPath = path.join(distDir, "grapher.d.ts")

const PUBLIC_EXPORTS = [
    "Grapher",
    "FetchingGrapher",
    "OwidTable",
    "GrapherLoader",
]

function assertHasPublicExports(mod: Record<string, unknown>): void {
    for (const name of PUBLIC_EXPORTS) {
        expect(typeof mod[name], `export ${name}`).toBe("function")
    }
    const loader = mod.GrapherLoader as Record<string, unknown>
    expect(typeof loader.fromTable).toBe("function")
    expect(typeof loader.fromCsv).toBe("function")
    expect(typeof loader.fromApi).toBe("function")
}

beforeAll(() => {
    for (const file of [
        npmBuildPath,
        standalonePath,
        cssPath,
        schemaPath,
        dtsPath,
    ]) {
        if (!fs.existsSync(file))
            throw new Error(
                `Missing build output ${path.relative(pkgDir, file)} — run \`yarn build\` in packages/@ourworldindata/grapher first.`
            )
    }
})

// Grapher renders lazily once scrolled into view. happy-dom does no layout,
// so its IntersectionObserver never fires — replace it with one that reports
// the chart visible immediately.
function stubImmediateIntersectionObserver(): void {
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            constructor(
                private readonly callback: IntersectionObserverCallback
            ) {}
            observe(target: Element): void {
                this.callback(
                    [
                        {
                            isIntersecting: true,
                            target,
                        } as IntersectionObserverEntry,
                    ],
                    this as unknown as IntersectionObserver
                )
            }
            unobserve(): void {
                // noop
            }
            disconnect(): void {
                // noop
            }
        }
    )
}

// happy-dom does no layout, so give the container a real size for
// useElementBounds to measure.
function createSizedContainer(): HTMLDivElement {
    const container = document.createElement("div")
    container.getBoundingClientRect = (): DOMRect =>
        ({ x: 0, y: 0, width: 850, height: 600 }) as DOMRect
    document.body.appendChild(container)
    return container
}

describe("npm build (dist/grapher.js)", () => {
    it("is importable and exports the public API", async () => {
        const mod = await import(pathToFileURL(npmBuildPath).href)
        assertHasPublicExports(mod)
    })

    it("keeps react and react-dom external", () => {
        const source = fs.readFileSync(npmBuildPath, "utf8")
        expect(source).toMatch(/from\s*["']react["']/)
        expect(source).toMatch(/from\s*["']react-dom\/client["']/)
    })

    it("contains no runtime require calls", () => {
        const source = fs.readFileSync(npmBuildPath, "utf8")
        // A bundled CJS dependency that `require`s an external module (like
        // the use-sync-external-store shim requiring react, aliased away in
        // tsdown.config.ts) ends up as a runtime `__require` call, which
        // throws in ESM environments.
        expect(source).not.toMatch(/__require\(/)
    })

    it("mounts and disposes a chart via GrapherLoader.fromTable", async () => {
        stubImmediateIntersectionObserver()
        const { GrapherLoader, OwidTable } = await import(
            pathToFileURL(npmBuildPath).href
        )

        const table = new OwidTable(
            `entityName,entityCode,entityId,year,gdpPerCapita
United States,USA,1,2000,36330
United States,USA,1,2010,48468
United States,USA,1,2020,63544
Germany,DEU,2,2000,23705
Germany,DEU,2,2010,41785
Germany,DEU,2,2020,46468`,
            [
                {
                    slug: "gdpPerCapita",
                    type: "Numeric",
                    name: "GDP per capita",
                },
            ]
        )

        const container = createSizedContainer()

        const loader = GrapherLoader.fromTable({
            config: {
                title: "GDP per capita",
                selectedEntityNames: ["United States", "Germany"],
            },
            data: table,
        }).mount(container)

        // fromTable data is available immediately
        await expect(loader.ready).resolves.toBeUndefined()

        await vi.waitFor(() => {
            expect(container.querySelector("svg")).toBeTruthy()
        })
        expect(container.textContent).toContain("GDP per capita")

        expect(() => loader.mount(container)).toThrow(/already mounted/)

        loader.dispose()
        expect(container.innerHTML).toBe("")

        container.remove()
    })

    it("mounts a chart from an inline CSV string via GrapherLoader.fromCsv", async () => {
        stubImmediateIntersectionObserver()
        const { GrapherLoader } = await import(pathToFileURL(npmBuildPath).href)
        const container = createSizedContainer()

        const loader = GrapherLoader.fromCsv({
            config: { title: "Population" },
            csv: `entityName,entityCode,entityId,year,population
France,FRA,1,2000,59000000
France,FRA,1,2020,67000000`,
            columnDefs: [
                {
                    slug: "population",
                    type: "Numeric",
                    name: "Population",
                    sourceName: "World Population Bureau",
                },
            ],
        }).mount(container)

        // inline CSV data is available immediately
        await expect(loader.ready).resolves.toBeUndefined()

        await vi.waitFor(() => {
            expect(container.querySelector("svg")).toBeTruthy()
        })
        expect(container.textContent).toContain("Population")

        // Configs without dimensions/ySlugs get their y columns derived from
        // the table, so that column metadata (sources modal, footer
        // attribution) is picked up
        expect(loader.grapherState.ySlugs).toBe("population")
        expect(container.textContent).toContain("World Population Bureau")

        loader.dispose()
        container.remove()
    })
})

describe("standalone bundle (dist/grapher.standalone.min.js)", () => {
    it("is importable and exports the public API", async () => {
        const mod = await import(pathToFileURL(standalonePath).href)
        assertHasPublicExports(mod)
    })

    it("has no external imports (react is bundled in)", () => {
        const source = fs.readFileSync(standalonePath, "utf8")
        // The bundle must be usable from a plain HTML page, so it may not
        // import any bare module specifiers.
        expect(source).not.toMatch(/from\s*["']react["']/)
        expect(source).not.toMatch(/from\s*["'](?![./])/)
        // ... nor call `__require` at runtime (see the npm build test).
        expect(source).not.toMatch(/__require\(/)
    })
})

describe("stylesheet (dist/grapher.css)", () => {
    it("contains the grapher styles", () => {
        const css = fs.readFileSync(cssPath, "utf8")
        expect(css.length).toBeGreaterThan(10_000)
        expect(css).toContain(".GrapherComponent")
    })
})

describe("JSON schema (dist/grapher-schema.json)", () => {
    it("matches the schema version used by the package", () => {
        const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8")) as {
            $id: string
        }

        expect(schema.$id).toBe(defaultGrapherConfig.$schema)
    })
})

describe("type declarations (dist/grapher.d.ts)", () => {
    it("does not augment the global scope or third-party modules", () => {
        // A `declare global` block (or a top-level module augmentation like
        // `declare module "react"`) anywhere in our source ends up in the
        // bundled declarations, where it silently rewrites those types in
        // every consumer's project — e.g. a Window augmentation would make
        // `window.admin` an `any` for everyone who imports this package.
        // Keep such augmentations out of the published type surface; type
        // globals locally at the use site instead (see getWindowAdmin in
        // GrapherState.tsx).
        const dts = fs.readFileSync(dtsPath, "utf8")
        expect(dts).not.toMatch(/^\s*declare\s+global\b/m)
        expect(dts).not.toMatch(/^\s*declare\s+module\s+["']/m)
    })
})
