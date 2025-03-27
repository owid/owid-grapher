/**
 * @vitest-environment jsdom
 */

import { expect, test } from "vitest"
import { Grapher } from "../core/Grapher.js"
import { legacyMapGrapher } from "./MapChart.sample.js"

import Enzyme from "enzyme"
import Adapter from "@wojtekmaj/enzyme-adapter-react-17"
Enzyme.configure({ adapter: new Adapter() })

const grapherWrapper = Enzyme.mount(<Grapher {...legacyMapGrapher} />)

test("map tooltip renders iff mouseenter", () => {
    expect(grapherWrapper.find(".Tooltip")).toHaveLength(0)

    const grapherWrapperWithHover = grapherWrapper
        .find("path")
        .findWhere((node) => node.prop("data-feature-id") === "Iceland")
        .simulate("mouseenter", {
            clientX: 50,
            clientY: 50,
        })
        .update()

    expect(grapherWrapperWithHover.find(".Tooltip")).toHaveLength(1)

    const tooltipWrapper = grapherWrapperWithHover.find(".Tooltip")
    expect(tooltipWrapper.find(".variable .definition").text()).toContain(
        "% of children under 5"
    )
    expect(tooltipWrapper.find(".variable .values").text()).toEqual("4%")
})
