import { describe, expect, it } from "vitest"
import type {
    ComponentProp,
    ComponentReference,
    ComponentVariation,
} from "@ourworldindata/types"
import { OwidGdocType } from "@ourworldindata/types"
import { formDefiningParts, liveUrl } from "./gdocsReferenceLiveHelpers.js"

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
