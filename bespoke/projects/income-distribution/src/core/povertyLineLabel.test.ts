import { describe, expect, it } from "vitest"

import {
    layoutPovertyLineLabel,
    POVERTY_LINE_LABEL,
} from "./povertyLineLabel.js"

const { ballRadius, gap, clearSize, lineHeight } = POVERTY_LINE_LABEL

const layout = (
    overrides: Partial<Parameters<typeof layoutPovertyLineLabel>[0]> = {}
) =>
    layoutPovertyLineLabel({
        x: 200,
        ballY: 10,
        width: 600,
        label: "Poverty line: $91",
        hasClear: false,
        ...overrides,
    })

describe(layoutPovertyLineLabel, () => {
    it("puts the label right of the ball when it fits there", () => {
        const result = layout()
        expect(result.fitsRight).toBe(true)
        expect(result.textX).toBe(200 + ballRadius + gap)
        expect(result.box.left).toBe(200 - ballRadius)
        expect(result.box.right).toBeGreaterThan(result.textX)
        expect(result.box.right).toBeLessThanOrEqual(600)
    })

    it("flips left of the ball when the label would overflow the chart", () => {
        const result = layout({ x: 580 })
        expect(result.fitsRight).toBe(false)
        expect(result.textX).toBe(580 - ballRadius - gap)
        expect(result.box.right).toBe(580 + ballRadius)
        expect(result.box.left).toBeGreaterThanOrEqual(0)
    })

    it("flips left of an obstacle on its right, such as a button over the plot", () => {
        const clear = layout({ x: 300 })
        const blocked = layout({
            x: 300,
            obstacles: [{ left: 320, right: 400, top: 0, bottom: 30 }],
        })
        expect(clear.fitsRight).toBe(true)
        expect(blocked.fitsRight).toBe(false)
    })

    it("ignores an obstacle below the label's lines", () => {
        const result = layout({
            x: 300,
            obstacles: [{ left: 320, right: 400, top: 40, bottom: 60 }],
        })
        expect(result.fitsRight).toBe(true)
    })

    it("prefers the left with room on both sides, and takes the right when only that has room", () => {
        expect(layout({ x: 300, preferLeft: true }).fitsRight).toBe(false)
        expect(layout({ x: 20, preferLeft: true }).fitsRight).toBe(true)
    })

    it("leaves room for the × after the first line", () => {
        const without = layout()
        const withClear = layout({ hasClear: true })
        expect(withClear.box.right - without.box.right).toBe(
            gap / 2 + clearSize
        )
        expect(withClear.clearCenterX).toBe(withClear.clearX + clearSize / 2)
        expect(withClear.clearX).toBeGreaterThan(withClear.textX)
    })

    it("grows the box by a line for a title above and a hint below", () => {
        const plain = layout()
        const titled = layout({ title: "International poverty line" })
        const hinted = layout({ hint: "Drag to try your own poverty line" })
        expect(titled.box.bottom - plain.box.bottom).toBe(lineHeight)
        expect(hinted.box.bottom - plain.box.bottom).toBe(lineHeight)
        expect(plain.box.top).toBe(10 - clearSize / 2)
    })
})
