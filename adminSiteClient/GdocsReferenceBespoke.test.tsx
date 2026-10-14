/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type {
    BespokeVizRegistry,
    BespokeVizUsage,
    BundleReference,
} from "@ourworldindata/types"
import { BespokeBundleIndex } from "./GdocsReferenceBespoke.js"

// What each admin API path returns in the current test: undefined while
// loading, null on failure — the same contract as the real hook.
const responses = vi.hoisted(() => new Map<string, unknown>())

vi.mock(import("./gdocsReferenceLiveHelpers.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        useAdminJson: ((path: string) =>
            responses.get(path)) as typeof actual.useAdminJson,
    }
})

const REGISTRY_PATH = "/api/gdocs-reference/bespoke-viz.json"
const USAGE_PATH = "/api/gdocs-reference/bespoke-viz/usage.json"

const bundle = (id: string, variants: string[]): BundleReference =>
    ({
        id,
        variants: variants.map((name) => ({ name })),
    }) as unknown as BundleReference

// Registry order, deliberately not id order
const registry: BespokeVizRegistry = {
    bundles: [
        bundle("migration", ["sankey"]),
        bundle("causes-of-death", ["treemap"]),
        bundle("demography", ["simulation", "population"]),
    ],
}

const usage: BespokeVizUsage = {
    bundles: [
        {
            bundle: "causes-of-death",
            uses: 12,
            docs: 4,
            variants: [],
            configAdoption: {},
        },
        {
            bundle: "migration",
            uses: 1,
            docs: 1,
            variants: [],
            configAdoption: {},
        },
    ],
}

function renderIndex(): void {
    render(
        <MemoryRouter>
            <BespokeBundleIndex />
        </MemoryRouter>
    )
}

function rowTexts(): string[] {
    return screen.getAllByRole("listitem").map((row) => row.textContent ?? "")
}

function rowLinks(): (string | null)[] {
    return screen.getAllByRole("link").map((link) => link.getAttribute("href"))
}

describe(BespokeBundleIndex, () => {
    beforeEach(() => {
        responses.clear()
    })

    it("lists bundles by uses, with their variants and usage", () => {
        responses.set(REGISTRY_PATH, registry)
        responses.set(USAGE_PATH, usage)
        renderIndex()

        expect(rowTexts()).toEqual([
            "causes-of-deathtreemap12 uses in 4 docs",
            "migrationsankey1 use in 1 doc",
            "demographysimulation · populationnot used yet",
        ])
        expect(rowLinks()).toEqual([
            "/gdocs-reference/components/bespoke-component/causes-of-death",
            "/gdocs-reference/components/bespoke-component/migration",
            "/gdocs-reference/components/bespoke-component/demography",
        ])
    })

    it("lists bundles by id without a usage line when usage failed", () => {
        responses.set(REGISTRY_PATH, registry)
        responses.set(USAGE_PATH, null)
        renderIndex()

        expect(rowLinks()).toEqual([
            "/gdocs-reference/components/bespoke-component/causes-of-death",
            "/gdocs-reference/components/bespoke-component/demography",
            "/gdocs-reference/components/bespoke-component/migration",
        ])
        for (const text of rowTexts()) {
            expect(text).not.toMatch(/\d+ uses? in|not used yet/)
        }
    })

    it("says so when the bundle list failed to load", () => {
        responses.set(REGISTRY_PATH, null)
        responses.set(USAGE_PATH, usage)
        renderIndex()

        expect(
            screen.queryByText("We couldn't load the bundle list.")
        ).not.toBeNull()
        expect(screen.queryAllByRole("listitem")).toHaveLength(0)
    })
})
