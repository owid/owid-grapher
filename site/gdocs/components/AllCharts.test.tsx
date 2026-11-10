/**
 * @vitest-environment happy-dom
 */

import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ChartRecordType, OwidGdocType } from "@ourworldindata/types"
import { AttachmentsContext, Attachments } from "../AttachmentsContext.js"
import { DocumentContext } from "../DocumentContext.js"
import type { GrapherWithFallbackProps } from "../../GrapherWithFallback.js"
import { AllCharts } from "./AllCharts.js"

const searchForHits = vi.hoisted(() => vi.fn())

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

const PAGES: Record<number, string[]> = { 0: ["alpha", "beta"], 1: ["gamma"] }
const TABS: Record<string, string[]> = {
    alpha: ["Table", "WorldMap", "LineChart", "SlopeChart", "Marimekko"],
}
const DEFAULT_TABS = ["Table", "WorldMap", "LineChart"]

beforeEach(() => {
    observers.clear()
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
    searchForHits.mockReset()
    searchForHits.mockImplementation(async ([{ page }]: [{ page: number }]) =>
        makeResponse(page, PAGES[page])
    )
})

afterEach(() => {
    vi.unstubAllGlobals()
})

it("fetches nothing until the block nears the viewport, then shows the first page", async () => {
    renderBlock()
    await flushEffects()

    expect(searchForHits).not.toHaveBeenCalled()
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

    fireIntersectionObserversMatching(".all-charts-block__sentinel")

    expect(await screen.findByText("Title of gamma")).toBeVisible()
    expect(requestedPages()).toEqual([0, 1])
    expect(document.querySelector(".all-charts-block__sentinel")).toBeNull()
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
    fireIntersectionObserversMatching(".all-charts-block__sentinel")
    await flushEffects()

    expect(requestedPages()).toEqual([0, 1])
    expect(screen.getByText("Title of alpha")).toBeVisible()
    expect(screen.queryByRole("link", { name: /Search all charts/ })).toBeNull()
})

function makeResponse(page: number, slugs: string[]): unknown {
    const hits = slugs.map((slug) => ({
        objectID: slug,
        type: ChartRecordType.Chart,
        slug,
        title: `Title of ${slug}`,
        availableTabs: TABS[slug] ?? DEFAULT_TABS,
    }))
    return { results: [{ hits, nbHits: 3, page, nbPages: 2 }] }
}

async function findRow(slug: string): Promise<HTMLElement> {
    const title = await screen.findByText(`Title of ${slug}`)
    return title.closest(".all-charts-row") as HTMLElement
}

function requestedPages(): number[] {
    return searchForHits.mock.calls.map(([[params]]) => params.page)
}

function renderBlock(): ReturnType<typeof render> {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
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
                    <AllCharts type="all-charts" parseErrors={[]} />
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
