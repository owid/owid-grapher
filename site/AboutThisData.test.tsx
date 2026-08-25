/**
 * @vitest-environment happy-dom
 */
import { expect, it, describe, vi } from "vitest"
import { render } from "@testing-library/react"
import { DataPageDataV2 } from "@ourworldindata/types"
import AboutThisData from "./AboutThisData.js"

vi.mock(import("../settings/clientSettings.js"), async (importOriginal) => ({
    ...(await importOriginal()),
    FEATURE_FLAGS: new Set(["EmailNotifications" as const]),
}))

function makeData(bullets: number): DataPageDataV2 {
    return {
        status: "published",
        title: { title: "Test indicator" },
        attributions: ["Producer (2024)"],
        dateRange: "2000–2024",
        lastUpdated: "2024-01-01",
        relatedResearch: [],
        allCharts: [],
        source: undefined,
        origins: [],
        chartConfig: {},
        relatedChartsByCoview: [],
        descriptionKey: Array.from(
            { length: bullets },
            (_, i) => `- bullet ${i}`
        ).join("\n"),
        descriptionFromProducer: "Producer description.",
    }
}

function renderCards(bullets: number) {
    const { container } = render(
        <AboutThisData
            datapageData={makeData(bullets)}
            hasFaq={false}
            topicArea="Energy and Environment"
        />
    )
    return {
        all: container.querySelectorAll(".topic-newsletter-card").length,
        inMetadataColumn: !!container.querySelector(
            ".key-info__right .topic-newsletter-card"
        ),
    }
}

describe("AboutThisData newsletter card placement", () => {
    it("renders one card, in the description column for short lists", () => {
        expect(renderCards(3)).toEqual({ all: 1, inMetadataColumn: false })
    })

    it("renders one card, in the metadata column for long lists", () => {
        expect(renderCards(6)).toEqual({ all: 1, inMetadataColumn: true })
    })
})
