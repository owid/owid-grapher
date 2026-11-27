// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server"
import { render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DataPageDataV2, FaqEntryData } from "@ourworldindata/types"
import IndicatorMetadataBox from "./IndicatorMetadataBox.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"

const datapageData: DataPageDataV2 = {
    status: "draft",
    title: { title: "Example indicator" },
    descriptionShort: "An example indicator.",
    attributions: ["Example producer"],
    origins: [],
    source: undefined,
    chartConfig: {},
    lastUpdated: "2025-01-01",
    dateRange: "2000-2025",
    relatedCharts: [],
    relatedResearch: [],
}
const faqEntries: FaqEntryData = {
    faqs: [
        {
            type: "heading",
            level: 3,
            text: [
                { spanType: "span-simple-text", text: "How is this measured?" },
            ],
            parseErrors: [],
        },
        {
            type: "text",
            value: [{ spanType: "span-simple-text", text: "Using surveys." }],
            parseErrors: [],
        },
        {
            type: "heading",
            level: 3,
            supertitle: [{ spanType: "span-simple-text", text: "Measurement" }],
            text: [
                { spanType: "span-simple-text", text: "What is GDP (PPP)?" },
            ],
            parseErrors: [],
        },
    ],
}
const box = (
    <IndicatorMetadataBox
        datapageData={datapageData}
        faqEntries={faqEntries}
        canonicalUrl="https://ourworldindata.org/grapher/example"
        archiveContext={undefined}
        id="about-this-data"
    />
)

beforeEach(() => {
    window.history.replaceState(null, "", "/grapher/example")
    vi.spyOn(HTMLElement.prototype, "scrollIntoView").mockImplementation(
        () => undefined
    )
})
afterEach(() => vi.restoreAllMocks())

function getDetails() {
    const question = document.getElementById(
        "how-is-this-measured"
    ) as HTMLDetailsElement
    const outer = question.parentElement!.closest("details")!
    return { question, outer }
}

describe("FAQ fragment compatibility", () => {
    it("gives each question the ID its heading had in the previous ArticleBlocks layout, including supertitles", () => {
        const previous = renderToStaticMarkup(
            <ArticleBlocks blocks={faqEntries.faqs} containerType="datapage" />
        )
        const current = renderToStaticMarkup(box)
        for (const id of [
            "how-is-this-measured",
            "measurement-what-is-gdp-ppp",
        ]) {
            expect(previous).toContain(`id="${id}"`)
            expect(current).toContain(`id="${id}"`)
        }
    })

    it("opens the box and only the linked question for a fragment, even an encoded one", () => {
        window.history.replaceState(null, "", "#%68ow-is-this-measured")
        render(box)
        const { question, outer } = getDetails()
        expect(question.open).toBe(true)
        expect(outer.open).toBe(true)
        expect(question.scrollIntoView).toHaveBeenCalled()
        expect(
            (
                document.getElementById(
                    "measurement-what-is-gdp-ppp"
                ) as HTMLDetailsElement
            ).open
        ).toBe(false)
    })

    it("opens the box at the citations for the old layout's #reuse-this-work", () => {
        window.history.replaceState(null, "", "#reuse-this-work")
        const view = render(box)
        const heading = view.getByRole("heading", { name: "How to cite" })
        expect(document.getElementById("reuse-this-work")).toBe(heading)
        expect(heading.closest("details")!.open).toBe(true)
        expect(
            vi.mocked(HTMLElement.prototype.scrollIntoView).mock.contexts
        ).toContain(heading)
    })

    it.each(["#%E0%A4%A", "#outside"])(
        "ignores malformed fragments and targets outside the box: %s",
        (hash) => {
            window.history.replaceState(null, "", hash)
            render(
                <>
                    <div id="outside" />
                    {box}
                </>
            )
            const { question, outer } = getDetails()
            expect(question.open).toBe(false)
            expect(outer.open).toBe(false)
            expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
        }
    )
})

describe("a chart with several indicators", () => {
    const worldBank = {
        producer: "World Bank",
        title: "World Development Indicators",
        urlMain: "https://data.worldbank.org/urban",
        citationFull: "World Bank (2026).",
    }

    it("lists a stitched pane's indicators, and each one's link to a source they share", () => {
        const view = render(
            <IndicatorMetadataBox
                datapageData={{ ...datapageData, origins: [worldBank] }}
                faqEntries={undefined}
                multiIndicator={{
                    type: "stitched",
                    indicators: [
                        {
                            title: "Urban population",
                            descriptionShort: "People living in cities.",
                        },
                        {
                            title: "Rural population",
                            descriptionShort: "People living elsewhere.",
                        },
                    ],
                    showIndicatorList: true,
                    sourcesWithIndicatorLinks: [
                        {
                            originIndex: 0,
                            indicatorLinks: [
                                {
                                    label: "Urban population",
                                    retrievedFrom:
                                        "https://data.worldbank.org/urban",
                                },
                                {
                                    label: "Rural population",
                                    retrievedFrom:
                                        "https://data.worldbank.org/rural",
                                },
                            ],
                        },
                    ],
                }}
                chartTitle="Urban and rural population"
                canonicalUrl="https://ourworldindata.org/grapher/example"
                archiveContext={undefined}
            />
        )
        expect(
            view.getByRole("heading", { name: "About this data" })
        ).toBeTruthy()
        expect(view.getByRole("heading", { name: "2 indicators" })).toBeTruthy()
        expect(view.getByText("People living elsewhere.")).toBeTruthy()
        expect(
            view
                .getAllByRole("link")
                .map((link) => link.getAttribute("href"))
                .filter((href) => href?.startsWith("https://data.worldbank"))
        ).toEqual([
            "https://data.worldbank.org/urban",
            "https://data.worldbank.org/rural",
        ])
        expect(view.container.textContent).toContain(
            "Data Page: Urban and rural population"
        )
    })

    it("leaves a stitched pane's list out when it would repeat the chart's legend", () => {
        const view = render(
            <IndicatorMetadataBox
                datapageData={datapageData}
                faqEntries={undefined}
                multiIndicator={{
                    type: "stitched",
                    indicators: [{ title: "Coal" }, { title: "Gas" }],
                    showIndicatorList: false,
                    sourcesWithIndicatorLinks: [],
                }}
                canonicalUrl="https://ourworldindata.org/grapher/example"
                archiveContext={undefined}
            />
        )
        expect(view.queryByRole("heading", { name: "2 indicators" })).toBeNull()
    })

    it("puts every indicator's pane in the HTML, without repeating an id", () => {
        const html = renderToStaticMarkup(
            <IndicatorMetadataBox
                datapageData={{
                    ...datapageData,
                    descriptionProcessing: "We added up the regions.",
                }}
                faqEntries={faqEntries}
                multiIndicator={{
                    type: "switcher",
                    additionalPanes: [
                        {
                            datapageData: {
                                ...datapageData,
                                title: { title: "Another indicator" },
                                descriptionProcessing: "We took the average.",
                            },
                            faqEntries,
                        },
                    ],
                }}
                canonicalUrl="https://ourworldindata.org/grapher/example"
                archiveContext={undefined}
                id="about-this-data"
            />
        )
        expect(html).toContain("Example indicator")
        expect(html).toContain("Another indicator")
        expect(html).toContain("We took the average.")
        const ids = [...html.matchAll(/ id="([^"]+)"/g)]
            .map((match) => match[1])
            .filter((id) => !id.startsWith("react-aria"))
        expect(ids).toEqual([...new Set(ids)])
    })
})
