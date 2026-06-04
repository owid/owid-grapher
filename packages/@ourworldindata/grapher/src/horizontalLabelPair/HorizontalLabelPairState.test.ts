import { describe, expect, it } from "vitest"
import { HorizontalAlign, Pair } from "@ourworldindata/utils"
import {
    HorizontalLabelPairOptions,
    HorizontalLabelPairState,
} from "./HorizontalLabelPairState"
import { HorizontalLabel } from "./HorizontalLabelPairTypes"
import { textWidth } from "../chart/ChartUtils.js"

const defaultFontSettings = { fontSize: 12, fontWeight: 400, lineHeight: 1 }

const makeHorizontalLabelPairState = (
    series: Pair<HorizontalLabel>,
    options: Partial<HorizontalLabelPairOptions> = {}
): HorizontalLabelPairState => {
    return new HorizontalLabelPairState(series, {
        xRange: options.xRange ?? [0, 1000],
        fontSettings: defaultFontSettings,
        ...options,
    })
}

it("honors textAnchor", () => {
    const state = makeHorizontalLabelPairState([
        { text: "Left", x: 200, textAnchor: HorizontalAlign.left },
        { text: "Right", x: 800, textAnchor: HorizontalAlign.right },
    ])
    expect(state.placedSeries[0].bounds.left).toBe(200)
    expect(state.placedSeries[1].bounds.right).toBeCloseTo(800)

    // Center anchor
    const centered = makeHorizontalLabelPairState([
        { text: "Centered left", x: 200, textAnchor: HorizontalAlign.center },
        { text: "Centered right", x: 800, textAnchor: HorizontalAlign.center },
    ])
    expect(centered.placedSeries[0].bounds.centerX).toBeCloseTo(200)
    expect(centered.placedSeries[1].bounds.centerX).toBeCloseTo(800)
})

it("returns labels in left-to-right spatial order", () => {
    // Pass inputs in reversed spatial order; output should still be left-first
    const state = makeHorizontalLabelPairState([
        { text: "Right", x: 900 },
        { text: "Left", x: 100 },
    ])
    expect(state.placedSeries[0].text).toEqual("Left")
    expect(state.placedSeries[1].text).toEqual("Right")
})

it("clamps labels that would overflow xRange", () => {
    const xRange: [number, number] = [0, 1000]

    const state = makeHorizontalLabelPairState(
        [
            { text: "Left label", x: 1, textAnchor: HorizontalAlign.center },
            { text: "Right label", x: 999, textAnchor: HorizontalAlign.center },
        ],
        { xRange }
    )
    expect(state.placedSeries[0].bounds.left).toBe(xRange[0])
    expect(state.placedSeries[1].bounds.right).toBe(xRange[1])
})

it("enforces minGap between overlapping labels", () => {
    const minGap = 10
    const state = makeHorizontalLabelPairState(
        [
            { text: "Left", x: 500, textAnchor: HorizontalAlign.center },
            { text: "Right", x: 500, textAnchor: HorizontalAlign.center },
        ],
        { minGap }
    )
    const [left, right] = state.placedSeries
    expect(right.bounds.left - left.bounds.right).toBeCloseTo(minGap)
})

it("reports hasOverlap when minGap can't be satisfied", () => {
    const state = makeHorizontalLabelPairState(
        [
            {
                text: "Some long label",
                x: 50,
                textAnchor: HorizontalAlign.right,
            },
            {
                text: "Another long label",
                x: 50,
                textAnchor: HorizontalAlign.left,
            },
        ],
        // Not enough horizontal space to fit both labels with the required minGap
        { xRange: [0, 150], minGap: 10 }
    )

    expect(state.hasOverlap).toBe(true)
})

describe("label placement when textAnchor is center", () => {
    // Enough space to fit both labels below
    const xRange: [number, number] = [0, 500]
    const minGap = 10

    const firstLabel = "First label"
    const secondLabel = "Second label"

    const firstLabelWidth = textWidth(firstLabel, defaultFontSettings)

    it("places labels at their anchor positions when there's no overlap", () => {
        const state = makeHorizontalLabelPairState(
            [
                {
                    text: firstLabel,
                    x: 100,
                    textAnchor: HorizontalAlign.center,
                },
                {
                    text: secondLabel,
                    x: 400,
                    textAnchor: HorizontalAlign.center,
                },
            ],
            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[0].bounds.centerX).toBeCloseTo(100)
        expect(state.placedSeries[1].bounds.centerX).toBeCloseTo(400)
    })

    it("resolves overlap between labels", () => {
        const state = makeHorizontalLabelPairState(
            [
                {
                    text: firstLabel,
                    x: 250,
                    textAnchor: HorizontalAlign.center,
                },
                {
                    text: secondLabel,
                    x: 250,
                    textAnchor: HorizontalAlign.center,
                },
            ],

            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[0].bounds.centerX).toBeCloseTo(215, 0)
        expect(state.placedSeries[1].bounds.centerX).toBeCloseTo(285, 0)
    })

    it("resolves overlap close to the left edge", () => {
        const state = makeHorizontalLabelPairState(
            [
                { text: firstLabel, x: 5, textAnchor: HorizontalAlign.center },
                {
                    text: secondLabel,
                    x: 10,
                    textAnchor: HorizontalAlign.center,
                },
            ],
            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[0].bounds.left).toBe(0)
        expect(state.placedSeries[1].bounds.left).toBeCloseTo(
            firstLabelWidth + minGap
        )
    })

    it("resolves overlap close to the right edge", () => {
        const state = makeHorizontalLabelPairState(
            [
                {
                    text: firstLabel,
                    x: 495,
                    textAnchor: HorizontalAlign.center,
                },
                {
                    text: secondLabel,
                    x: 490,
                    textAnchor: HorizontalAlign.center,
                },
            ],

            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[0].bounds.right).toBeCloseTo(
            xRange[1] - firstLabelWidth - minGap
        )
        expect(state.placedSeries[1].bounds.right).toBe(xRange[1])
    })
})

describe("label placement when textAnchors are left and right", () => {
    // Enough space to fit both labels
    const xRange: [number, number] = [0, 500]
    const minGap = 10

    // Anchored on its right edge (sits to the left of its target x)
    const leftLabel = "Left label"
    const leftLabelWidth = textWidth(leftLabel, defaultFontSettings)

    // Anchored on its left edge (sits to the right of its target x)
    const rightLabel = "Right label"
    const rightLabelWidth = textWidth(rightLabel, defaultFontSettings)

    it("places labels at their anchor positions when there's no overlap", () => {
        const state = makeHorizontalLabelPairState(
            [
                { text: leftLabel, x: 100, textAnchor: HorizontalAlign.right },
                { text: rightLabel, x: 400, textAnchor: HorizontalAlign.left },
            ],
            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[0].bounds.right).toBe(100)
        expect(state.placedSeries[1].bounds.left).toBe(400)
    })

    it("resolves overlap between labels", () => {
        // Anchor positions are 260 and 240 (midpoint 250). The 30px overlap is
        // split equally so the gap ends up centered on the midpoint.
        const state = makeHorizontalLabelPairState(
            [
                { text: leftLabel, x: 260, textAnchor: HorizontalAlign.right },
                { text: rightLabel, x: 240, textAnchor: HorizontalAlign.left },
            ],
            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[0].bounds.right).toBeCloseTo(250 - minGap / 2)
        expect(state.placedSeries[1].bounds.left).toBeCloseTo(250 + minGap / 2)
    })

    it("resolves overlap close to the left edge", () => {
        // The left label is pinned to the left edge of xRange,
        // so the right label has to absorb the full shift.
        const state = makeHorizontalLabelPairState(
            [
                { text: leftLabel, x: 20, textAnchor: HorizontalAlign.right },
                { text: rightLabel, x: 10, textAnchor: HorizontalAlign.left },
            ],
            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[0].bounds.left).toBe(0)
        expect(state.placedSeries[1].bounds.left).toBeCloseTo(
            leftLabelWidth + minGap
        )
    })

    it("resolves overlap close to the right edge", () => {
        // The right label is pinned to the right edge of xRange,
        // so the left label has to absorb the full shift.
        const state = makeHorizontalLabelPairState(
            [
                { text: leftLabel, x: 450, textAnchor: HorizontalAlign.right },
                { text: rightLabel, x: 499, textAnchor: HorizontalAlign.left },
            ],
            { xRange, minGap }
        )

        expect(state.hasOverlap).toBe(false)
        expect(state.placedSeries[1].bounds.right).toBe(xRange[1])
        expect(state.placedSeries[0].bounds.right).toBeCloseTo(
            xRange[1] - rightLabelWidth - minGap
        )
    })
})
