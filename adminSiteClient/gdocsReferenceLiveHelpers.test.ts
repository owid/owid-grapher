import { describe, expect, it } from "vitest"
import type {
    BespokeVizUsage,
    BundleReference,
    BundleUsage,
    BundleVariantUsage,
    ComponentProp,
    ComponentReference,
    ComponentVariation,
} from "@ourworldindata/types"
import { OwidGdocType } from "@ourworldindata/types"
import {
    bundleUsageLabel,
    formDefiningParts,
    liveUrl,
    orderBundleVariants,
    OrderedBundleVariants,
    sortBundlesByUse,
} from "./gdocsReferenceLiveHelpers.js"

const prop = (name: string, type: string, optional = false): ComponentProp => ({
    name,
    type,
    optional,
})

const component = {
    id: "chart",
    props: [
        prop("url", "string"),
        prop("size", '"narrow" | "wide"', true),
        prop("peerCountries", "string[]", true),
    ],
} as unknown as ComponentReference

const variation = (signature: string): ComponentVariation =>
    ({ signature, count: 1 }) as unknown as ComponentVariation

describe(formDefiningParts, () => {
    it("reads presence and value parts off the signature", () => {
        expect(
            formDefiningParts(component, variation("peerCountries+size:narrow"))
        ).toEqual([
            {
                name: "peerCountries",
                value: undefined,
                prop: component.props[2],
            },
            { name: "size", value: "narrow", prop: component.props[1] },
        ])
    })

    it("keeps an undeclared part, without a prop", () => {
        expect(formDefiningParts(component, variation("legacy:1"))).toEqual([
            { name: "legacy", value: "1", prop: undefined },
        ])
    })

    it("has nothing for the default form", () => {
        expect(formDefiningParts(component, variation(""))).toEqual([])
    })
})

describe(liveUrl, () => {
    it("appends the entity slug for a profile with an entitySlug", () => {
        const url = liveUrl({
            slug: "co2",
            docType: OwidGdocType.Profile,
            entitySlug: "canada",
        })
        expect(url.endsWith("/profile/co2/canada")).toBe(true)
    })

    it("puts the anchor after the entity segment", () => {
        const url = liveUrl({
            slug: "co2",
            docType: OwidGdocType.Profile,
            entitySlug: "canada",
            anchor: "anchor",
        })
        expect(url.endsWith("/profile/co2/canada#anchor")).toBe(true)
    })

    it("leaves other doc types unaffected by entitySlug", () => {
        const url = liveUrl({
            slug: "my-article",
            docType: OwidGdocType.Article,
            entitySlug: "canada",
        })
        expect(url).not.toContain("/canada")
    })
})

const bundle = (id: string): BundleReference =>
    ({ id }) as unknown as BundleReference

const bundleUsage = (
    bundle: string,
    uses: number,
    docs: number
): BundleUsage => ({ bundle, uses, docs, variants: [], configAdoption: {} })

const ids = (bundles: BundleReference[]): string[] =>
    bundles.map((entry) => entry.id)

describe(sortBundlesByUse, () => {
    // Registry order, deliberately not id order
    const bundles = [
        bundle("zoo"),
        bundle("causes-of-death"),
        bundle("alpha"),
        bundle("migration"),
    ]

    it("puts the most used bundles first, then the unused ones by id", () => {
        const usage: BespokeVizUsage = {
            bundles: [
                bundleUsage("migration", 3, 2),
                bundleUsage("causes-of-death", 12, 4),
            ],
        }
        expect(ids(sortBundlesByUse(bundles, usage))).toEqual([
            "causes-of-death",
            "migration",
            "alpha",
            "zoo",
        ])
    })

    it("orders bundles with the same number of uses by id", () => {
        const usage: BespokeVizUsage = {
            bundles: [bundleUsage("zoo", 5, 1), bundleUsage("alpha", 5, 3)],
        }
        expect(ids(sortBundlesByUse(bundles, usage))).toEqual([
            "alpha",
            "zoo",
            "causes-of-death",
            "migration",
        ])
    })

    it("falls back to id order when the usage lookup failed", () => {
        expect(ids(sortBundlesByUse(bundles, null))).toEqual([
            "alpha",
            "causes-of-death",
            "migration",
            "zoo",
        ])
    })
})

describe(bundleUsageLabel, () => {
    it("counts uses and docs", () => {
        expect(bundleUsageLabel(bundleUsage("a", 12, 4))).toBe(
            "12 uses in 4 docs"
        )
    })

    it("uses the singular for one use in one doc", () => {
        expect(bundleUsageLabel(bundleUsage("a", 1, 1))).toBe("1 use in 1 doc")
    })

    it("says a bundle absent from the usage is not used yet", () => {
        expect(bundleUsageLabel(undefined)).toBe("not used yet")
    })
})

// A bundle with the given variants
const bundleWith = (variants: string[]): BundleReference =>
    ({
        id: "b",
        variants: variants.map((name) => ({ name })),
    }) as unknown as BundleReference

const variantUsage = (variant: string, uses: number): BundleVariantUsage => ({
    variant,
    uses,
    docs: 1,
    instances: [],
})

const usageOf = (variants: BundleVariantUsage[]): BundleUsage => ({
    bundle: "b",
    uses: variants.reduce((sum, entry) => sum + entry.uses, 0),
    docs: 1,
    variants,
    configAdoption: {},
})

// Variant names of each group, for compact assertions
const names = (
    ordered: OrderedBundleVariants
): { open: string[]; collapsed: string[] } => ({
    open: ordered.open.map((entry) => entry.variant.name),
    collapsed: ordered.collapsed.map((entry) => entry.variant.name),
})

describe(orderBundleVariants, () => {
    it("opens used variants, most used first with ties in registry order", () => {
        const ordered = orderBundleVariants(
            bundleWith(["a", "b", "c"]),
            usageOf([variantUsage("b", 5), variantUsage("c", 5)])
        )
        expect(names(ordered)).toEqual({ open: ["b", "c"], collapsed: ["a"] })
        expect(ordered.open[0].usage?.uses).toBe(5)
        expect(ordered.collapsed[0].usage).toBeUndefined()
    })

    it("sorts used variants by uses", () => {
        const ordered = orderBundleVariants(
            bundleWith(["a", "b", "c"]),
            usageOf([variantUsage("a", 1), variantUsage("c", 9)])
        )
        expect(names(ordered)).toEqual({ open: ["c", "a"], collapsed: ["b"] })
    })

    it("opens the first variant when the bundle has no use", () => {
        expect(
            names(orderBundleVariants(bundleWith(["a", "b", "c"]), undefined))
        ).toEqual({
            open: ["a"],
            collapsed: ["b", "c"],
        })
    })

    it("has no tail when every variant is used", () => {
        const ordered = orderBundleVariants(
            bundleWith(["a", "b"]),
            usageOf([variantUsage("a", 1), variantUsage("b", 2)])
        )
        expect(names(ordered)).toEqual({ open: ["b", "a"], collapsed: [] })
    })

    it("opens only the first variant, in registry order, when usage failed", () => {
        const ordered = orderBundleVariants(bundleWith(["a", "b", "c"]), null)
        expect(names(ordered)).toEqual({ open: ["a"], collapsed: ["b", "c"] })
    })
})
