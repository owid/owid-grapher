/**
 * @vitest-environment happy-dom
 */
import { expect, it, describe } from "vitest"
import { render } from "@testing-library/react"
import { DataPageDataV2 } from "@ourworldindata/types"
import AboutThisData from "./AboutThisData.js"

// The newsletter card goes in whichever of the two columns of the "What you
// should know about this indicator" section is expected to be the shorter one.

function makeData(bullets: number): DataPageDataV2 {
    const descriptionKey =
        bullets === 0
            ? undefined
            : Array.from({ length: bullets }, (_, i) => `- bullet ${i}`).join(
                  "\n"
              )
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
        descriptionKey,
        descriptionFromProducer: "Producer description.",
        topicArea: "Energy and Environment",
    }
}

function placement(bullets: number): "left" | "right" | "none" {
    const { container } = render(
        <AboutThisData
            datapageData={makeData(bullets)}
            hasFaq={false}
            topicArea="Energy and Environment"
        />
    )
    if (container.querySelector(".topic-newsletter-card--key-info-left"))
        return "left"
    if (container.querySelector(".topic-newsletter-card--key-info"))
        return "right"
    return "none"
}

describe("AboutThisData newsletter card placement", () => {
    it("puts the card on the left below the threshold", () => {
        expect(placement(0)).toBe("left")
        expect(placement(3)).toBe("left")
        expect(placement(5)).toBe("left")
    })

    it("keeps the card on the right at or above the threshold", () => {
        expect(placement(6)).toBe("right")
        expect(placement(12)).toBe("right")
    })

    it("renders the left card as the last child of the description column", () => {
        const { container } = render(
            <AboutThisData
                datapageData={makeData(3)}
                hasFaq={false}
                topicArea="Energy and Environment"
            />
        )
        const left =
            container.querySelector(".key-info__content")?.parentElement
        expect(left?.lastElementChild?.className).toContain(
            "topic-newsletter-card--key-info-left"
        )
        expect(
            container.querySelector(".key-info__right .topic-newsletter-card")
        ).toBeNull()
    })
})
