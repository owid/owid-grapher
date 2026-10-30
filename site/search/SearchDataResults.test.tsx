/**
 * @vitest-environment happy-dom
 */

import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { LiteClient } from "algoliasearch/lite"
import {
    Filter,
    SearchChartHit,
    SearchResultType,
    SearchState,
} from "@ourworldindata/types"
import { SearchContext } from "./SearchContext.js"
import { SearchDataResults } from "./SearchDataResults.js"
import { createTopicFilter } from "./searchUtils.js"

/**
 * The Data section puts at most one featured-viz page above the chart hits.
 * It comes from its own request, sent only when there is query text; it
 * shows even when no chart matched, and a failed or empty featured-viz
 * request leaves the section as it is without it.
 *
 * These tests render the real section, queries and React Query hooks against
 * a fake Algolia client. Only the chart hit component is stubbed, since it
 * fetches chart data of its own.
 */

vi.mock(import("./SearchChartHitComponent.js"), () => ({
    SearchChartHitComponent: ({ hit }: { hit: SearchChartHit }) => (
        <a href={`/grapher/${hit.slug}`}>{hit.title}</a>
    ),
}))

type FeaturedVizResponse =
    | "migration-page"
    | "bare-migration-page"
    | "no-match"
    | "error"

/** A featured-viz hit with every field the card shows */
const migrationPage = {
    objectID: "migration-c0",
    type: "featured-viz",
    title: "Where do migrants live?",
    slug: "migration",
    thumbnailUrl: "https://ourworldindata.org/images/migration-thumbnail.png",
    authors: ["Hannah Ritchie", "Sophia Mersmann", "Tuna Acisu"],
    excerpt: "Where migrants were born, and where they live now.",
}

/** The same page as the indexer sends it when the Cloudflare image is
 *  missing, with no authors or excerpt */
const bareMigrationPage = {
    objectID: "migration-c0",
    type: "featured-viz",
    title: "Where do migrants live?",
    slug: "migration",
    thumbnailUrl: "",
}

const chartHit = (slug: string): Record<string, unknown> => ({
    objectID: slug,
    slug,
    title: `Chart ${slug}`,
    type: "chart",
})

/** Answers chart requests with `chartHits` and the featured-viz request
 *  according to `featuredViz`. Records every request it receives. */
function makeClient(options: {
    chartHits: Record<string, unknown>[]
    featuredViz: FeaturedVizResponse
}): { client: LiteClient; requests: Record<string, unknown>[] } {
    const requests: Record<string, unknown>[] = []
    const searchForHits = vi.fn(async (batch: Record<string, unknown>[]) => {
        requests.push(...batch)
        const [request] = batch
        if (request.filters === "type:featured-viz") {
            if (options.featuredViz === "error")
                throw new Error("Algolia is down")
            const hits =
                options.featuredViz === "migration-page"
                    ? [migrationPage]
                    : options.featuredViz === "bare-migration-page"
                      ? [bareMigrationPage]
                      : []
            return { results: [{ hits, nbHits: hits.length }] }
        }
        const hits = options.chartHits
        return {
            results: [{ hits, nbHits: hits.length, page: 0, nbPages: 1 }],
        }
    })
    return {
        client: { searchForHits } as unknown as LiteClient,
        requests,
    }
}

function renderDataResults(options: {
    query: string
    filters?: Filter[]
    chartHits: Record<string, unknown>[]
    featuredViz: FeaturedVizResponse
}): {
    requests: Record<string, unknown>[]
    logSearchResultClick: ReturnType<typeof vi.fn>
} {
    const { client, requests } = makeClient(options)
    const state: SearchState = {
        query: options.query,
        filters: options.filters ?? [],
        requireAllCountries: false,
        resultType: SearchResultType.ALL,
    }
    // React Query's default retries, as on the site, without the backoff
    // delay so a failing request settles within the test timeout.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    const logSearchResultClick = vi.fn()
    const context = {
        state,
        liteSearchClient: client,
        analytics: { logSearchResultClick },
    } as unknown as React.ContextType<typeof SearchContext>

    render(
        <QueryClientProvider client={queryClient}>
            <SearchContext.Provider value={context}>
                <SearchDataResults isFirstChartLarge={false} />
            </SearchContext.Provider>
        </QueryClientProvider>
    )
    return { requests, logSearchResultClick }
}

const linkHrefs = (): (string | null)[] =>
    screen.getAllByRole("link").map((link) => link.getAttribute("href"))

const featuredVizRequests = (
    requests: Record<string, unknown>[]
): Record<string, unknown>[] =>
    requests.filter((request) => request.filters === "type:featured-viz")

describe(SearchDataResults, () => {
    it("puts the matching featured-viz page above the chart hits and counts it", async () => {
        renderDataResults({
            query: "migration",
            chartHits: [chartHit("migrant-stock"), chartHit("refugees")],
            featuredViz: "migration-page",
        })

        expect(await screen.findByText("(3 results)")).toBeTruthy()
        expect(linkHrefs()).toEqual([
            "/featured-viz/migration",
            "/grapher/migrant-stock",
            "/grapher/refugees",
        ])
    })

    it("shows the featured viz as a card with its label, title, byline and excerpt", async () => {
        renderDataResults({
            query: "migration",
            chartHits: [chartHit("migrant-stock")],
            featuredViz: "migration-page",
        })

        await screen.findByText("(2 results)")
        const card = screen.getAllByRole("link")[0]
        expect(card.getAttribute("href")).toBe("/featured-viz/migration")
        const inCard = within(card)
        expect(inCard.getByText("Featured visualization")).toBeTruthy()
        expect(
            inCard.getByRole("heading", { name: "Where do migrants live?" })
        ).toBeTruthy()
        expect(
            inCard.getByText(
                "By Hannah Ritchie, Sophia Mersmann, and Tuna Acisu"
            )
        ).toBeTruthy()
        expect(
            inCard.getByText(
                "Where migrants were born, and where they live now."
            )
        ).toBeTruthy()
        expect(card.querySelector("img")?.getAttribute("src")).toBe(
            "https://ourworldindata.org/images/migration-thumbnail.png"
        )
    })

    it("falls back to the default image and hides the byline and excerpt when the hit lacks them", async () => {
        renderDataResults({
            query: "migration",
            chartHits: [],
            featuredViz: "bare-migration-page",
        })

        await screen.findByText("(1 result)")
        const card = screen.getByRole("link")
        expect(card.querySelector("img")?.getAttribute("src")).toMatch(
            /\/default-featured-image\.png$/
        )
        expect(card.textContent).toBe(
            "Featured visualizationWhere do migrants live?"
        )
    })

    it("logs a click on the featured-viz card at position 1", async () => {
        const { logSearchResultClick } = renderDataResults({
            query: "migration",
            chartHits: [chartHit("migrant-stock")],
            featuredViz: "migration-page",
        })

        await screen.findByText("(2 results)")
        fireEvent.click(screen.getAllByRole("link")[0])

        expect(logSearchResultClick).toHaveBeenCalledOnce()
        expect(logSearchResultClick).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "featured-viz",
                slug: "migration",
            }),
            { position: 1, source: "search" }
        )
    })

    it("renders the section with the featured-viz card alone when no chart matched", async () => {
        renderDataResults({
            query: "migration",
            chartHits: [],
            featuredViz: "migration-page",
        })

        expect(await screen.findByText("(1 result)")).toBeTruthy()
        expect(linkHrefs()).toEqual(["/featured-viz/migration"])
    })

    it("sends no featured-viz request without query text, even with a topic filter", async () => {
        const { requests } = renderDataResults({
            query: "",
            filters: [createTopicFilter("Migration")],
            chartHits: [chartHit("migrant-stock")],
            featuredViz: "migration-page",
        })

        expect(await screen.findByText("(1 result)")).toBeTruthy()
        expect(linkHrefs()).toEqual(["/grapher/migrant-stock"])
        expect(featuredVizRequests(requests)).toEqual([])
    })

    it("shows the chart hits alone when no featured-viz page matches", async () => {
        const { requests } = renderDataResults({
            query: "gdp",
            chartHits: [chartHit("gdp-per-capita")],
            featuredViz: "no-match",
        })

        expect(await screen.findByText("(1 result)")).toBeTruthy()
        expect(linkHrefs()).toEqual(["/grapher/gdp-per-capita"])
        // The featured viz was asked for, and came back empty
        expect(featuredVizRequests(requests)).toHaveLength(1)
    })

    it("still shows the chart hits when the featured-viz request fails", async () => {
        renderDataResults({
            query: "migration",
            chartHits: [chartHit("migrant-stock")],
            featuredViz: "error",
        })

        expect(await screen.findByText("(1 result)")).toBeTruthy()
        expect(linkHrefs()).toEqual(["/grapher/migrant-stock"])
    })
})
