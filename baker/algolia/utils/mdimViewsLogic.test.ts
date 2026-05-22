import { describe, it, expect } from "vitest"
import { v7 as uuidv7 } from "uuid"
import {
    dimensionsToViewId,
    MultiDimDataPageConfig,
} from "@ourworldindata/utils"
import { MultiDimDataPageConfigEnriched } from "@ourworldindata/types"
import { MultiDimRedirectWithLookupKey } from "./context.js"
import {
    attributeLinksToViewIds,
    bucketPredecessorsByQueryStr,
} from "./mdimViewsLogic.js"

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
const DEFAULT_VIEW_ID = dimensionsToViewId({
    view: "stunting",
    interval: "yearly",
})
const POVERTY_VIEW_ID = dimensionsToViewId({
    view: "poverty",
    interval: "yearly",
})
const STUNTING_WEEKLY_VIEW_ID = dimensionsToViewId({
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
        expect(result.get(DEFAULT_VIEW_ID)).toBe(2)
        expect(result.size).toBe(1)
    })

    it("attributes links whose query string matches a non-default view", () => {
        const result = attributeLinksToViewIds(
            [{ queryString: "view=poverty&interval=yearly" }],
            mdimConfig
        )
        expect(result.get(POVERTY_VIEW_ID)).toBe(1)
    })

    it("fills in missing dimensions from the default view", () => {
        // Only `interval` specified — `view` falls back to the default
        // ("stunting"), so this resolves to the stunting+weekly view.
        const result = attributeLinksToViewIds(
            [{ queryString: "interval=weekly" }],
            mdimConfig
        )
        expect(result.get(STUNTING_WEEKLY_VIEW_ID)).toBe(1)
    })

    it("ignores unrecognized query params and resolves to default view", () => {
        const result = attributeLinksToViewIds(
            [{ queryString: "country=USA&tab=chart" }],
            mdimConfig
        )
        expect(result.get(DEFAULT_VIEW_ID)).toBe(1)
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
        expect(result.get(POVERTY_VIEW_ID)).toBe(2)
        expect(result.get(DEFAULT_VIEW_ID)).toBe(1)
    })
})

const makeRedirect = (
    overrides: Partial<MultiDimRedirectWithLookupKey> = {}
): MultiDimRedirectWithLookupKey => ({
    sourcePrefix: "/grapher/",
    sourceSlug: "old-chart",
    targetSlug: "new-mdim",
    targetQueryStr: undefined,
    lookupKey: "old-chart",
    ...overrides,
})

describe(bucketPredecessorsByQueryStr, () => {
    it("returns an empty map for no redirects", () => {
        const result = bucketPredecessorsByQueryStr([], "view=stunting")
        expect(result.size).toBe(0)
    })

    it("buckets a redirect with targetQueryStr under that queryStr", () => {
        const redirect = makeRedirect({ targetQueryStr: "view=poverty" })
        const result = bucketPredecessorsByQueryStr([redirect], "view=stunting")
        expect(result.get("view=poverty")).toEqual([redirect])
        expect(result.has("view=stunting")).toBe(false)
    })

    it("buckets a redirect without targetQueryStr under the default queryStr", () => {
        const redirect = makeRedirect({ targetQueryStr: undefined })
        const result = bucketPredecessorsByQueryStr([redirect], "view=stunting")
        expect(result.get("view=stunting")).toEqual([redirect])
    })

    it("groups multiple redirects targeting the same view", () => {
        const a = makeRedirect({
            sourceSlug: "a",
            lookupKey: "a",
            targetQueryStr: "view=poverty",
        })
        const b = makeRedirect({
            sourceSlug: "b",
            lookupKey: "b",
            targetQueryStr: "view=poverty",
        })
        const result = bucketPredecessorsByQueryStr([a, b], "view=stunting")
        expect(result.get("view=poverty")).toEqual([a, b])
    })

    it("keeps redirects targeting different views in separate buckets", () => {
        const a = makeRedirect({
            sourceSlug: "a",
            lookupKey: "a",
            targetQueryStr: undefined, // default view
        })
        const b = makeRedirect({
            sourceSlug: "b",
            lookupKey: "b",
            targetQueryStr: "view=poverty",
        })
        const result = bucketPredecessorsByQueryStr([a, b], "view=stunting")
        expect(result.get("view=stunting")).toEqual([a])
        expect(result.get("view=poverty")).toEqual([b])
    })
})
