#! /usr/bin/env jest

import React from "react"
import { Grapher } from "grapher/core/Grapher"
import { legacyMapGrapher } from "./MapChart.sample"

import { configure, mount } from "enzyme"
import Adapter from "enzyme-adapter-react-16"
configure({ adapter: new Adapter() })

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
