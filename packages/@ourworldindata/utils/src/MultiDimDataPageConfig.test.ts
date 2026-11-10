import { expect, it, describe } from "vitest"

import { v7 as uuidv7 } from "uuid"

import {
    Dimension,
    MultiDimDataPageConfigEnriched,
} from "@ourworldindata/types"
import {
    MultiDimDataPageConfig,
    resolveDimensionPresentationType,
} from "./MultiDimDataPageConfig.js"

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
                y: [{ id: 111 }, { id: 222 }],
            },
            fullConfigId: uuidv7(),
        },
        {
            dimensions: {
                view: "poverty",
                interval: "yearly",
            },
            indicators: {
                y: [{ id: 819727 }],
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

describe(resolveDimensionPresentationType, () => {
    const makeDimension = (
        choiceCount: number,
        overrides: Partial<Dimension> = {}
    ): Dimension => ({
        slug: "dim",
        name: "Dimension",
        choices: Array.from({ length: choiceCount }, (_, i) => ({
            slug: `choice-${i}`,
            name: `Choice ${i}`,
        })),
        ...overrides,
    })

    // Unless a test says otherwise, all of a dimension's choices are
    // available.
    const resolveWith = (
        dimension: Dimension,
        availableChoiceCount = dimension.choices.length
    ): string =>
        resolveDimensionPresentationType({
            dimension,
            availableChoiceCount,
        })

    it("defaults to dropdown", () => {
        expect(resolveWith(makeDimension(2))).toBe("dropdown")
    })

    it("adds a search field when at least ten choices are available", () => {
        expect(resolveWith(makeDimension(9))).toBe("dropdown")
        expect(resolveWith(makeDimension(10))).toBe("dropdown-with-search")
    })

    // The search field depends on how many options the menu lists right
    // now, not on how many the dimension has in total.
    it("skips the search field when few choices are available", () => {
        expect(resolveWith(makeDimension(30), 5)).toBe("dropdown")
        expect(resolveWith(makeDimension(30), 10)).toBe("dropdown-with-search")
    })

    it("respects an explicit presentation type", () => {
        expect(
            resolveWith(
                makeDimension(5, { presentation: { type: "toggle-buttons" } })
            )
        ).toBe("toggle-buttons")
        expect(
            resolveWith(
                makeDimension(3, {
                    presentation: { type: "dropdown-with-search" },
                })
            )
        ).toBe("dropdown-with-search")
        expect(
            resolveWith(
                makeDimension(30, { presentation: { type: "dropdown" } })
            )
        ).toBe("dropdown")
    })
})
