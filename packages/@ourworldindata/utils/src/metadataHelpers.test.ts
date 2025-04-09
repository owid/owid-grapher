import { describe, expect, it } from "vitest"

import { formatAuthors, formatAuthorsForBibtex } from "./metadataHelpers.js"

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
