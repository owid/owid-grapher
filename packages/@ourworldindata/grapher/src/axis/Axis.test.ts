import { expect, it, describe } from "vitest"

import { HorizontalAxis } from "../axis/Axis"
import { ScaleType, AxisConfigInterface } from "@ourworldindata/types"
import {
    SynthesizeFruitTable,
    SynthesizeGDPTable,
} from "@ourworldindata/core-table"
import { AxisConfig } from "./AxisConfig"
import { AxisAlign, last } from "@ourworldindata/utils"

it("can create an axis", () => {
    const axisConfig = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    })
    const axis = new HorizontalAxis(axisConfig)
    expect(axis.domain).toEqual([0, 100])

    axis.range = [0, 200]
    const ticks = axis.getTickValues()
    expect(ticks.length).toBeGreaterThan(1)
})

it("can assign a column to an axis", () => {
    const axisConfig = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    })
    const table = SynthesizeGDPTable()
    const axis = new HorizontalAxis(axisConfig)
    axis.formatColumn = table.get("GDP")
    axis.range = [0, 200]

    const ticks = axis.getTickValues()
    expect(ticks.length).toBeGreaterThan(1)
})

it("respects minSize unless hidden", () => {
    const config: AxisConfigInterface = {
        min: 0,
        max: 100,
    }
    const { size } = new AxisConfig(config).toHorizontalAxis()
    const configWithMinSize: AxisConfigInterface = {
        ...config,
        minSize: size + 10,
    }
    const axisWithMinSize = new AxisConfig(configWithMinSize).toHorizontalAxis()
    expect(axisWithMinSize.size).toEqual(size + 10)

    const hiddenAxis = new AxisConfig({
        ...configWithMinSize,
        hideAxis: true,
    }).toHorizontalAxis()
    expect(hiddenAxis.size).toEqual(0)
})

it("respects maxTicks parameter", () => {
    const config: AxisConfigInterface = {
        min: 0,
        max: 100,
        maxTicks: 10,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 500]

    const axisWithLessTicks = new AxisConfig({
        ...config,
        maxTicks: 1,
    }).toVerticalAxis()

    expect(axis.getTickValues().length).toBeGreaterThan(
        axisWithLessTicks.getTickValues().length
    )
})

it("respects nice parameter", () => {
    const config: AxisConfigInterface = {
        min: 0.0001,
        max: 99.9999,
        maxTicks: 2,
        nice: true,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 300]
    const tickValues = axis.getTickValues()
    expect(tickValues[0].value).toEqual(0)
    expect(last(tickValues)?.value).toEqual(100)
})

it("doesn't add 'nice' ticks to eagerly", () => {
    const config: AxisConfigInterface = {
        min: 0.0001,
        max: 90.0001,
        maxTicks: 10,
        nice: true,
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 300]
    const tickValues = axis.getTickValues()
    expect(tickValues[0].value).toEqual(0)
    expect(last(tickValues)?.value).toEqual(90)
})

it("creates compact labels", () => {
    const config: AxisConfigInterface = {
        min: 1000,
        max: 4000,
        maxTicks: 3,
        tickFormattingOptions: { numberAbbreviation: "short" },
    }
    const axis = new AxisConfig(config).toVerticalAxis()
    axis.range = [0, 500]
    axis.formatColumn = SynthesizeGDPTable().get("GDP")
    const { tickLabels } = axis
    expect(tickLabels.length).toBeGreaterThan(0)
    expect(
        tickLabels.every((tickLabel) => tickLabel.formattedValue.endsWith("k"))
    ).toBeTruthy()
})

describe("singleValueAxisPointAlign", () => {
    const testAlign = (
        align: AxisAlign | undefined,
        expected: number
    ): void => {
        const config: AxisConfigInterface = {
            min: 0,
            max: 0,
            singleValueAxisPointAlign: align,
        }
        const axis = new AxisConfig(config).toVerticalAxis()
        axis.range = [0, 500]
        expect(axis.place(-1)).toEqual(expected)
        expect(axis.place(0)).toEqual(expected)
        expect(axis.place(1)).toEqual(expected)
    }
    it("aligns to start", () => testAlign(AxisAlign.start, 0))
    it("aligns to middle", () => testAlign(AxisAlign.middle, 250))
    it("aligns to end", () => testAlign(AxisAlign.end, 500))
    it("defaults to middle", () => testAlign(undefined, 250))
})

describe("tick labels", () => {
    // see https://github.com/owid/owid-grapher/issues/1267
    it("includes sufficient decimal places for small values", () => {
        const config: AxisConfigInterface = {
            min: 0,
            max: 0.0004,
        }
        const axis = new AxisConfig(config).toHorizontalAxis()
        axis.range = [0, 500]
        // we need to set a formatColumn, otherwise the tick labels are not formatted at all
        axis.formatColumn = SynthesizeFruitTable().get("Fruit")

        const formattedTickLabels = axis.tickLabels.map((l) => l.formattedValue)
        expect(formattedTickLabels).toEqual([
            "0",
            "0.00005",
            "0.0001",
            "0.00015",
            "0.0002",
            "0.00025",
            "0.0003",
            "0.00035",
        ])
    })
})

describe("manual ticks", () => {
    const defaultConfig: AxisConfigInterface = {
        ticks: [
            { value: -1, priority: 1 },
            { value: -Infinity, priority: 1 },
            { value: 49.5, priority: 1 },
            { value: 99, priority: 2 },
            { value: Infinity, priority: 1 },
        ],
    }
    const defaultAxis = new AxisConfig(defaultConfig, {
        fontSize: 16,
    }).toHorizontalAxis()
    defaultAxis.domain = [0, 100]
    defaultAxis.range = [0, 300]
    defaultAxis.hideFractionalTicks = true // should have no effect

    it("hides manual ticks outside the axis domain", () => {
        expect(
            defaultAxis.getTickValues().map((tick) => tick.value)
        ).not.toContain(-1)
    })

    it("includes manually specified ticks", () => {
        expect(defaultAxis.getTickValues().map((tick) => tick.value)).toEqual(
            expect.arrayContaining([49.5, 99])
        )
    })

    it("replaces ±infinity with min/max of the data", () => {
        expect(defaultAxis.getTickValues().map((tick) => tick.value)).toEqual(
            expect.arrayContaining([0, 100])
        )
    })

    it("doesn't generate any automatic ticks", () => {
        expect(
            defaultAxis.getTickValues().map((tick) => tick.value)
        ).toHaveLength(4)
    })

    it("hides tick labels that overlap", () => {
        expect(
            defaultAxis.tickLabels.map((label) => label.value)
        ).not.toContain(99)
    })
})
