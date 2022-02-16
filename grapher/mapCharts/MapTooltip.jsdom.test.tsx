#! /usr/bin/env jest

import React from "react"
import { Grapher } from "../core/Grapher.js"
import { legacyMapGrapher } from "./MapChart.sample.js"

import enzyme from "enzyme"
import Adapter from "enzyme-adapter-react-16"
enzyme.configure({ adapter: new Adapter() })

const grapherWrapper = enzyme.mount(<Grapher {...legacyMapGrapher} />)

test.skip("map tooltip renders iff mouseenter", () => {
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
    expect(tooltipWrapper.find(".value").text()).toEqual(
        "4% of children under 5"
    )
})
