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
