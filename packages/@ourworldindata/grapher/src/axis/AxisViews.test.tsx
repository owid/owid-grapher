/**
 * @vitest-environment happy-dom
 */

import { expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { AxisConfig } from "./AxisConfig"
import {
    DualAxisComponent,
    HorizontalAxisComponent,
    HorizontalAxisGridLines,
} from "./AxisViews"
import { Bounds } from "@ourworldindata/utils"
import { ScaleType } from "@ourworldindata/types"
import { DualAxis } from "./Axis"
import { DEFAULT_GRAPHER_BOUNDS } from "../core/GrapherConstants.js"

it("can create horizontal axis", () => {
    const axisConfig = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    })

    const { container } = render(
        <HorizontalAxisGridLines
            axis={axisConfig.toHorizontalAxis()}
            bounds={DEFAULT_GRAPHER_BOUNDS}
        />
    )
    expect(container.firstChild).toBeTruthy()
})

it("can render a dual axis", () => {
    const verticalAxis = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    }).toVerticalAxis()

    const horizontalAxis = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 25,
    }).toHorizontalAxis()

    const dualAxis = new DualAxis({
        verticalAxis,
        horizontalAxis,
    })

    render(<DualAxisComponent dualAxis={dualAxis} />)
    expect(screen.getByText("100")).toBeTruthy()
    expect(screen.getByText("25")).toBeTruthy()
})

it("renders nothing for a hidden horizontal axis", () => {
    const axis = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
        hideAxis: true,
    }).toHorizontalAxis()
    axis.range = [0, 400]

    const { container } = render(
        <svg>
            <HorizontalAxisComponent
                axis={axis}
                bounds={new Bounds(0, 0, 400, 50)}
            />
        </svg>
    )
    expect(container.querySelector("svg")?.childNodes.length).toEqual(0)
})
