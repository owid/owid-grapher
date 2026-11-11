import { describe, expect, it } from "vitest"

import { formatLegendLabel } from "./legendLabels.js"

describe(formatLegendLabel, () => {
    it("only lets the Middle East region break before Afghanistan", () => {
        const label = formatLegendLabel(
            "Middle East, North Africa, Afghanistan and Pakistan"
        )
        expect(label.split(" ")).toEqual([
            "Middle East, North Africa,",
            "Afghanistan and Pakistan",
        ])
    })

    it("leaves other labels alone", () => {
        expect(formatLegendLabel("Sub-Saharan Africa")).toBe(
            "Sub-Saharan Africa"
        )
    })
})
