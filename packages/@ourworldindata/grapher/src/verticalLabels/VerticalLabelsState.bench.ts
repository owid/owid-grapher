import { bench, describe } from "vitest"
import { AxisConfig } from "../axis/AxisConfig.js"
import { VerticalLabelsState } from "./VerticalLabelsState.js"
import { VerticalAxis } from "../axis/Axis.js"
import { LabelSeries } from "./VerticalLabelsTypes.js"

// The right-hand-side series labels on a line chart (country names next to each
// line end) have to be measured, filtered to what fits, and then nudged apart
// so they don't overlap. The de-collision step re-stacks overlapping groups in
// a loop, so it gets expensive when many labels crowd a short axis — exactly
// the case this benchmark sets up.

/** Reference a value so it isn't flagged as an unused expression. */
function keep(value: unknown): void {
    if (value === undefined) throw new Error("expected a value")
}

function makeAxis(yRange: [number, number]): VerticalAxis {
    const yAxis = new AxisConfig({ min: 0, max: 100 }).toVerticalAxis()
    yAxis.range = yRange
    return yAxis
}

/**
 * Build `count` labels whose values cluster in the lower half of the domain, so
 * a large share of them collide and have to be repositioned.
 */
function makeSeries(count: number): LabelSeries[] {
    const series: LabelSeries[] = []
    for (let i = 0; i < count; i++) {
        series.push({
            seriesName: `Country ${i}`,
            label: `Country ${i}`,
            color: "#4c6a9c",
            // Cluster values so labels overlap heavily
            yValue: (i % 40) + Math.sin(i) * 3,
        })
    }
    return series
}

describe("VerticalLabelsState.placedSeries", () => {
    const fewSeries = makeSeries(20)
    const manySeries = makeSeries(80)

    bench("20 labels on a 400px axis", () => {
        const state = new VerticalLabelsState(fewSeries, {
            yAxis: () => makeAxis([400, 0]),
            maxWidth: 150,
        })
        keep(state.placedSeries)
    })

    bench("80 crowded labels on a 400px axis", () => {
        const state = new VerticalLabelsState(manySeries, {
            yAxis: () => makeAxis([400, 0]),
            maxWidth: 150,
        })
        keep(state.placedSeries)
    })
})
