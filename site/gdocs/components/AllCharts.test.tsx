/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import {
    ChartRecordType,
    OwidGdocType,
    type UserCountryInformation,
} from "@ourworldindata/types"
import { AttachmentsContext, Attachments } from "../AttachmentsContext.js"
import { DocumentContext } from "../DocumentContext.js"
import type { GrapherWithFallbackProps } from "../../GrapherWithFallback.js"
import { AllCharts } from "./AllCharts.js"

const searchForHits = vi.hoisted(() => vi.fn())
const getUserCountryInformation = vi.hoisted(() => vi.fn())

vi.mock(import("@ourworldindata/utils"), async (importOriginal) => ({
    ...(await importOriginal()),
    getUserCountryInformation,
}))

vi.mock(import("../../search/searchClients.js"), async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        getLiteSearchClient: (() => ({
            searchForHits,
        })) as unknown as typeof actual.getLiteSearchClient,
    }
})

vi.mock(import("../../GrapherWithFallback.js"), () => ({
    GrapherWithFallback: ({
        slug,
        queryStr,
    }: Pick<GrapherWithFallbackProps, "slug" | "queryStr">) => (
        <div data-testid="preview">{`${slug}${queryStr}`}</div>
    ),
}))

vi.mock(import("../../MultiDimEmbed.js"), () => ({
    MultiDimEmbed: ({
        url,
        chartConfig,
    }: {
        url: string
        chartConfig: { hideExploreTheDataButton?: boolean }
    }) => (
        <div
            data-testid="preview"
            data-explore-button={!chartConfig.hideExploreTheDataButton}
        >{`mdim:${url}`}</div>
    ),
}))

const MDIM_VIEWS: Record<string, string> = {
    "mdim-a": "?metric=a",
    "mdim-b": "?metric=b",
}

const DATA_EXPLORER_IDS = new Set(["mdim-a"])

const PAGES: Record<number, string[]> = { 0: ["alpha", "beta"], 1: ["gamma"] }
const TABS: Record<string, string[]> = {
    alpha: ["Table", "WorldMap", "LineChart", "SlopeChart", "Marimekko"],
}
const DEFAULT_TABS = ["Table", "WorldMap", "LineChart"]
const POVERTY_KEYWORDS = [
    "GDP per capita",
    "extreme poverty",
    "relative poverty",
    "multidimensional poverty",
    "consumption",
    "national poverty lines",
    "consumer price index",
]

beforeEach(() => {
    observers.clear()
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
    stubVocabulary({ poverty: { keywords: POVERTY_KEYWORDS } })
    getUserCountryInformation.mockReset()
    getUserCountryInformation.mockResolvedValue(undefined)
    searchForHits.mockReset()
    searchForHits.mockImplementation(
        async ([{ page, query }]: [{ page: number; query: string }]) =>
            query === "gas"
                ? makeResponse(page, [], 0)
                : makeResponse(page, query ? ["delta"] : PAGES[page])
    )
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    setViewportWidth(1024)
})

it("fetches nothing until the block nears the viewport, then shows the first page", async () => {
    renderBlock()
    await flushEffects()

    expect(searchForHits).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(document.querySelector(".animate-pulse")).not.toBeNull()

    fireIntersectionObserversMatching("section")

    expect(await screen.findByText("Title of alpha")).toBeVisible()
    expect(screen.getByText("Title of beta")).toBeVisible()
    expect(screen.getByText("(3 charts)")).toBeVisible()
    expect(document.querySelector(".animate-pulse")).toBeNull()
    expect(requestedPages()).toEqual([0])
})

it("loads the next page at the end of the list and stops after the last one", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    fireIntersectionObserversMatching(".all-charts-block-results__sentinel")

    expect(await screen.findByText("Title of gamma")).toBeVisible()
    expect(requestedPages()).toEqual([0, 1])
    expect(
        document.querySelector(".all-charts-block-results__sentinel")
    ).toBeNull()
})

it("shows at most three thumbnails, skipping Table", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")

    const alphaRow = await findRow("alpha")
    const thumbnailLabels = within(alphaRow)
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label"))
        .filter(Boolean)
    expect(thumbnailLabels).toEqual(["World map", "Line chart", "Slope chart"])
})

it("previews the first row on its first chart tab, and a thumbnail switches row and tab", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")

    expect(await screen.findByTestId("preview")).toHaveTextContent(
        "alpha?tab=map"
    )

    const betaRow = await findRow("beta")
    fireEvent.click(within(betaRow).getByRole("button", { name: "Line chart" }))

    expect(screen.getByTestId("preview")).toHaveTextContent("beta?tab=line")
})

it("sends a thumbnail and the preview of its tab the same peer params", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")

    const alphaRow = await findRow("alpha")
    const lineChartButton = within(alphaRow).getByRole("button", {
        name: "Line chart",
    })
    fireEvent.click(lineChartButton)

    const peerParams = "country=&peerCountries=dataRange&peerCount=4"
    expect(lineChartButton.querySelector("img")?.getAttribute("src")).toContain(
        `?tab=line&${peerParams}&`
    )
    expect(screen.getByTestId("preview").textContent).toBe(
        `alpha?tab=line&${peerParams}`
    )
})

it("previews the selected row inline under it on narrow screens, as a disclosure", async () => {
    setViewportWidth(500)
    renderBlock()
    fireIntersectionObserversMatching("section")

    const alphaRow = await findRow("alpha")
    const betaRow = await findRow("beta")
    const inlinePreview = getListItem(alphaRow).querySelector(
        ".all-charts-block-results__inline-preview"
    )
    expect(inlinePreview).toHaveTextContent("alpha?tab=map")
    expect(screen.getAllByTestId("preview")).toHaveLength(1)
    expect(
        document.querySelector(".all-charts-block-results__preview")
    ).toBeNull()

    const alphaTitle = getTitleLink(alphaRow)
    expect(alphaTitle).toHaveAttribute("aria-expanded", "true")
    expect(alphaTitle).toHaveAttribute("aria-controls", inlinePreview?.id)
    expect(alphaTitle).toHaveAttribute("aria-disabled", "true")
    expect(alphaTitle).not.toHaveAttribute("aria-current")

    const betaTitle = getTitleLink(betaRow)
    expect(betaTitle).toHaveAttribute("aria-expanded", "false")
    expect(betaTitle).not.toHaveAttribute("aria-controls")
    expect(betaTitle).toHaveAttribute("aria-disabled", "false")
    expect(betaTitle).not.toHaveAttribute("aria-current")
})

it("moves the inline preview to a selected row and scrolls to it once it has rendered", async () => {
    setViewportWidth(500)
    const scrolls = spyOnScrollIntoView()
    renderBlock()
    fireIntersectionObserversMatching("section")
    const alphaRow = await findRow("alpha")
    const betaRow = await findRow("beta")

    fireEvent.click(getTitleLink(betaRow))

    expect(scrolls).toEqual([
        { target: getListItem(betaRow), hasInlinePreview: true },
    ])
    expect(hasInlinePreview(alphaRow)).toBe(false)
    expect(screen.getByTestId("preview")).toHaveTextContent("beta?tab=map")
    expect(getTitleLink(betaRow)).toHaveAttribute("aria-expanded", "true")

    const lineChartButton = within(alphaRow).getByRole("button", {
        name: "Line chart",
    })
    fireEvent.click(lineChartButton)

    expect(scrolls.at(-1)).toEqual({
        target: lineChartButton,
        hasInlinePreview: true,
    })
    expect(hasInlinePreview(betaRow)).toBe(false)
    expect(screen.getByTestId("preview")).toHaveTextContent("alpha?tab=line")

    fireEvent.click(getTitleLink(alphaRow))

    expect(scrolls).toHaveLength(2)
    expect(screen.getByTestId("preview")).toHaveTextContent("alpha?tab=line")
})

it("marks the selected row as current and never scrolls on wide screens", async () => {
    setViewportWidth(1200)
    const scrolls = spyOnScrollIntoView()
    renderBlock()
    fireIntersectionObserversMatching("section")
    const alphaRow = await findRow("alpha")
    const betaRow = await findRow("beta")

    const isNavigating = fireEvent.click(getTitleLink(betaRow))

    expect(isNavigating).toBe(false)
    expect(getTitleLink(betaRow)).toHaveAttribute("aria-current", "true")
    expect(getTitleLink(alphaRow)).toHaveAttribute("aria-current", "false")
    expect(getTitleLink(betaRow)).not.toHaveAttribute("aria-expanded")
    expect(screen.getByTestId("preview")).toHaveTextContent("beta?tab=map")
    expect(scrolls).toEqual([])
})

it.each([
    { kind: "chart", id: "alpha", href: /\/grapher\/alpha$/ },
    {
        kind: "multi-dim view",
        id: "mdim-a",
        href: /\/grapher\/shared-mdim\?metric=a$/,
    },
])("links the title of a $kind to its chart", async ({ id, href }) => {
    showMultiDimViews()
    renderBlock()
    fireIntersectionObserversMatching("section")

    const row = await findRow(id)

    expect(getTitleLink(row).getAttribute("href")).toMatch(href)
})

it("shows the error panel, linking to the topic in search, when the first page fails", async () => {
    searchForHits.mockRejectedValueOnce(new Error("Algolia is down"))
    renderBlock()
    fireIntersectionObserversMatching("section")

    const searchLink = await screen.findByRole("link", {
        name: /Search all charts/,
    })
    expect(searchLink).toHaveAttribute("href", "/search?topics=Poverty")
    expect(screen.queryByText("Title of alpha")).toBeNull()
})

it("keeps the loaded rows and stops loading when a later page fails", async () => {
    searchForHits.mockImplementation(async ([{ page }]: [{ page: number }]) => {
        if (page > 0) throw new Error("Algolia is down")
        return makeResponse(page, PAGES[page])
    })
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")
    fireIntersectionObserversMatching(".all-charts-block-results__sentinel")
    await flushEffects()

    expect(requestedPages()).toEqual([0, 1])
    expect(screen.getByText("Title of alpha")).toBeVisible()
    expect(screen.queryByRole("link", { name: /Search all charts/ })).toBeNull()
})

it("requests the typed query after the debounce and resets selection to the first hit", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    const betaRow = await findRow("beta")
    fireEvent.click(within(betaRow).getByRole("button", { name: "Line chart" }))
    expect(screen.getByTestId("preview")).toHaveTextContent("beta?tab=line")

    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "air" },
    })
    expect(requestedQueries()).toEqual([""])

    expect(await screen.findByText("Title of delta")).toBeVisible()
    expect(requestedQueries()).toEqual(["", "air"])
    expect(screen.getByTestId("preview")).toHaveTextContent("delta?tab=map")
})

it("shows the no-results panel with a search link carrying the query", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "gas" },
    })

    const searchLink = await screen.findByRole("link", {
        name: /Search all charts/,
    })
    expect(searchLink).toHaveAttribute("href", "/search?q=gas")
    expect(
        screen.getByText("There are no results for this query.")
    ).toBeVisible()
    expect(screen.getByText("(0 charts)")).toBeVisible()
})

it.each([
    {
        action: "the clear button",
        clear: (): void => {
            fireEvent.click(
                screen.getByRole("button", { name: "Clear search" })
            )
        },
    },
    {
        action: "Escape",
        clear: (): void => {
            fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" })
        },
    },
])(
    "returns to the first page without a request when $action clears the input",
    async ({ clear }) => {
        renderBlock()
        fireIntersectionObserversMatching("section")
        await screen.findByText("Title of alpha")
        fireEvent.change(screen.getByRole("searchbox"), {
            target: { value: "gas" },
        })
        await screen.findByRole("link", { name: /Search all charts/ })

        clear()

        expect(await screen.findByText("Title of alpha")).toBeVisible()
        await flushEffects()
        expect(requestedQueries()).toEqual(["", "gas"])
        expect(screen.getByRole("searchbox")).toHaveValue("")
    }
)

it("filters by countries typed into the search and shows them on the rows, thumbnails and preview", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "spain" },
    })

    await vi.waitFor(() =>
        expect(requestedFacetFilters().at(-1)).toContain(
            "availableEntities:Spain"
        )
    )
    await vi.waitFor(() =>
        expect(
            document.querySelector(".all-charts-block-row__countries")
        ).toHaveTextContent("Spain")
    )
    const alphaRow = await findRow("alpha")
    const thumbnailSrc = alphaRow.querySelector("img")?.getAttribute("src")
    expect(thumbnailSrc).toContain("country=~ESP")
    expect(thumbnailSrc).not.toContain("peerCountries")
    expect(thumbnailSrc).not.toContain("focus=")
    expect(thumbnailSrc).not.toContain("time=")
    expect(screen.getByTestId("preview")).toHaveTextContent(
        "alpha?tab=line&country=~ESP"
    )
})

it("sends one request for two spellings of the same country", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "UK" },
    })
    await vi.waitFor(() => expect(requestedFacetFilters()).toHaveLength(2))
    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "United Kingdom" },
    })
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)))

    expect(requestedFacetFilters()).toHaveLength(2)
    expect(requestedFacetFilters().at(-1)).toContain(
        "availableEntities:United Kingdom"
    )
})

it("keeps the same chart preview while its tab and countries change", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    const preview = await screen.findByTestId("preview")
    expect(preview).toHaveTextContent("alpha?tab=map")

    const alphaRow = await findRow("alpha")
    fireEvent.click(
        within(alphaRow).getByRole("button", { name: "Slope chart" })
    )
    expect(preview).toHaveTextContent("alpha?tab=slope")

    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "spain" },
    })
    await vi.waitFor(() => expect(preview).toHaveTextContent("country=~ESP"))

    expect(screen.getByTestId("preview")).toBe(preview)
})

it("asks for charts and multi-dim views on the topic", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    const facetFilters = requestedFacetFilters()[0] as unknown[]
    expect(facetFilters).toContainEqual(["type:chart", "type:multiDimView"])
    expect(facetFilters).toContainEqual(["tags:Poverty"])
})

it("previews a multi-dim view live with its view params, the tab and no controls", async () => {
    showMultiDimViews()
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    const viewRow = await findRow("mdim-a")
    expect(viewRow.querySelector("img")?.getAttribute("src")).toContain(
        "metric=a"
    )
    fireEvent.click(within(viewRow).getByRole("button", { name: "Line chart" }))

    const previewText = screen.getByTestId("preview").textContent
    expect(previewText).toMatch(/^mdim:.*\/shared-mdim\?/)
    expect(previewText).toContain("metric=a")
    expect(previewText).toContain("tab=line")
    expect(previewText).toContain("hideControls=true")
    expect(
        within(viewRow)
            .getByRole("button", { name: "Line chart" })
            .querySelector("img")
            ?.getAttribute("src")
    ).toContain("tab=line")

    const chartRow = await findRow("alpha")
    fireEvent.click(
        within(chartRow).getByRole("button", { name: "Line chart" })
    )
    expect(screen.getByTestId("preview")).toHaveTextContent("alpha?tab=line")
})

it("treats two views of one multi-dim as separate selections", async () => {
    showMultiDimViews()
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    const firstViewRow = await findRow("mdim-a")
    const secondViewRow = await findRow("mdim-b")
    fireEvent.click(
        within(firstViewRow).getByRole("button", { name: "Line chart" })
    )
    fireEvent.click(
        within(secondViewRow).getByRole("button", { name: "Line chart" })
    )

    const previewText = screen.getByTestId("preview").textContent
    expect(previewText).toContain("metric=b")
    expect(previewText).not.toContain("metric=a")
    expect(secondViewRow).toHaveClass("all-charts-block-row--selected")
    expect(firstViewRow).not.toHaveClass("all-charts-block-row--selected")
})

it("links to the page only from a data-explorer multi-dim preview", async () => {
    showMultiDimViews()
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    fireEvent.click(
        within(await findRow("mdim-a")).getByRole("button", {
            name: "Line chart",
        })
    )
    expect(screen.getByTestId("preview")).toHaveAttribute(
        "data-explore-button",
        "true"
    )

    fireEvent.click(
        within(await findRow("mdim-b")).getByRole("button", {
            name: "Line chart",
        })
    )
    expect(screen.getByTestId("preview")).toHaveAttribute(
        "data-explore-button",
        "false"
    )
})

it("passes typed countries to a multi-dim preview", async () => {
    showMultiDimViews(["mdim-a", "alpha"])
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "spain" },
    })

    await vi.waitFor(() =>
        expect(screen.getByTestId("preview").textContent).toContain(
            "country=~ESP"
        )
    )
    expect(screen.getByTestId("preview").textContent).toMatch(
        /^mdim:.*metric=a/
    )
})

it("shows the first six suggestions, and hides the one being searched for", async () => {
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    await screen.findByRole("button", { name: "GDP per capita" })
    expect(getSuggestions()).toEqual([
        "GDP per capita",
        "extreme poverty",
        "relative poverty",
        "multidimensional poverty",
        "consumption",
        "national poverty lines",
    ])

    fireEvent.click(screen.getByRole("button", { name: "relative poverty" }))

    expect(screen.getByRole("searchbox")).toHaveValue("relative poverty")
    expect(screen.getByRole("searchbox")).toHaveFocus()
    await flushEffects()
    expect(requestedQueries()).toEqual(["", "relative poverty"])
    expect(getSuggestions()).toEqual([
        "GDP per capita",
        "extreme poverty",
        "multidimensional poverty",
        "consumption",
        "national poverty lines",
        "consumer price index",
    ])

    fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "gdp per capita" },
    })

    expect(getSuggestions()).toEqual([
        "extreme poverty",
        "relative poverty",
        "multidimensional poverty",
        "consumption",
        "national poverty lines",
        "consumer price index",
    ])
})

it("interleaves the topic's countries with its keywords", async () => {
    stubVocabulary({
        poverty: {
            keywords: POVERTY_KEYWORDS,
            countries: ["Nigeria", "India", "Brazil"],
        },
    })
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    await screen.findByRole("button", { name: "Nigeria" })
    expect(getSuggestions()).toEqual([
        "GDP per capita",
        "extreme poverty",
        "Nigeria",
        "relative poverty",
        "India",
        "multidimensional poverty",
    ])
})

it("fills a country slot with a keyword when the topic runs out of countries", async () => {
    stubVocabulary({
        poverty: { keywords: POVERTY_KEYWORDS, countries: ["Nigeria"] },
    })
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    await screen.findByRole("button", { name: "Nigeria" })
    expect(getSuggestions()).toEqual([
        "GDP per capita",
        "extreme poverty",
        "Nigeria",
        "relative poverty",
        "multidimensional poverty",
        "consumption",
    ])
})

it("puts the reader's detected country first among the countries", async () => {
    const spain: UserCountryInformation = {
        name: "Spain",
        code: "ESP",
        short_code: "ES",
        slug: "spain",
        regions: null,
    }
    getUserCountryInformation.mockResolvedValue(spain)
    stubVocabulary({
        poverty: {
            keywords: POVERTY_KEYWORDS,
            countries: ["Nigeria", "India", "Brazil"],
        },
    })
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    await screen.findByRole("button", { name: "Spain" })
    expect(getSuggestions()).toEqual([
        "GDP per capita",
        "extreme poverty",
        "Spain",
        "relative poverty",
        "Nigeria",
        "multidimensional poverty",
    ])
})

it("fills a clicked country's slot with the next country", async () => {
    stubVocabulary({
        poverty: {
            keywords: POVERTY_KEYWORDS,
            countries: ["Nigeria", "India", "Brazil"],
        },
    })
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")

    fireEvent.click(await screen.findByRole("button", { name: "Nigeria" }))

    expect(screen.getByRole("searchbox")).toHaveValue("Nigeria")
    await vi.waitFor(() =>
        expect(requestedFacetFilters().at(-1)).toContain(
            "availableEntities:Nigeria"
        )
    )
    expect(getSuggestions()).toEqual([
        "GDP per capita",
        "extreme poverty",
        "India",
        "relative poverty",
        "Brazil",
        "multidimensional poverty",
    ])
})

it.each([
    { scenario: "no country", detected: undefined },
    { scenario: "null", detected: null },
    {
        scenario: "a country the search can't filter by",
        detected: { name: "Curacao" },
    },
])(
    "shows only the topic's countries when detection resolves $scenario",
    async ({ detected }) => {
        getUserCountryInformation.mockResolvedValue(detected)
        stubVocabulary({
            poverty: {
                keywords: POVERTY_KEYWORDS,
                countries: ["Nigeria", "India"],
            },
        })
        renderBlock()
        fireIntersectionObserversMatching("section")
        await screen.findByText("Title of alpha")

        await screen.findByRole("button", { name: "Nigeria" })
        await flushEffects()
        expect(getSuggestions()).toEqual([
            "GDP per capita",
            "extreme poverty",
            "Nigeria",
            "relative poverty",
            "India",
            "multidimensional poverty",
        ])
    }
)

it.each([
    {
        scenario: "a topic missing from the vocabulary",
        fetchVocabulary: async (): Promise<Response> => Response.json({}),
    },
    {
        scenario: "a failed vocabulary request",
        fetchVocabulary: async (): Promise<Response> => {
            throw new TypeError("Failed to fetch")
        },
    },
])("shows no suggestions for $scenario", async ({ fetchVocabulary }) => {
    vi.stubGlobal("fetch", vi.fn(fetchVocabulary))
    renderBlock()
    fireIntersectionObserversMatching("section")
    await screen.findByText("Title of alpha")
    await flushEffects()

    expect(document.querySelector(".all-charts-block-suggestions")).toBeNull()
})

function showMultiDimViews(ids = ["alpha", "mdim-a", "mdim-b"]): void {
    searchForHits.mockImplementation(async ([{ page }]: [{ page: number }]) =>
        makeResponse(page, ids)
    )
}

function stubVocabulary(vocabulary: object): void {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(JSON.stringify(vocabulary)))
    )
}

function getSuggestions(): string[] {
    return Array.from(
        document.querySelectorAll(".all-charts-block-suggestions__button")
    ).map((button) => button.textContent ?? "")
}

function makeResponse(page: number, ids: string[], nbHits = 3): unknown {
    const hits = ids.map((id) => {
        const queryParams = MDIM_VIEWS[id]
        return queryParams
            ? {
                  objectID: id,
                  type: ChartRecordType.MultiDimView,
                  slug: "shared-mdim",
                  queryParams,
                  isDataExplorer: DATA_EXPLORER_IDS.has(id),
                  ...makeHitFields(id),
              }
            : {
                  objectID: id,
                  type: ChartRecordType.Chart,
                  slug: id,
                  ...makeHitFields(id),
              }
    })
    return { results: [{ hits, nbHits, page, nbPages: 2 }] }
}

function makeHitFields(id: string): {
    title: string
    availableTabs: string[]
} {
    return {
        title: `Title of ${id}`,
        availableTabs: TABS[id] ?? DEFAULT_TABS,
    }
}

async function findRow(slug: string): Promise<HTMLElement> {
    const title = await screen.findByText(`Title of ${slug}`)
    return title.closest(".all-charts-block-row") as HTMLElement
}

function getListItem(row: HTMLElement): HTMLElement {
    return row.closest(".all-charts-block-results__item") as HTMLElement
}

function getTitleLink(row: HTMLElement): HTMLElement {
    return row.querySelector(".all-charts-block-row__select") as HTMLElement
}

function hasInlinePreview(row: HTMLElement): boolean {
    return (
        getListItem(row).querySelector(
            ".all-charts-block-results__inline-preview"
        ) !== null
    )
}

function setViewportWidth(width: number): void {
    const { happyDOM } = window as unknown as {
        happyDOM: { setViewport(viewport: { width: number }): void }
    }
    happyDOM.setViewport({ width })
}

interface RecordedScroll {
    target: HTMLElement
    hasInlinePreview: boolean
}

function spyOnScrollIntoView(): RecordedScroll[] {
    const scrolls: RecordedScroll[] = []
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
        function (this: HTMLElement) {
            const listItem = this.closest(".all-charts-block-results__item")
            scrolls.push({
                target: this,
                hasInlinePreview:
                    listItem?.querySelector(
                        ".all-charts-block-results__inline-preview"
                    ) !== null,
            })
        }
    )
    return scrolls
}

function requestedPages(): number[] {
    return searchForHits.mock.calls.map(([[params]]) => params.page)
}

function requestedFacetFilters(): unknown[] {
    return searchForHits.mock.calls.map(([[params]]) => params.facetFilters)
}

function requestedQueries(): string[] {
    return searchForHits.mock.calls.map(([[params]]) => params.query)
}

function renderBlock(): ReturnType<typeof render> {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    const attachments = {
        tags: [{ id: 1, name: "Poverty", slug: "poverty" }],
    } as unknown as Attachments
    return render(
        <QueryClientProvider client={queryClient}>
            <DocumentContext.Provider
                value={{
                    isPreviewing: false,
                    gdocType: OwidGdocType.TopicPage,
                }}
            >
                <AttachmentsContext.Provider value={attachments}>
                    <AllCharts />
                </AttachmentsContext.Provider>
            </DocumentContext.Provider>
        </QueryClientProvider>
    )
}

async function flushEffects(): Promise<void> {
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)))
}

type ObserverCallback = (entries: Partial<IntersectionObserverEntry>[]) => void

const observers = new Map<Element, ObserverCallback>()

class FakeIntersectionObserver {
    readonly thresholds = [0]
    constructor(private readonly callback: ObserverCallback) {}
    observe(target: Element): void {
        observers.set(target, this.callback)
    }
    unobserve(target: Element): void {
        observers.delete(target)
    }
    disconnect(): void {
        for (const [target, callback] of observers)
            if (callback === this.callback) observers.delete(target)
    }
}

function fireIntersectionObserversMatching(selector: string): void {
    act(() => {
        for (const [target, callback] of observers)
            if (target.matches(selector))
                callback([
                    { isIntersecting: true, intersectionRatio: 1, target },
                ])
    })
}
