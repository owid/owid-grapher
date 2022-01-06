#! /usr/bin/env yarn jest

import { formatParentTopicsTrails } from "./indexContentGraphToAlgolia"
import { excludeNullParentTopics } from "../../db/contentGraph"

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

// Very narrow test, mostly for documentation purposes
it("excludes null parent topics", () => {
    const parentTopicsTitleWithNull = [null, "Climate Change"]
    const parentTopicsTitleWithoutNull = [
        "Coronavirus Pandemic (COVID-19)",
        "Farm Size",
        "Climate Change",
    ]
    const allParentTopicsTitle = [
        parentTopicsTitleWithNull,
        parentTopicsTitleWithoutNull,
    ]

    expect(allParentTopicsTitle.filter(excludeNullParentTopics)).toEqual([
        parentTopicsTitleWithoutNull,
    ])
})
