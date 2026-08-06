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

afterEach(() => {
    vi.unstubAllGlobals()
})

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const distDir = path.join(pkgDir, "dist")

const npmBuildPath = path.join(distDir, "grapher.js")
const cdnBundlePath = path.join(distDir, "grapher.bundle.js")
const cssPath = path.join(distDir, "grapher.css")
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
    for (const file of [npmBuildPath, cdnBundlePath, cssPath, dtsPath]) {
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
                { slug: "population", type: "Numeric", name: "Population" },
            ],
        }).mount(container)

        // inline CSV data is available immediately
        await expect(loader.ready).resolves.toBeUndefined()

        await vi.waitFor(() => {
            expect(container.querySelector("svg")).toBeTruthy()
        })
        expect(container.textContent).toContain("Population")

        loader.dispose()
        container.remove()
    })
})

describe("CDN bundle (dist/grapher.bundle.js)", () => {
    it("is importable and exports the public API", async () => {
        const mod = await import(pathToFileURL(cdnBundlePath).href)
        assertHasPublicExports(mod)
    })

    it("has no external imports (react is bundled in)", () => {
        const source = fs.readFileSync(cdnBundlePath, "utf8")
        // The bundle must be usable from a plain HTML page, so it may not
        // import any bare module specifiers.
        expect(source).not.toMatch(/from\s*["']react["']/)
        expect(source).not.toMatch(/from\s*["'](?![./])/)
    })
})

describe("stylesheet (dist/grapher.css)", () => {
    it("contains the grapher styles", () => {
        const css = fs.readFileSync(cssPath, "utf8")
        expect(css.length).toBeGreaterThan(10_000)
        expect(css).toContain(".GrapherComponent")
    })
})
