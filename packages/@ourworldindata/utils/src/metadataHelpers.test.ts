import { describe, expect, it } from "vitest"

import {
    formatAuthors,
    formatAuthorsForBibtex,
    parseAuthorRole,
} from "./metadataHelpers.js"

describe(formatAuthors, () => {
    it("formats zero authors", () => {
        expect(formatAuthors([])).toEqual("")
    })

    it("formats one author", () => {
        expect(formatAuthors(["Author 1"])).toEqual("Author 1")
    })

    it("formats two authors", () => {
        expect(formatAuthors(["Author 1", "Author 2"])).toEqual(
            "Author 1 and Author 2"
        )
    })

    it("formats three authors", () => {
        const authors = ["Author 1", "Author 2", "Author 3"]
        expect(formatAuthors(authors)).toEqual(
            "Author 1, Author 2, and Author 3"
        )
    })
})

describe(parseAuthorRole, () => {
    it("returns name only when no role", () => {
        expect(parseAuthorRole("Hannah Ritchie")).toEqual({
            name: "Hannah Ritchie",
        })
    })

    it("parses name and role", () => {
        expect(parseAuthorRole("Hannah Ritchie (writing)")).toEqual({
            name: "Hannah Ritchie",
            role: "writing",
        })
    })

    it("handles extra whitespace", () => {
        expect(parseAuthorRole("  Hannah Ritchie  ( data work )  ")).toEqual({
            name: "Hannah Ritchie",
            role: "data work",
        })
    })

    it("handles name with no parentheses", () => {
        expect(parseAuthorRole("Our World in Data team")).toEqual({
            name: "Our World in Data team",
        })
    })
})

describe(formatAuthorsForBibtex, () => {
    it("formats zero authors for bibtex", () => {
        expect(formatAuthorsForBibtex([])).toEqual("")
    })

    it("formats one author for bibtex", () => {
        expect(formatAuthorsForBibtex(["Author 1"])).toEqual("Author 1")
    })

    it("formats two authors for bibtex", () => {
        expect(formatAuthorsForBibtex(["Author 1", "Author 2"])).toEqual(
            "Author 1 and Author 2"
        )
    })

    it("formats three authors for bibtex", () => {
        expect(
            formatAuthorsForBibtex(["Author 1", "Author 2", "Author 3"])
        ).toEqual("Author 1 and Author 2 and Author 3")
    })
})
