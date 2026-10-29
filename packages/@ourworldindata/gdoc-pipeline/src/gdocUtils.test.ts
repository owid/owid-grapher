import { describe, expect, it } from "vitest"
import {
    extractUrl,
    parseAuthors,
    parseContributors,
    parseNamesWithRoles,
} from "./gdocUtils.js"

describe(parseNamesWithRoles, () => {
    it("returns no names for the empty string", () => {
        expect(parseNamesWithRoles("")).toEqual({ names: [], roles: {} })
    })

    it("parses a name with a role", () => {
        expect(parseNamesWithRoles("Max Roser (Editorial feedback)")).toEqual({
            names: ["Max Roser"],
            roles: { "Max Roser": "Editorial feedback" },
        })
    })

    it("parses a name without a role", () => {
        expect(parseNamesWithRoles("Max Roser")).toEqual({
            names: ["Max Roser"],
            roles: {},
        })
    })

    it("parses a mix of names with and without roles", () => {
        expect(
            parseNamesWithRoles(
                "Max Roser (Editorial feedback), Hannah Ritchie"
            )
        ).toEqual({
            names: ["Max Roser", "Hannah Ritchie"],
            roles: { "Max Roser": "Editorial feedback" },
        })
    })

    it("handles extra whitespace", () => {
        expect(parseNamesWithRoles("  Max Roser  ( data work )  ")).toEqual({
            names: ["Max Roser"],
            roles: { "Max Roser": "data work" },
        })
    })
})

describe(parseAuthors, () => {
    it("defaults to 'Our World in Data team' when no authors given", () => {
        expect(parseAuthors()).toEqual({
            authors: ["Our World in Data team"],
            authorRoles: {},
        })
    })

    it("handles a mix of authors with and without roles", () => {
        expect(parseAuthors("Hannah Ritchie (writing), Max Roser")).toEqual({
            authors: ["Hannah Ritchie", "Max Roser"],
            authorRoles: {
                "Hannah Ritchie": "writing",
            },
        })
    })
})

describe(parseContributors, () => {
    it("parses contributors with and without roles", () => {
        expect(
            parseContributors("Max Roser (Editorial feedback), Marwa Boukarim")
        ).toEqual({
            contributors: ["Max Roser", "Marwa Boukarim"],
            contributorRoles: { "Max Roser": "Editorial feedback" },
        })
    })

    it("has no default, unlike authors", () => {
        expect(parseContributors("")).toEqual({
            contributors: [],
            contributorRoles: {},
        })
    })
})

describe(extractUrl, () => {
    it("trims whitespace from hrefs extracted out of anchor tags", () => {
        expect(
            extractUrl(
                '<a href="https://ourworldindata.org/grapher/national-poverty-line-vs-gdp-per-capita ">Chart</a>'
            )
        ).toBe(
            "https://ourworldindata.org/grapher/national-poverty-line-vs-gdp-per-capita"
        )
    })
})
