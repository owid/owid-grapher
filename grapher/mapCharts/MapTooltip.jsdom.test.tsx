#! /usr/bin/env yarn jest

import { mount } from "enzyme"
import React from "react"
import { Grapher } from "grapher/core/Grapher"
import { legacyMapGrapher } from "./MapChart.sample"

const grapherWrapper = mount(<Grapher {...legacyMapGrapher} />)

test("map tooltip renders iff mouseenter", () => {
    expect(grapherWrapper.find(".map-tooltip")).toHaveLength(0)

    const grapherWrapperWithHover = grapherWrapper
        .find("path")
        .findWhere((node) => node.key() === "Iceland")
        .simulate("mouseenter", {
            clientX: 50,
            clientY: 50,
        })
        .update()

    expect(grapherWrapperWithHover.find(".map-tooltip")).toHaveLength(1)

    const tooltipWrapper = grapherWrapperWithHover.find(".map-tooltip")
    expect(tooltipWrapper.find(".bar")).toHaveLength(20)
    expect(tooltipWrapper.find(".count").text()).toEqual(
        "4% of children under 5 "
    )
})
