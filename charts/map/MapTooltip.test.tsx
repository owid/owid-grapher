#! /usr/bin/env yarn jest

import { setupChart } from "test/utils"
import { mount } from "enzyme"
import React from "react"
import { ChartView } from "charts/ChartView"
import { Bounds } from "charts/Bounds"
import { MapTooltip } from "charts/map/MapTooltip"

const bounds = new Bounds(0, 0, 800, 600)

const mockEvent = {
    clientX: 50,
    clientY: 50
}

const chart = setupChart(792, [3512], { hasMapTab: true })
const chartWrapper = mount(<ChartView chart={chart} bounds={bounds} />)

describe(MapTooltip, () => {
    test("map tooltip renders iff mouseenter", () => {
        expect(chartWrapper.find(".map-tooltip")).toHaveLength(0)

        const chartWrapperWithHover = chartWrapper
            .find("path")
            .findWhere(node => node.key() === "United States")
            .simulate("mouseenter", mockEvent)
            .update()

        expect(chartWrapperWithHover.find(".map-tooltip")).toHaveLength(1)

        const tooltipWrapper = chartWrapperWithHover.find(".map-tooltip")
        expect(tooltipWrapper.find(".bar")).toHaveLength(20)
        expect(tooltipWrapper.find(".count").text()).toEqual(
            "0.5% of children under 5 "
        )
    })
})
