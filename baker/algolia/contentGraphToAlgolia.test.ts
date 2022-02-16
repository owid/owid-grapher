#! /usr/bin/env yarn jest

import { formatParentTopicsTrails } from "./contentGraphToAlgolia"

it("formats parent topics trails", () => {
    const parentTopicsTitle = [
        ["Transport", "Climate Change"],
        ["Coronavirus Pandemic (COVID-19)", "Farm Size", "Climate Change"],
    ]
    expect(formatParentTopicsTrails(parentTopicsTitle)).toEqual({
        "topics.lvl0": ["Transport", "Coronavirus Pandemic (COVID-19)"],
        "topics.lvl1": [
            "Transport > Climate Change",
            "Coronavirus Pandemic (COVID-19) > Farm Size",
        ],
        "topics.lvl2": [
            "Coronavirus Pandemic (COVID-19) > Farm Size > Climate Change",
        ],
    })
})
