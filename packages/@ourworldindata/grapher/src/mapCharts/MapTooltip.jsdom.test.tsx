#! /usr/bin/env jest
import { Grapher, GrapherState } from "../core/Grapher.js"
import { legacyMapGrapher } from "./MapChart.sample.js"

import Enzyme from "enzyme"
import Adapter from "@wojtekmaj/enzyme-adapter-react-17"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "../core/LegacyToOwidTable.js"
Enzyme.configure({ adapter: new Adapter() })

const state = new GrapherState({ ...legacyMapGrapher })
state.inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
    legacyMapGrapher.owidDataset!,
    legacyMapGrapher.dimensions!,
    legacyMapGrapher.selectedEntityColors
)
const grapherWrapper = Enzyme.mount(<Grapher grapherState={state} />)

test("map tooltip renders iff mouseenter", () => {
    expect(grapherWrapper.find(".Tooltip")).toHaveLength(0)

    const grapherWrapperWithHover = grapherWrapper
        .find("path")
        .findWhere((node) => node.key() === "Iceland")
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
