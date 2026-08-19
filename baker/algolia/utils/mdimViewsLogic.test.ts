import { describe, it, expect } from "vitest"
import { v7 as uuidv7 } from "uuid"
import {
    dimensionsToViewId,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"
import { MultiDimDataPageConfigEnriched } from "@ourworldindata/types"
import { attributeLinksToViewIds } from "./mdimViewsLogic.js"

// Two dimensions, two choices each. Default view (first choice in each
// dimension) is {view: "stunting", interval: "yearly"}.
const TEST_CONFIG: MultiDimDataPageConfigEnriched = {
    title: { title: "Test" },
    dimensions: [
        {
            slug: "view",
            name: "View",
            choices: [
                { slug: "stunting", name: "Stunting" },
                { slug: "poverty", name: "Poverty" },
            ],
        },
        {
            slug: "interval",
            name: "Time interval",
            choices: [
                { slug: "yearly", name: "Yearly" },
                { slug: "weekly", name: "Weekly" },
            ],
        },
    ],
    views: [
        {
            dimensions: { view: "stunting", interval: "yearly" },
            indicators: { y: [{ id: 1 }] },
            fullConfigId: uuidv7(),
        },
        {
            dimensions: { view: "poverty", interval: "yearly" },
            indicators: { y: [{ id: 2 }] },
            fullConfigId: uuidv7(),
        },
        {
            dimensions: { view: "stunting", interval: "weekly" },
            indicators: { y: [{ id: 3 }] },
            fullConfigId: uuidv7(),
        },
    ],
}

const mdimConfig = MultiDimDataPageConfig.fromObject(TEST_CONFIG)

const defaultViewId = dimensionsToViewId({
    view: "stunting",
    interval: "yearly",
})
const povertyViewId = dimensionsToViewId({
    view: "poverty",
    interval: "yearly",
})
const stuntingWeeklyViewId = dimensionsToViewId({
    view: "stunting",
    interval: "weekly",
})

describe(attributeLinksToViewIds, () => {
    it("returns an empty map for no links", () => {
        const result = attributeLinksToViewIds([], mdimConfig)
        expect(result.size).toBe(0)
    })

    it("attributes links with no query string to the default view", () => {
        const result = attributeLinksToViewIds(
            [{ queryString: null }, { queryString: "" }],
            mdimConfig
        )
        expect(result.get(defaultViewId)).toBe(2)
        expect(result.size).toBe(1)
    })

    it("attributes links whose query string matches a non-default view", () => {
        const result = attributeLinksToViewIds(
            [{ queryString: "view=poverty&interval=yearly" }],
            mdimConfig
        )
        expect(result.get(povertyViewId)).toBe(1)
    })

    it("fills in missing dimensions from the default view", () => {
        // Only `interval` specified — `view` falls back to the default
        // ("stunting"), so this resolves to the stunting+weekly view.
        const result = attributeLinksToViewIds(
            [{ queryString: "interval=weekly" }],
            mdimConfig
        )
        expect(result.get(stuntingWeeklyViewId)).toBe(1)
    })

    it("ignores unrecognized query params and resolves to default view", () => {
        const result = attributeLinksToViewIds(
            [{ queryString: "country=USA&tab=chart" }],
            mdimConfig
        )
        expect(result.get(defaultViewId)).toBe(1)
    })

    it("accumulates counts across multiple links to the same view", () => {
        const result = attributeLinksToViewIds(
            [
                { queryString: "view=poverty&interval=yearly" },
                { queryString: "view=poverty&interval=yearly" },
                { queryString: null },
            ],
            mdimConfig
        )
        expect(result.get(povertyViewId)).toBe(2)
        expect(result.get(defaultViewId)).toBe(1)
    })
})
