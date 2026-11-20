import { describe, expect, it } from "vitest"

import { AxisLabel, fitAxisToLabels } from "./horizontalWaterfallPlan.js"

describe(fitAxisToLabels, () => {
    it("gives an unlabelled axis all the room but its end margin", () => {
        expect(fitAxisToLabels([], 200, 10)).toBe(190)
    })

    it("shortens the axis so a label at its end still fits", () => {
        expect(fitAxisToLabels([{ barEndShare: 1, widthPx: 40 }], 200, 0)).toBe(
            160
        )
    })

    it("shortens the axis for whichever label reaches furthest", () => {
        const labels: AxisLabel[] = [
            { barEndShare: 0.3, widthPx: 35 },
            { barEndShare: 0.9, widthPx: 60 },
        ]
        const length = fitAxisToLabels(labels, 200, 0)

        for (const label of labels) {
            expect(
                label.barEndShare * length + label.widthPx
            ).toBeLessThanOrEqual(200 + 1e-9)
        }
        expect(0.9 * length + 60).toBeCloseTo(200)
    })
})
