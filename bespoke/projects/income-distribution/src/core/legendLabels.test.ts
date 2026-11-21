import { describe, expect, it } from "vitest"

import { formatLegendLabel, legendLabelLines } from "./legendLabels.js"

describe(formatLegendLabel, () => {
    it("only lets the Middle East region break before Afghanistan", () => {
        const label = formatLegendLabel(
            "Middle East, North Africa, Afghanistan and Pakistan"
        )
        expect(label.split(" ")).toEqual([
            "Middle East, North Africa,",
            "Afghanistan & Pakistan",
        ])
    })

    it('shortens a region\'s "and" to "&" and leaves other labels alone', () => {
        expect(formatLegendLabel("East Asia and Pacific")).toBe(
            "East Asia & Pacific"
        )
        expect(formatLegendLabel("Sub-Saharan Africa")).toBe(
            "Sub-Saharan Africa"
        )
        expect(formatLegendLabel("Trinidad and Tobago")).toBe(
            "Trinidad and Tobago"
        )
    })
})

describe(legendLabelLines, () => {
    it("splits the Middle East region before Afghanistan", () => {
        expect(
            legendLabelLines(
                "Middle East, North Africa, Afghanistan and Pakistan"
            )
        ).toEqual(["Middle East, North Africa,", "Afghanistan & Pakistan"])
    })

    it("keeps other labels on one line", () => {
        expect(legendLabelLines("Sub-Saharan Africa")).toEqual([
            "Sub-Saharan Africa",
        ])
    })
})
