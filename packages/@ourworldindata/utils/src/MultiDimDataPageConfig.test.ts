#! /usr/bin/env jest

import { uuidv7 } from "uuidv7"

import { MultiDimDataPageConfigEnriched } from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "./MultiDimDataPageConfig.js"

it("fromObject", () => {
    const config = MultiDimDataPageConfig.fromObject({ title: "Test" } as any)
    expect(config.config.title).toBe("Test")
})

const CONFIG: MultiDimDataPageConfigEnriched = {
    title: {
        title: "Anything goes",
    },
    dimensions: [
        {
            slug: "view",
            name: "View",
            choices: [
                {
                    slug: "stunting",
                    name: "Stunting",
                },
                {
                    slug: "poverty",
                    name: "Poverty",
                },
            ],
        },
        {
            slug: "interval",
            name: "Time interval",
            choices: [
                {
                    slug: "yearly",
                    name: "Yearly",
                },
                {
                    slug: "weekly",
                    name: "Weekly",
                },
            ],
        },
    ],
    views: [
        {
            dimensions: {
                view: "stunting",
                interval: "yearly",
            },
            indicators: {
                y: [111, 222],
            },
            fullConfigId: uuidv7(),
        },
        {
            dimensions: {
                view: "poverty",
                interval: "yearly",
            },
            indicators: {
                y: [819727],
            },
            fullConfigId: uuidv7(),
        },
    ],
}

describe("methods", () => {
    const config = MultiDimDataPageConfig.fromObject(CONFIG)

    it("dimensions", () => {
        expect(Object.keys(config.dimensions)).toEqual(["view", "interval"])
        expect(Object.keys(config.dimensions["view"].choicesBySlug)).toEqual([
            "stunting",
            "poverty",
        ])
    })

    it("filterViewsByDimensions", () => {
        const views = config.filterViewsByDimensions({
            view: "stunting",
        })
        expect(views).toHaveLength(1)
    })

    it("findViewByDimensions", () => {
        const view = config.findViewByDimensions({
            view: "stunting",
        })
        expect(view).toBeDefined()
    })
})
