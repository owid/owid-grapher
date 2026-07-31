import { expect, it, describe } from "vitest"
import {
    countMatchableQueryTokens,
    areTypesenseHitsClosestMatches,
} from "./typesenseClosestMatches.js"

const hit = (tokensMatched: number) => ({
    text_match_info: { tokens_matched: tokensMatched },
})

/** A semantic-only (vector) hit: no text_match_info at all. */
const vectorHit = () => ({})

describe(countMatchableQueryTokens, () => {
    it("counts plain tokens", () => {
        expect(countMatchableQueryTokens("child mortality")).toBe(2)
    })

    it("ignores english stopwords, matching the server-side stopword set", () => {
        expect(countMatchableQueryTokens("the population of France")).toBe(2)
    })

    it("strips quotes around exact phrases", () => {
        expect(countMatchableQueryTokens('malaria "United States"')).toBe(3)
    })

    it("counts stopwords when the query is nothing but stopwords", () => {
        // Typesense keeps all tokens in this case rather than matching nothing
        expect(countMatchableQueryTokens("the who")).toBe(2)
    })

    it("is case-insensitive", () => {
        expect(countMatchableQueryTokens("The Population OF France")).toBe(2)
    })
})

describe(areTypesenseHitsClosestMatches, () => {
    it("is false when some hit matched every token", () => {
        expect(
            areTypesenseHitsClosestMatches("child mortality", [
                hit(2),
                hit(1),
                vectorHit(),
            ])
        ).toBe(false)
    })

    it("is true when even the best hit matched only some tokens", () => {
        expect(
            areTypesenseHitsClosestMatches("malaria worldwide", [
                hit(1),
                hit(1),
                vectorHit(),
            ])
        ).toBe(true)
    })

    it("is true when all hits are semantic-only (vector) matches", () => {
        expect(
            areTypesenseHitsClosestMatches("life quality index", [
                vectorHit(),
                vectorHit(),
            ])
        ).toBe(true)
    })

    it("ignores stopwords when comparing against tokens_matched", () => {
        // "the" and "of" are never matched by Typesense (server-side
        // stopwords), so 2 matched tokens is a full match here
        expect(
            areTypesenseHitsClosestMatches("the population of France", [
                hit(2),
            ])
        ).toBe(false)
    })

    it("is false for empty results", () => {
        expect(areTypesenseHitsClosestMatches("child mortality", [])).toBe(
            false
        )
    })

    it("is false for wildcard and empty queries", () => {
        expect(areTypesenseHitsClosestMatches("*", [vectorHit()])).toBe(false)
        expect(areTypesenseHitsClosestMatches("", [vectorHit()])).toBe(false)
        expect(areTypesenseHitsClosestMatches("   ", [vectorHit()])).toBe(false)
    })
})
