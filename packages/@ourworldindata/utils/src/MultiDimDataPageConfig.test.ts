import { expect, it, describe } from "vitest"

import { v7 as uuidv7 } from "uuid"

import {
    Dimension,
    MultiDimDataPageConfigEnriched,
    ViewEnriched,
} from "@ourworldindata/types"
import {
    MultiDimDataPageConfig,
    MultiDimViewNotFoundError,
    resolveDimensionPresentationType,
    searchParamsToMultiDimView,
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
        numberOfDimensions: number,
        availableChoiceCount = dimension.choices.length
    ): string =>
        resolveDimensionPresentationType({
            dimension,
            numberOfDimensions,
            availableChoiceCount,
        })

    describe("on a page with several dimensions", () => {
        const resolve = (
            dimension: Dimension,
            availableChoiceCount?: number
        ): string => resolveWith(dimension, 3, availableChoiceCount)

        it("defaults to toggle buttons for at most two choices", () => {
            expect(resolve(makeDimension(1))).toBe("toggle-buttons")
            expect(resolve(makeDimension(2))).toBe("toggle-buttons")
        })

        it("defaults to dropdown for more than two choices", () => {
            expect(resolve(makeDimension(3))).toBe("dropdown")
        })

        it("defaults to dropdown when choices are grouped", () => {
            const dimension = makeDimension(2)
            dimension.choices[0].group = "Group"
            expect(resolve(dimension)).toBe("dropdown")
        })

        it("adds a search field when at least ten choices are available", () => {
            expect(resolve(makeDimension(9))).toBe("dropdown")
            expect(resolve(makeDimension(10))).toBe("dropdown-with-search")
        })

        // The search field depends on how many options the menu lists right
        // now, not on how many the dimension has in total.
        it("skips the search field when few choices are available", () => {
            expect(resolve(makeDimension(30), 5)).toBe("dropdown")
            expect(resolve(makeDimension(30), 10)).toBe("dropdown-with-search")
        })

        // Toggle group or dropdown is decided on all choices, so the control
        // doesn't switch type as other selections change.
        it("ignores availability when choosing between toggle buttons and dropdown", () => {
            expect(resolve(makeDimension(2), 1)).toBe("toggle-buttons")
            expect(resolve(makeDimension(3), 2)).toBe("dropdown")
        })
    })

    // A lone dimension has the whole controls row to itself, so a toggle
    // group stays readable with a few more choices.
    describe("on a page with a single dimension", () => {
        const resolve = (dimension: Dimension): string =>
            resolveWith(dimension, 1)

        it("defaults to toggle buttons for at most four choices", () => {
            expect(resolve(makeDimension(3))).toBe("toggle-buttons")
            expect(resolve(makeDimension(4))).toBe("toggle-buttons")
        })

        it("defaults to dropdown for more than four choices", () => {
            expect(resolve(makeDimension(5))).toBe("dropdown")
        })

        it("defaults to dropdown when choices are grouped", () => {
            const dimension = makeDimension(3)
            dimension.choices[0].group = "Group"
            expect(resolve(dimension)).toBe("dropdown")
        })
    })

    it("respects an explicit presentation type", () => {
        expect(
            resolveWith(
                makeDimension(2, { presentation: { type: "dropdown" } }),
                3
            )
        ).toBe("dropdown")
        expect(
            resolveWith(
                makeDimension(4, { presentation: { type: "dropdown" } }),
                1
            )
        ).toBe("dropdown")
        expect(
            resolveWith(
                makeDimension(5, { presentation: { type: "toggle-buttons" } }),
                3
            )
        ).toBe("toggle-buttons")
        expect(
            resolveWith(
                makeDimension(3, {
                    presentation: { type: "dropdown-with-search" },
                }),
                3
            )
        ).toBe("dropdown-with-search")
        expect(
            resolveWith(
                makeDimension(30, { presentation: { type: "dropdown" } }),
                3
            )
        ).toBe("dropdown")
    })
})

describe(searchParamsToMultiDimView, () => {
    // Every view except asylum seekers broken down by age exists
    const view = (metric: string, age: string): ViewEnriched => ({
        dimensions: { metric, age },
        indicators: { y: [{ id: 1 }] },
        fullConfigId: `${metric}-${age}`,
    })
    const config: MultiDimDataPageConfigEnriched = {
        title: { title: "Refugees and asylum seekers" },
        dimensions: [
            {
                slug: "metric",
                name: "Metric",
                choices: [
                    { slug: "refugees", name: "Refugees" },
                    { slug: "asylum_seekers", name: "Asylum seekers" },
                ],
            },
            {
                slug: "age",
                name: "Age",
                choices: [
                    { slug: "all_ages", name: "All ages" },
                    { slug: "children", name: "Children" },
                ],
            },
        ],
        views: [
            view("refugees", "all_ages"),
            view("refugees", "children"),
            view("asylum_seekers", "all_ages"),
        ],
    }
    const resolve = (queryStr: string): string =>
        searchParamsToMultiDimView(config, new URLSearchParams(queryStr))
            .fullConfigId

    it("resolves to the default view without dimension params", () => {
        expect(resolve("")).toBe("refugees-all_ages")
        expect(resolve("tab=map")).toBe("refugees-all_ages")
    })

    it("resolves a fully specified view", () => {
        expect(resolve("metric=refugees&age=children")).toBe(
            "refugees-children"
        )
    })

    // E.g. a URL from before the age dimension was added, which used to
    // match several views and fail
    it("fills in dimensions missing from the URL", () => {
        expect(resolve("metric=refugees")).toBe("refugees-all_ages")
        expect(resolve("metric=asylum_seekers")).toBe("asylum_seekers-all_ages")
        expect(resolve("age=children")).toBe("refugees-children")
        expect(resolve("metric=refugees&age=")).toBe("refugees-all_ages")
    })

    it("rejects choices that don't select an existing view", () => {
        expect(() => resolve("metric=nonexistent")).toThrow(
            MultiDimViewNotFoundError
        )
        expect(() => resolve("metric=asylum_seekers&age=children")).toThrow(
            MultiDimViewNotFoundError
        )
    })
})
