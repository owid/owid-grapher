/**
 * @vitest-environment happy-dom
 */

import * as React from "react"
import { act, render } from "@testing-library/react"
import { expect, it, describe } from "vitest"

import { Bounds } from "@ourworldindata/utils"
import {
    SampleColumnSlugs,
    SynthesizeFruitTable,
} from "@ourworldindata/core-table"
import { CategoricalBin } from "../color/ColorScaleBin"
import { SelectionArray } from "../selection/SelectionArray"
import { StackedDiscreteBarChart } from "../stackedCharts/StackedDiscreteBarChart"
import { StackedDiscreteBarChartState } from "../stackedCharts/StackedDiscreteBarChartState"

describe("legend emphasis reactivity", () => {
    it("repaints the legend when a bin is hovered", () => {
        const table = SynthesizeFruitTable({
            timeRange: [2000, 2001],
            entityCount: 5,
        })
        const selection = new SelectionArray()
        selection.addToSelection(table.sampleEntityName(5))
        const manager = {
            table,
            yColumnSlugs: [
                SampleColumnSlugs.Fruit,
                SampleColumnSlugs.Vegetables,
            ],
            selection,
            showLegend: true,
            fontSize: 16,
        }
        const chartState = new StackedDiscreteBarChartState({ manager })
        const ref = React.createRef<StackedDiscreteBarChart>()

        const { container } = render(
            <svg>
                <StackedDiscreteBarChart
                    ref={ref}
                    chartState={chartState}
                    bounds={new Bounds(0, 0, 640, 480)}
                />
            </svg>
        )

        const legendMarkup = (): string =>
            container.querySelector(".categoricalColorLegend")!.innerHTML

        const atRest = legendMarkup()
        expect(atRest).toContain(SampleColumnSlugs.Fruit)

        const chart = ref.current!
        const fruitBin = new CategoricalBin({
            index: 0,
            value: SampleColumnSlugs.Fruit,
            label: SampleColumnSlugs.Fruit,
            color: "#f00",
        })

        act(() => chart.onLegendMouseOver(fruitBin))
        expect(legendMarkup()).not.toEqual(atRest)

        act(() => chart.onLegendMouseLeave())
        expect(legendMarkup()).toEqual(atRest)
    })
})
