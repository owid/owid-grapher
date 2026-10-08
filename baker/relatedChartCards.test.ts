import { describe, expect, it, vi } from "vitest"
import { RelatedChart } from "@ourworldindata/types"
import {
    pickRelatedChartCards,
    RelatedChartStage,
} from "./relatedChartCards.js"

const chart = (chartId: number): RelatedChart => ({
    chartId,
    slug: `chart-${chartId}`,
    title: `Chart ${chartId}`,
})

const stage = (
    source: RelatedChartStage["source"],
    ids: number[]
): RelatedChartStage => ({
    source,
    fetch: vi.fn(async (limit: number, exclude: number[]) =>
        ids
            .filter((id) => !exclude.includes(id))
            .slice(0, limit)
            .map(chart)
    ),
})

describe(pickRelatedChartCards, () => {
    it("uses coviews alone when there are enough", async () => {
        const coviews = stage("coviews", [2, 3, 4, 5, 6])
        const topic = stage("primary-topic", [7, 8])
        const cards = await pickRelatedChartCards(1, [coviews, topic])
        expect(cards.map((c) => c.chartId)).toEqual([2, 3, 4, 5, 6])
        expect(cards.every((c) => c.source === "coviews")).toBe(true)
        expect(topic.fetch).not.toHaveBeenCalled()
    })

    it("tops up from later stages in order, asking only for what is missing", async () => {
        const coviews = stage("coviews", [2, 3])
        const topic = stage("primary-topic", [4])
        const site = stage("site-wide", [5, 6, 7, 8])
        const cards = await pickRelatedChartCards(1, [coviews, topic, site])
        expect(cards.map((c) => [c.chartId, c.source])).toEqual([
            [2, "coviews"],
            [3, "coviews"],
            [4, "primary-topic"],
            [5, "site-wide"],
            [6, "site-wide"],
        ])
        expect(topic.fetch).toHaveBeenCalledWith(3, [1, 2, 3])
        expect(site.fetch).toHaveBeenCalledWith(2, [1, 2, 3, 4])
    })

    it("never repeats a chart or shows the page's own chart", async () => {
        const coviews = stage("coviews", [2])
        // a sloppy stage that ignores the exclusion list
        const careless: RelatedChartStage = {
            source: "other-topics",
            fetch: async () => [chart(1), chart(2), chart(9), chart(9)],
        }
        const cards = await pickRelatedChartCards(1, [coviews, careless])
        expect(cards.map((c) => c.chartId)).toEqual([2, 9])
    })

    it("returns fewer cards only when every stage is exhausted", async () => {
        const cards = await pickRelatedChartCards(1, [
            stage("coviews", []),
            stage("site-wide", [2, 3]),
        ])
        expect(cards.map((c) => c.chartId)).toEqual([2, 3])
    })
})
