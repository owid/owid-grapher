#! /usr/bin/env yarn jest

import { mount } from "enzyme"
import React from "react"
import { GrapherView } from "grapher/core/GrapherView"
import { Bounds } from "grapher/utils/Bounds"
import { MapTooltip } from "grapher/mapCharts/MapTooltip"
import { Grapher } from "grapher/core/Grapher"

const bounds = new Bounds(0, 0, 800, 600)

const mockEvent = {
    clientX: 50,
    clientY: 50,
}

const grapher = new Grapher(
    {
        hasMapTab: true,
        tab: "map",
        map: {
            timeTolerance: 5,
        },
        dimensions: [
            {
                variableId: 3512,
                property: "y",
                display: {
                    name: "",
                    unit: "% of children under 5",
                    tolerance: 5,
                    isProjection: false,
                },
            },
        ],
        owidDataset: {
            variables: {
                "3512": {
                    years: [2000, 2010, 2010],
                    entities: [207, 15, 207],
                    values: [4, 20, 34],
                    id: 3512,
                    shortUnit: "%",
                },
            },
            entityKey: {
                "15": { name: "Afghanistan", id: 15, code: "AFG" },
                "207": { name: "Iceland", id: 207, code: "ISL" },
            },
        },
    },
    {
        queryStr: "?time=2002",
    }
)

const grapherWrapper = mount(<GrapherView grapher={grapher} bounds={bounds} />)

describe(MapTooltip, () => {
    test("map tooltip renders iff mouseenter", () => {
        expect(grapherWrapper.find(".map-tooltip")).toHaveLength(0)

        const grapherWrapperWithHover = grapherWrapper
            .find("path")
            .findWhere((node) => node.key() === "Iceland")
            .simulate("mouseenter", mockEvent)
            .update()

        expect(grapherWrapperWithHover.find(".map-tooltip")).toHaveLength(1)

        const tooltipWrapper = grapherWrapperWithHover.find(".map-tooltip")
        expect(tooltipWrapper.find(".bar")).toHaveLength(20)
        expect(tooltipWrapper.find(".count").text()).toEqual(
            "4% of children under 5 "
        )
    })
})
