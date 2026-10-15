/**
 * @vitest-environment happy-dom
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type {
    BespokeVizRegistry,
    BespokeVizUsage,
    BundleReference,
    BundleUsage,
    ComponentInstance,
} from "@ourworldindata/types"
import { OwidGdocType } from "@ourworldindata/types"
import {
    BespokeBundleIndex,
    BespokeBundlePage,
} from "./GdocsReferenceBespoke.js"

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

// Each example widget renders as a stub carrying its preview path, so tests
// can count mounted previews without the admin context the real one needs.
vi.mock(import("./GdocsReferenceExample.js"), () => ({
    GdocsReferenceExample: ({
        archie,
        previewPath,
    }: {
        archie?: string
        previewPath?: string
    }) => (
        <div
            data-testid="example"
            data-preview={previewPath}
            data-archie={archie}
        />
    ),
}))

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

// A full bundle as the registry describes it
const fullBundle = (
    overrides: Partial<BundleReference> = {}
): BundleReference => ({
    id: "demo",
    entryFile: "bespoke/projects/demo/src/index.tsx",
    prose: { intro: "" },
    examples: [],
    variants: ["chart", "map", "table"].map((name) => ({
        name,
        description: `The ${name} variant`,
        defaultSize: "wide",
        archie: `{.bespoke-component}\nbundle: demo\nvariant: ${name}\n{}`,
    })),
    config: [
        {
            name: "flow",
            type: "enum",
            values: ["import", "export"],
            default: "export",
            description: "Which flow to show",
        },
        { name: "title", type: "string", description: "The title" },
    ],
    ...overrides,
})

const instance = (gdocId: string): ComponentInstance => ({
    gdocId,
    slug: gdocId,
    title: `Title of ${gdocId}`,
    docType: OwidGdocType.Article,
    path: "$.body[0]",
    publishedAt: null,
    variation: "map",
    archie: `{.bespoke-component}\nbundle: demo\nvariant: map\n{}`,
})

// Usage of the demo bundle: `map` used twice, in two docs
const demoUsage: BundleUsage = {
    bundle: "demo",
    uses: 2,
    docs: 2,
    variants: [
        {
            variant: "map",
            known: true,
            uses: 2,
            docs: 2,
            instances: [instance("doc-new"), instance("doc-old")],
        },
    ],
    configAdoption: { flow: 1 },
}

// An intro authoring one ArchieML example, as docs.md would
const proseWithFence = (archie: string): string =>
    `How to use this bundle.\n\n\`\`\`archie\n${archie}\n\`\`\`\n`

// The first fence of the intro, as the generator records it
const authoredExample = (
    archie: string
): BundleReference["examples"][number] => ({
    archie,
    flavour: "archie",
    section: "intro",
    position: 0,
})

function renderBundlePage(bundleId = "demo"): void {
    render(
        <MemoryRouter>
            <BespokeBundlePage bundleId={bundleId} />
        </MemoryRouter>
    )
}

const previews = (): (string | null)[] =>
    screen
        .queryAllByTestId("example")
        .map((example) => example.getAttribute("data-preview"))

describe(BespokeBundlePage, () => {
    beforeEach(() => {
        responses.clear()
    })

    it("says so for an unknown bundle, linking to the bespoke component", () => {
        responses.set(REGISTRY_PATH, { bundles: [fullBundle()] })
        responses.set(USAGE_PATH, { bundles: [] })
        renderBundlePage("nope")

        expect(screen.getByText(/No such bundle/)).toBeTruthy()
        expect(
            screen
                .getByRole("link", {
                    name: "See the bundles of the bespoke component.",
                })
                .getAttribute("href")
        ).toBe("/gdocs-reference/components/bespoke-component")
    })

    it("says so when the registry failed to load", () => {
        responses.set(REGISTRY_PATH, null)
        responses.set(USAGE_PATH, { bundles: [] })
        renderBundlePage()

        expect(screen.getByText("We couldn't load this bundle.")).toBeTruthy()
    })

    it("mounts no preview for a collapsed card, and opens it on click", () => {
        responses.set(REGISTRY_PATH, { bundles: [fullBundle()] })
        responses.set(USAGE_PATH, { bundles: [] })
        renderBundlePage()

        // Only the first variant is open; the others wait in the tail
        expect(screen.getByText("2 variants not used yet")).toBeTruthy()
        expect(previews()).toEqual([
            "/gdocs-reference/bespoke-viz/demo/preview?variant=chart",
        ])

        const mapToggle = screen.getByRole("button", { name: /^map/ })
        expect(mapToggle.getAttribute("aria-expanded")).toBe("false")
        fireEvent.click(mapToggle)
        expect(mapToggle.getAttribute("aria-expanded")).toBe("true")
        expect(previews()).toEqual([
            "/gdocs-reference/bespoke-viz/demo/preview?variant=chart",
            "/gdocs-reference/bespoke-viz/demo/preview?variant=map",
        ])
    })

    it("steps the carousel to the next published use", () => {
        responses.set(REGISTRY_PATH, { bundles: [fullBundle()] })
        responses.set(USAGE_PATH, { bundles: [demoUsage] })
        renderBundlePage()

        // The used variant leads, with its default block and its first use
        expect(screen.getByText("2 uses in 2 docs")).toBeTruthy()
        expect(screen.getByText("use 1 of 2")).toBeTruthy()
        expect(screen.getByText("Title of doc-new")).toBeTruthy()
        expect(previews()).toEqual([
            "/gdocs-reference/bespoke-viz/demo/preview?variant=map",
            "/gdocs-reference/instance/preview?gdocId=doc-new&path=%24.body%5B0%5D",
        ])

        fireEvent.click(screen.getByTitle("Next use"))
        expect(screen.getByText("use 2 of 2")).toBeTruthy()
        expect(screen.getByText("Title of doc-old")).toBeTruthy()
        expect(previews()[1]).toBe(
            "/gdocs-reference/instance/preview?gdocId=doc-old&path=%24.body%5B0%5D"
        )
    })

    it("previews a docs.md example only in the prose", () => {
        const archie = "{.bespoke-component}\nbundle: demo\nvariant: table\n{}"
        responses.set(REGISTRY_PATH, {
            bundles: [
                fullBundle({
                    prose: { intro: proseWithFence(archie) },
                    examples: [authoredExample(archie)],
                }),
            ],
        })
        responses.set(USAGE_PATH, { bundles: [] })
        renderBundlePage()

        // The prose example, then the first variant's default block: the
        // unused table variant stays collapsed and doesn't repeat it
        expect(previews()).toEqual([
            "/gdocs-reference/bespoke-viz/demo/preview?example=0",
            "/gdocs-reference/bespoke-viz/demo/preview?variant=chart",
        ])
        const tableToggle = screen.getByRole("button", { name: /^table/ })
        expect(tableToggle.getAttribute("aria-expanded")).toBe("false")
    })

    it("leaves a used variant's example to the prose", () => {
        const archie = "{.bespoke-component}\nbundle: demo\nvariant: map\n{}"
        responses.set(REGISTRY_PATH, {
            bundles: [
                fullBundle({
                    prose: { intro: proseWithFence(archie) },
                    examples: [authoredExample(archie)],
                }),
            ],
        })
        responses.set(USAGE_PATH, { bundles: [demoUsage] })
        renderBundlePage()

        // Prose example, then the map card: default block and carousel only
        expect(previews()).toEqual([
            "/gdocs-reference/bespoke-viz/demo/preview?example=0",
            "/gdocs-reference/bespoke-viz/demo/preview?variant=map",
            "/gdocs-reference/instance/preview?gdocId=doc-new&path=%24.body%5B0%5D",
        ])
        expect(screen.getByText("use 1 of 2")).toBeTruthy()
    })

    it("warns about stale variants, with their use counts", () => {
        responses.set(REGISTRY_PATH, { bundles: [fullBundle()] })
        responses.set(USAGE_PATH, {
            bundles: [
                {
                    ...demoUsage,
                    variants: [
                        ...demoUsage.variants,
                        {
                            variant: "old",
                            known: false,
                            uses: 3,
                            docs: 1,
                            instances: [instance("doc-stale")],
                        },
                        {
                            variant: null,
                            known: false,
                            uses: 1,
                            docs: 1,
                            instances: [instance("doc-bare")],
                        },
                    ],
                },
            ],
        })
        renderBundlePage()

        expect(
            screen.getByText(/variant this bundle doesn't have/).textContent
        ).toBe(
            "Published uses with a variant this bundle doesn't have: old (3 uses), (no variant) (1 use)."
        )
        // Stale variants get no card and no carousel
        expect(screen.queryByText("Title of doc-stale")).toBeNull()
        expect(screen.queryByRole("button", { name: /^old/ })).toBeNull()
    })

    it("lists config values as chips, with the default highlighted", () => {
        responses.set(REGISTRY_PATH, { bundles: [fullBundle()] })
        responses.set(USAGE_PATH, { bundles: [demoUsage] })
        renderBundlePage()

        const table = screen.getByRole("table")
        const exportChip = within(table).getByText("export")
        const importChip = within(table).getByText("import")
        expect(exportChip.className).toContain(
            "gdocs-ref-live__props-choice--default"
        )
        expect(importChip.className).not.toContain(
            "gdocs-ref-live__props-choice--default"
        )
        expect(within(table).getByText("Adoption")).toBeTruthy()
        expect(within(table).getByText("1 of 2")).toBeTruthy()
    })

    it("hides the adoption column and the badges when usage failed", () => {
        responses.set(REGISTRY_PATH, { bundles: [fullBundle()] })
        responses.set(USAGE_PATH, null)
        renderBundlePage()

        const table = screen.getByRole("table")
        expect(within(table).queryByText("Adoption")).toBeNull()
        expect(screen.queryByText(/not used yet|uses? in/)).toBeNull()
        expect(screen.getByText("2 more variants")).toBeTruthy()
    })
})
