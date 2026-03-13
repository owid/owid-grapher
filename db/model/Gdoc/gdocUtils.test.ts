import { describe, expect, it } from "vitest"
import { parseAuthors } from "./gdocUtils.js"

describe(parseAuthors, () => {
    it("defaults to 'Our World in Data team' when no authors given", () => {
        expect(parseAuthors()).toEqual({
            authors: ["Our World in Data team"],
            authorRoles: {},
        })
    })

    it("parses comma-separated authors", () => {
        expect(parseAuthors("Hannah Ritchie, Max Roser")).toEqual({
            authors: ["Hannah Ritchie", "Max Roser"],
            authorRoles: {},
        })
    })

    it("strips roles from author names and stores them separately", () => {
        expect(
            parseAuthors("Hannah Ritchie (writing), Max Roser (data work)")
        ).toEqual({
            authors: ["Hannah Ritchie", "Max Roser"],
            authorRoles: {
                "Hannah Ritchie": "writing",
                "Max Roser": "data work",
            },
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

    it("handles extra whitespace", () => {
        expect(parseAuthors("  Hannah Ritchie  ( data work )  ")).toEqual({
            authors: ["Hannah Ritchie"],
            authorRoles: {
                "Hannah Ritchie": "data work",
            },
        })
    })
})
