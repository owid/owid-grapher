#! /usr/bin/env jest

import React from "react"
import { RelatedCharts } from "./RelatedCharts.js"

import Enzyme from "enzyme"
import Adapter from "@wojtekmaj/enzyme-adapter-react-17"
import {
    BAKED_BASE_URL,
    GRAPHER_DYNAMIC_THUMBNAIL_URL,
} from "../../settings/clientSettings.js"
import { KeyChartLevel } from "@ourworldindata/utils"
Enzyme.configure({ adapter: new Adapter() })

const charts = [
    {
        title: "Chart 1",
        slug: "chart-1",
        keyChartLevel: KeyChartLevel.Middle,
    },
    {
        title: "Chart 2",
        slug: "chart-2",
        keyChartLevel: KeyChartLevel.Top,
    },
]

it("renders active chart links and loads respective chart on click", () => {
    const wrapper = Enzyme.mount(<RelatedCharts charts={charts} />)

    expect(wrapper.find("li")).toHaveLength(2)

    expect(wrapper.find("li").first().hasClass("active")).toEqual(true)
    expect(wrapper.find("li").first().text()).toBe("Chart 2")
    expect(
        wrapper
            .find("li")
            .first()
            .find(
                `img[src="${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${charts[1].slug}.png"]`
            )
    ).toHaveLength(1)

    wrapper.find("li > a").forEach((link, idx) => {
        // Chart 2 has a higher priority, so the charts should be in reverse order: `Chart 2, Chart 1`
        const expectedChartIdx = 1 - idx
        link.simulate("click")
        expect(wrapper.find("figure")).toHaveLength(1)
        expect(
            wrapper.find(
                `figure[data-grapher-src="${BAKED_BASE_URL}/grapher/${charts[expectedChartIdx]?.slug}"]`
            )
        ).toHaveLength(1)
        // should have forced re-render by changing the `key`
        expect(wrapper.find("figure").key()).toEqual(
            charts[expectedChartIdx].slug
        )
    })

    expect(wrapper.find("li").last().hasClass("active")).toEqual(true)
})
