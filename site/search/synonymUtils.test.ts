import { expect, it, describe, beforeEach } from "vitest"
import { buildSynonymMap } from "./synonymUtils.js"

describe("buildSynonymMap", () => {
    let synonymMap: Map<string, string[]>

    beforeEach(() => {
        synonymMap = buildSynonymMap()
    })

    it("should create a map with lowercase keys", () => {
        expect(synonymMap.has("ai")).toBe(true)
        expect(synonymMap.has("AI")).toBe(false)
    })

    it("should create bidirectional mappings for synonym groups", () => {
        const aiSynonyms = synonymMap.get("ai")
        const artificialIntelligenceSynonyms = synonymMap.get(
            "artificial intelligence"
        )

        expect(aiSynonyms).toContain("artificial intelligence")
        expect(artificialIntelligenceSynonyms).toContain("ai")
    })

    it("should not include the term itself in its synonym list", () => {
        const aiSynonyms = synonymMap.get("ai")
        expect(aiSynonyms).not.toContain("ai")
    })

    it("should handle terms that appear in multiple synonym groups", () => {
        // "economic growth" appears in both GDP group and GDP per capita group
        const economicGrowthSynonyms = synonymMap.get("economic growth")

        expect(economicGrowthSynonyms).toContain("gdp")
        expect(economicGrowthSynonyms).toContain("gdp per capita")
    })

    it("should include country alternative mappings", () => {
        // Test unidirectional country mappings
        expect(synonymMap.get("us")).toContain("united states")
        expect(synonymMap.get("uk")).toContain("united kingdom")
    })

    it("should be unidirectional for country alternatives", () => {
        // "us" should map to "united states" but not vice versa
        expect(synonymMap.get("us")).toContain("united states")

        const unitedStatesSynonyms = synonymMap.get("united states")
        expect(unitedStatesSynonyms).toBeUndefined() // No reverse mapping
    })

    it("should handle unicode characters correctly", () => {
        const co2Synonyms = synonymMap.get("co2")
        expect(co2Synonyms).toContain("co₂")
    })
})
