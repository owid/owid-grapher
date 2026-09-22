import { describe, expect, it } from "vitest"

import { STAGE_GROUPS } from "./stageGroups.js"
import { STAGE_LABELS, TOTAL_STAGE_KEY } from "./stageLabels.js"

describe("the stage grouping", () => {
    it("covers every labelled flow stage exactly once", () => {
        const grouped = STAGE_GROUPS.flatMap((group) => group.stageKeys)
        const labelled = Object.keys(STAGE_LABELS).filter(
            (key) => key !== TOTAL_STAGE_KEY
        )

        expect(new Set(grouped).size).toBe(grouped.length)
        expect(new Set(grouped)).toEqual(new Set(labelled))
    })
})
