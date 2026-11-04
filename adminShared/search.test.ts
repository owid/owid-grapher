import { describe, expect, it } from "vitest"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
} from "./search.js"

const titles = [
    "Measles cases",
    "Measles vaccination",
    "Global health spending",
    "Health and measles",
]

function search(query: string): string[] {
    return titles.filter(
        filterFunctionForSearchWords(
            buildSearchWordsFromSearchString(query),
            (title: string) => [title]
        )
    )
}

describe("the admin list search", () => {
    it("needs every word to match, in any order", () => {
        expect(search("measles health")).toEqual(["Health and measles"])
    })

    it("keeps a quoted phrase together", () => {
        expect(search('"health spending"')).toEqual(["Global health spending"])
        expect(search('" health spending "')).toEqual([
            "Global health spending",
        ])
    })

    it("drops rows matching an excluded word or phrase", () => {
        expect(search("measles -cases")).toEqual([
            "Measles vaccination",
            "Health and measles",
        ])
        expect(search('-"measles cases"')).toHaveLength(3)
    })

    it("treats a lone minus as an exclusion still being typed", () => {
        expect(search("measles -")).toHaveLength(3)
    })
})
