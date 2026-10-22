/**
 * @vitest-environment happy-dom
 */

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest"
import { render } from "@testing-library/react"

import {
    BespokeMetadata,
    BlockSize,
    EnrichedBlockBespokeComponent,
    OwidGdocType,
} from "@ourworldindata/types"

import { mountBespokeComponentInShadow } from "../../../bespoke/shared/bespokeComponentShadowDom.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { FeaturedViz } from "./FeaturedViz.js"

vi.mock(import("../../../bespoke/shared/bespokeComponentShadowDom.js"), () => ({
    mountBespokeComponentInShadow: vi.fn(async () => ({})),
}))

vi.mock(import("../components/BespokeMetadataBox.js"), () => ({
    BespokeMetadataBox: () => <></>,
}))

beforeAll(() => {
    vi.stubGlobal(
        "IntersectionObserver",
        class {
            constructor(
                private readonly callback: IntersectionObserverCallback
            ) {}
            thresholds = [0]
            observe = (target: Element): void =>
                this.callback(
                    [
                        {
                            target,
                            isIntersecting: true,
                            intersectionRatio: 1,
                        } as IntersectionObserverEntry,
                    ],
                    this as unknown as IntersectionObserver
                )
            unobserve = vi.fn()
            disconnect = vi.fn()
        }
    )
})

afterAll(() => {
    vi.unstubAllGlobals()
})

beforeEach(() => {
    vi.mocked(mountBespokeComponentInShadow).mockClear()
})

function makeBespokeBlock(
    config: Record<string, string>
): EnrichedBlockBespokeComponent {
    return {
        type: "bespoke-component",
        bundle: "deforestation-trade",
        size: BlockSize.Wide,
        config,
        parseErrors: [],
    }
}

function renderFeaturedViz({
    bespokeMetadata,
}: {
    bespokeMetadata: BespokeMetadata | undefined
}): void {
    render(
        <AttachmentsContext.Provider
            value={{
                linkedCharts: {},
                linkedIndicators: {},
                linkedDocuments: {},
                imageMetadata: {},
                relatedCharts: [],
                tags: [],
                bespokeMetadata,
            }}
        >
            <FeaturedViz
                id="test"
                slug="test"
                published={true}
                publishedAt={new Date(0)}
                createdAt={new Date(0)}
                updatedAt={new Date(0)}
                manualBreadcrumbs={null}
                content={{
                    type: OwidGdocType.FeaturedViz,
                    title: "Test",
                    authors: [],
                    body: [
                        makeBespokeBlock({ product: "Beef" }),
                        makeBespokeBlock({ product: "Soy" }),
                    ],
                }}
            />
        </AttachmentsContext.Provider>
    )
}

function getMountCalls(): Parameters<
    typeof mountBespokeComponentInShadow
>[0][] {
    return vi
        .mocked(mountBespokeComponentInShadow)
        .mock.calls.map(([args]) => args)
}

describe("FeaturedViz bespoke embeds", () => {
    it("syncs the hero to the URL and hides its modal when the page shows the metadata box", async () => {
        renderFeaturedViz({ bespokeMetadata: {} })
        await vi.waitFor(() => expect(getMountCalls()).toHaveLength(2))

        const [hero, later] = getMountCalls()
        expect(hero.config).toStrictEqual({ product: "Beef", urlSync: "true" })
        expect(hero.embedOptions).toStrictEqual({ hideMetadataModal: true })
        expect(later.config).toStrictEqual({ product: "Soy" })
        expect(later.embedOptions).toBeUndefined()
    })

    it("keeps the hero's modal when the page has no metadata box", async () => {
        renderFeaturedViz({ bespokeMetadata: undefined })
        await vi.waitFor(() => expect(getMountCalls()).toHaveLength(2))

        const [hero] = getMountCalls()
        expect(hero.config).toStrictEqual({ product: "Beef", urlSync: "true" })
        expect(hero.embedOptions).toStrictEqual({ hideMetadataModal: false })
    })
})
