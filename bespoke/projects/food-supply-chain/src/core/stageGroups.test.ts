import { describe, expect, it } from "vitest"

import { STAGE_GROUPS } from "./stageGroups.js"

/** The manifest's flow stages that sit in a group, without the total */
const GROUPED_FLOW_STAGE_KEYS = [
    "imports",
    "exports",
    "stock_variation",
    "seed",
    "losses",
    "other_uses",
    "processing_net",
    "feed",
    "animal_products",
    "tourist_consumption",
    "residuals",
]

describe("the stage grouping", () => {
    it("covers every flow stage but crop production exactly once", () => {
        const grouped = STAGE_GROUPS.flatMap((group) => group.stageKeys)

        expect(new Set(grouped).size).toBe(grouped.length)
        expect(new Set(grouped)).toEqual(new Set(GROUPED_FLOW_STAGE_KEYS))
    })
})
