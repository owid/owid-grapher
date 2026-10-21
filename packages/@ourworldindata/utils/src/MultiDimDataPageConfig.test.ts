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

    describe("on a page with several dimensions", () => {
        const resolve = (dimension: Dimension): string =>
            resolveDimensionPresentationType(dimension, { dimensionCount: 3 })

        it("defaults to radio for at most two choices", () => {
            expect(resolve(makeDimension(1))).toBe("radio")
            expect(resolve(makeDimension(2))).toBe("radio")
        })

        it("defaults to dropdown for more than two choices", () => {
            expect(resolve(makeDimension(3))).toBe("dropdown")
        })

        it("defaults to dropdown when choices are grouped", () => {
            const dimension = makeDimension(2)
            dimension.choices[0].group = "Group"
            expect(resolve(dimension)).toBe("dropdown")
        })

        it("defaults to dropdown-with-search for more than twenty choices", () => {
            expect(resolve(makeDimension(20))).toBe("dropdown")
            expect(resolve(makeDimension(21))).toBe("dropdown-with-search")
        })
    })

    // A lone dimension has the whole controls row to itself, so a radio
    // group stays readable with a few more choices.
    describe("on a page with a single dimension", () => {
        const resolve = (dimension: Dimension): string =>
            resolveDimensionPresentationType(dimension, { dimensionCount: 1 })

        it("defaults to radio for at most four choices", () => {
            expect(resolve(makeDimension(3))).toBe("radio")
            expect(resolve(makeDimension(4))).toBe("radio")
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
            resolveDimensionPresentationType(
                makeDimension(2, { presentation: { type: "dropdown" } }),
                { dimensionCount: 3 }
            )
        ).toBe("dropdown")
        expect(
            resolveDimensionPresentationType(
                makeDimension(4, { presentation: { type: "dropdown" } }),
                { dimensionCount: 1 }
            )
        ).toBe("dropdown")
        expect(
            resolveDimensionPresentationType(
                makeDimension(5, { presentation: { type: "radio" } }),
                { dimensionCount: 3 }
            )
        ).toBe("radio")
        expect(
            resolveDimensionPresentationType(
                makeDimension(3, {
                    presentation: { type: "dropdown-with-search" },
                }),
                { dimensionCount: 3 }
            )
        ).toBe("dropdown-with-search")
        expect(
            resolveDimensionPresentationType(
                makeDimension(20, { presentation: { type: "dropdown" } }),
                { dimensionCount: 3 }
            )
        ).toBe("dropdown")
    })
})
