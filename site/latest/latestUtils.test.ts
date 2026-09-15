import { describe, expect, it } from "vitest"
import {
    LATEST_TOPIC_AREAS_BY_POPULARITY,
    hasViewToggle,
    sortTopicAreasByPopularity,
} from "./latestUtils.js"

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
        ).toEqual(["Violence and War", "Health", "New Area B", "New Area A"])
    })

    it("does not mutate its input", () => {
        const input = ["Violence and War", "Health"]
        sortTopicAreasByPopularity(input)
        expect(input).toEqual(["Violence and War", "Health"])
    })
})
