import { describe, expect, it } from "vitest"
import {
    getTopicAreaNameForGdocTags,
    getTopicAreaNameForTagNames,
    topicAreaNamesFromTagHierarchies,
} from "./db.js"

const tag = (name: string): { id: number; name: string; slug: string } => ({
    id: name.length,
    name,
    slug: name,
})

describe(topicAreaNamesFromTagHierarchies, () => {
    it("takes the first path's top-level tag as the area", () => {
        expect(
            topicAreaNamesFromTagHierarchies({
                Energy: [[tag("Energy")]],
                Migration: [
                    [tag("Population"), tag("Migration")],
                    [tag("Poverty"), tag("Migration")],
                ],
                Orphan: [],
            })
        ).toEqual({ Energy: "Energy", Migration: "Population" })
    })
})

describe(getTopicAreaNameForTagNames, () => {
    const areas = { Migration: "Population", Energy: "Energy" }

    it("resolves the first tag that maps to an area", () => {
        expect(
            getTopicAreaNameForTagNames(["Migration", "Energy"], areas)
        ).toBe("Population")
        expect(getTopicAreaNameForTagNames([], areas)).toBe(undefined)
        expect(getTopicAreaNameForTagNames(["Unlisted"], areas)).toBe(undefined)
    })

    it("skips unmapped tags instead of letting them suppress a later area", () => {
        expect(getTopicAreaNameForTagNames(["Unlisted", "Energy"], areas)).toBe(
            "Energy"
        )
    })
})

describe(getTopicAreaNameForGdocTags, () => {
    const gdocTags = (...names: string[]): { name: string }[] =>
        names.map((name) => ({ name }))

    it("resolves an area even when the first tag by name is unmapped", () => {
        // `Announcements` and `Explainers` sort first but map to no area; the
        // topic tag behind them still has to decide the page's area.
        expect(
            getTopicAreaNameForGdocTags(
                gdocTags("Global Health", "Announcements"),
                { "Global Health": "Global Health" }
            )
        ).toBe("Global Health")
        expect(
            getTopicAreaNameForGdocTags(gdocTags("Poverty", "Explainers"), {
                Poverty: "Poverty",
            })
        ).toBe("Poverty")
    })

    it("orders tags deterministically when names differ only by case", () => {
        // A case-insensitive comparison alone reports these as equal and then
        // leaves the winner down to the order the tags were loaded in.
        const areas = { CO2: "Energy", co2: "Climate Change" }
        expect(getTopicAreaNameForGdocTags(gdocTags("CO2", "co2"), areas)).toBe(
            getTopicAreaNameForGdocTags(gdocTags("co2", "CO2"), areas)
        )
    })
})
