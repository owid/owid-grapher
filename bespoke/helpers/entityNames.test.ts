import { describe, expect, it } from "vitest"

import {
    formatEntityNameForSentence,
    pickAvailableEntityName,
} from "./entityNames.js"

describe(formatEntityNameForSentence, () => {
    it.each([
        ["World", "the world"],
        ["France", "France"],
        ["United States", "the United States"],
        ["Channel Islands", "the Channel Islands"],
        ["High-income countries", "high-income countries"],
        ["Africa (UN)", "Africa (UN)"],
        ["Americas (WHO)", "Americas (WHO)"],
    ])("%s reads as %s", (name, expected) => {
        expect(formatEntityNameForSentence(name)).toEqual(expected)
    })

    it.each([
        ["Africa (UN)", "Africa"],
        [
            "Latin America and the Caribbean (UN)",
            "Latin America and the Caribbean",
        ],
    ])("%s reads as %s when stripping (UN)", (name, expected) => {
        expect(formatEntityNameForSentence(name, ["UN"])).toEqual(expected)
    })
})

describe(pickAvailableEntityName, () => {
    const hasEntity = (name: string): boolean =>
        ["France", "World"].includes(name)

    it.each([
        ["France", ["World"], "France"],
        ["Fance", ["World"], "World"],
        ["Fance", ["userLocation", "World"], "World"],
        ["Fance", ["Germany", "United States"], "United States"],
    ])("%s with fallbacks %j picks %s", (name, fallbacks, expected) => {
        expect(pickAvailableEntityName(name, fallbacks, hasEntity)).toEqual(
            expected
        )
    })
})
