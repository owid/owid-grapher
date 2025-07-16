/**
 * @vitest-environment jsdom
 */

import { expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { AxisConfig } from "./AxisConfig"
import { DualAxisComponent, HorizontalAxisGridLines } from "./AxisViews"
import { ScaleType } from "@ourworldindata/types"
import { DualAxis } from "./Axis"

it("can create horizontal axis", () => {
    const axisConfig = new AxisConfig({
        scaleType: ScaleType.linear,
        min: 0,
        max: 100,
    })

    const { container } = render(
        <HorizontalAxisGridLines
            horizontalAxis={axisConfig.toHorizontalAxis()}
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
