import { expect, it, describe } from "vitest"

import { v7 as uuidv7 } from "uuid"

import {
    Dimension,
    MultiDimDataPageConfigEnriched,
} from "@ourworldindata/types"
import {
    MultiDimDataPageConfig,
    resolveDimensionPresentationType,
    resolveDimensionShowsSearch,
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

    it("defaults to radio for dimensions with at most two choices", () => {
        expect(resolveDimensionPresentationType(makeDimension(1))).toBe("radio")
        expect(resolveDimensionPresentationType(makeDimension(2))).toBe("radio")
    })

    it("defaults to dropdown for dimensions with more than two choices", () => {
        expect(resolveDimensionPresentationType(makeDimension(3))).toBe(
            "dropdown"
        )
    })

    it("defaults to dropdown when choices are grouped", () => {
        const dimension = makeDimension(2)
        dimension.choices[0].group = "Group"
        expect(resolveDimensionPresentationType(dimension)).toBe("dropdown")
    })

    it("shows a search field only for dropdowns with more than ten choices", () => {
        expect(resolveDimensionShowsSearch(makeDimension(10))).toBe(false)
        expect(resolveDimensionShowsSearch(makeDimension(11))).toBe(true)
    })

    it("respects an explicit search setting", () => {
        expect(
            resolveDimensionShowsSearch(
                makeDimension(3, { presentation: { search: true } })
            )
        ).toBe(true)
        expect(
            resolveDimensionShowsSearch(
                makeDimension(20, { presentation: { search: false } })
            )
        ).toBe(false)
    })

    it("respects an explicit presentation type", () => {
        expect(
            resolveDimensionPresentationType(
                makeDimension(2, { presentation: { type: "dropdown" } })
            )
        ).toBe("dropdown")
        expect(
            resolveDimensionPresentationType(
                makeDimension(5, { presentation: { type: "radio" } })
            )
        ).toBe("radio")
    })
})
