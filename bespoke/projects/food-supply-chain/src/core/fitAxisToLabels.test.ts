import { describe, expect, it } from "vitest"

import { AxisLabel, fitAxisToLabels } from "./fitAxisToLabels.js"

describe(fitAxisToLabels, () => {
    it("gives an unlabelled axis all the room but its end margin", () => {
        expect(fitAxisToLabels([], 200, 10)).toEqual({
            length: 190,
            sides: [],
            isWrapped: [],
        })
    })

    it("shortens the axis so a right label at its end still fits", () => {
        const fitted = fitAxisToLabels(
            [{ barStart: 0.5, barEnd: 1, width: 40, preferredSide: "right" }],
            200,
            0
        )
        expect(fitted).toEqual({
            length: 160,
            sides: ["right"],
            isWrapped: [false],
        })
    })

    it("keeps a left label that fits before the axis start on the left", () => {
        const fitted = fitAxisToLabels(
            [{ barStart: 0.5, barEnd: 0.6, width: 40, preferredSide: "left" }],
            200,
            0
        )
        expect(fitted).toEqual({
            length: 200,
            sides: ["left"],
            isWrapped: [false],
        })
    })

    it("moves a left label with no room before the axis start to its bar's right", () => {
        const fitted = fitAxisToLabels(
            [{ barStart: 0.05, barEnd: 0.6, width: 40, preferredSide: "left" }],
            200,
            0
        )
        expect(fitted.sides).toEqual(["right"])
        expect(0.6 * fitted.length + 40).toBeLessThanOrEqual(200 + 1e-9)
    })

    it("wraps a left label's unit when that makes it fit before the axis start", () => {
        const fitted = fitAxisToLabels(
            [
                {
                    barStart: 0.2,
                    barEnd: 0.6,
                    width: 60,
                    wrappedWidth: 35,
                    preferredSide: "left",
                },
            ],
            200,
            0
        )
        expect(fitted).toEqual({
            length: 200,
            sides: ["left"],
            isWrapped: [true],
        })
    })

    it("moves a left label to its bar's right when even its wrapped unit doesn't fit", () => {
        const fitted = fitAxisToLabels(
            [
                {
                    barStart: 0.1,
                    barEnd: 0.6,
                    width: 60,
                    wrappedWidth: 35,
                    preferredSide: "left",
                },
            ],
            200,
            0
        )
        expect(fitted.sides).toEqual(["right"])
        expect(fitted.isWrapped).toEqual([false])
    })

    it("moves a left label pushed out by another label's move", () => {
        const labels: AxisLabel[] = [
            // Has room on the left only while the axis is long
            { barStart: 0.2, barEnd: 0.3, width: 35, preferredSide: "left" },
            // Moves right, onto the far end, and shortens the axis
            { barStart: 0.1, barEnd: 1, width: 60, preferredSide: "left" },
        ]
        const fitted = fitAxisToLabels(labels, 200, 0)

        expect(fitted.sides).toEqual(["right", "right"])
        for (const label of labels) {
            expect(
                label.barEnd * fitted.length + label.width
            ).toBeLessThanOrEqual(200 + 1e-9)
        }
    })
})
