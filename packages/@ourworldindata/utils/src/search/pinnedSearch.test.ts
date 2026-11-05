import { describe, expect, it } from "vitest"
import { normalizePinnedSearch, parsePinnedSearches } from "./pinnedSearch.js"

describe(normalizePinnedSearch, () => {
    it.each([
        ["Population Pyramid", "population pyramid"],
        ["cause-of-death", "cause of death"],
        ["  world   population\t", "world population"],
        ['"migration"?', "migration"],
        ["Émigration", "émigration"],
        ["?!", ""],
    ])("normalizes %j to %j", (search, expected) => {
        expect(normalizePinnedSearch(search)).toBe(expected)
    })
})

describe(parsePinnedSearches, () => {
    it.each([
        ["population, World Population", ["population", "world population"]],
        ["population,,  , ?!", ["population"]],
        ["Population, population., POPULATION", ["population"]],
        ["food, trade, food", ["food", "trade"]],
        ["", []],
    ])("parses %j to %j", (value, expected) => {
        expect(parsePinnedSearches(value)).toEqual(expected)
    })
})
