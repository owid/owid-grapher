// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server"
import { act, fireEvent, render } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { DataPageDataV2, FaqEntryData } from "@ourworldindata/types"
import IndicatorMetadataBox from "./IndicatorMetadataBox.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"

const datapageData: DataPageDataV2 = {
    status: "draft",
    title: { title: "Example indicator" },
    descriptionShort: "Read [how it is measured](#how-is-this-measured).",
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
    const heading = document.getElementById("how-is-this-measured")!
    const question = heading.closest("details")!
    const outer = question.parentElement!.closest("details")!
    return { heading, question, outer }
}

describe("FAQ fragment compatibility", () => {
    it("bakes the same heading IDs as the previous ArticleBlocks layout, including supertitles", () => {
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

    it("leaves the box collapsed without a fragment", () => {
        render(box)
        const { question, outer } = getDetails()
        expect(question.open).toBe(false)
        expect(outer.open).toBe(false)
        expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
    })

    it("reveals both accordions on initial load, including encoded fragments", () => {
        window.history.replaceState(null, "", "#%68ow-is-this-measured")
        render(box)
        const { heading, question, outer } = getDetails()
        expect(question.open).toBe(true)
        expect(outer.open).toBe(true)
        expect(heading.scrollIntoView).toHaveBeenCalled()
        expect(
            document
                .getElementById("measurement-what-is-gdp-ppp")!
                .closest("details")!.open
        ).toBe(false)
    })

    it("reveals the target on hash changes and removes the listener on unmount", () => {
        const view = render(box)
        act(() => {
            window.history.replaceState(null, "", "#how-is-this-measured")
            window.dispatchEvent(new HashChangeEvent("hashchange"))
        })
        const { question, outer } = getDetails()
        expect(question.open).toBe(true)
        expect(outer.open).toBe(true)
        view.unmount()
        vi.mocked(HTMLElement.prototype.scrollIntoView).mockClear()
        window.dispatchEvent(new HashChangeEvent("hashchange"))
        expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
    })

    it("reopens a collapsed answer when its in-page link is clicked with the hash already set", () => {
        window.history.replaceState(null, "", "#how-is-this-measured")
        const view = render(box)
        const { question, outer } = getDetails()
        question.open = false
        outer.open = false
        fireEvent.click(view.getByRole("link", { name: "how it is measured" }))
        expect(question.open).toBe(true)
        expect(outer.open).toBe(true)
    })

    it.each(["#missing", "#%E0%A4%A", "#outside"])(
        "ignores unrelated or malformed fragments: %s",
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
