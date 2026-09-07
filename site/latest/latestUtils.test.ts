import { describe, expect, it } from "vitest"
import { BlockSize, OwidEnrichedGdocBlock, Span } from "@ourworldindata/types"
import {
    LATEST_TOPIC_AREAS_BY_POPULARITY,
    findCtaUrl,
    hasViewToggle,
    sortTopicAreasByPopularity,
} from "./latestUtils.js"

describe(findCtaUrl, () => {
    const text = (...value: Span[]): OwidEnrichedGdocBlock => ({
        type: "text",
        value,
        parseErrors: [],
    })
    const plain = (t: string): Span => ({
        spanType: "span-simple-text",
        text: t,
    })
    const link = (url: string, t: string): Span => ({
        spanType: "span-link",
        url,
        children: [plain(t)],
    })
    const cta = (url: string, t: string): OwidEnrichedGdocBlock => ({
        type: "cta",
        url,
        text: t,
        parseErrors: [],
    })
    const image = (filename: string): OwidEnrichedGdocBlock => ({
        type: "image",
        filename,
        size: BlockSize.Wide,
        hasOutline: false,
        parseErrors: [],
    })

    it("finds the cta in the shape every published data update has", () => {
        const body = [
            text(plain("intro")),
            text(link("/some-link", "some link")),
            cta("/grapher/military-spending", "Explore the updated data"),
            image("chart.png"),
        ]
        expect(findCtaUrl(body)).toBe("/grapher/military-spending")
    })
})

describe(hasViewToggle, () => {
    it("offers the Expanded/Compact toggle for data insights only", () => {
        expect(hasViewToggle("data-insight")).toBe(true)
        expect(hasViewToggle("data-update")).toBe(false)
        expect(hasViewToggle("article")).toBe(false)
    })

    it("offers nothing when no type filter is active", () => {
        expect(hasViewToggle(null)).toBe(false)
    })
})

describe(sortTopicAreasByPopularity, () => {
    it("orders known areas by popularity", () => {
        const shuffled = [...LATEST_TOPIC_AREAS_BY_POPULARITY].reverse()
        expect(sortTopicAreasByPopularity(shuffled)).toEqual(
            LATEST_TOPIC_AREAS_BY_POPULARITY
        )
    })

    it("puts unknown areas last, keeping their relative order", () => {
        expect(
            sortTopicAreasByPopularity([
                "New Area B",
                "Violence and War",
                "New Area A",
                "Health",
            ])
        ).toEqual(["Health", "Violence and War", "New Area B", "New Area A"])
    })

    it("does not mutate its input", () => {
        const input = ["Violence and War", "Health"]
        sortTopicAreasByPopularity(input)
        expect(input).toEqual(["Violence and War", "Health"])
    })
})
