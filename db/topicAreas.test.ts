import { describe, expect, it } from "vitest"
import {
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

    it("resolves the first tag only", () => {
        expect(
            getTopicAreaNameForTagNames(["Migration", "Energy"], areas)
        ).toBe("Population")
        expect(getTopicAreaNameForTagNames(["Unlisted", "Energy"], areas)).toBe(
            undefined
        )
        expect(getTopicAreaNameForTagNames([], areas)).toBe(undefined)
    })
})
