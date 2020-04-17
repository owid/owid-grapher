import * as React from "react"
import { mount } from "enzyme"
import { RelatedCharts } from "../RelatedCharts"

const charts = [
    {
        title: "Chart 1",
        slug: "chart-1"
    },
    {
        title: "Chart 2",
        slug: "chart-2"
    }
]

it("renders active chart links and loads respective chart on click", () => {
    const wrapper = mount(<RelatedCharts charts={charts} />)

    expect(wrapper.find("li")).toHaveLength(2)

    expect(
        wrapper
            .find("li")
            .first()
            .hasClass("active")
    ).toEqual(true)

    expect(
        wrapper
            .find("li")
            .first()
            .text()
    ).toBe("Chart 1")

    wrapper.find("a").forEach((link, idx) => {
        link.simulate("click")
        expect(wrapper.find("iframe")).toHaveLength(1)
        expect(
            wrapper.find(`iframe[src="/grapher/${charts[idx].slug}"]`)
        ).toHaveLength(1)
    })

    expect(
        wrapper
            .find("li")
            .last()
            .hasClass("active")
    ).toEqual(true)
})
