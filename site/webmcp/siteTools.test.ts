import { expect, it, describe } from "vitest"
import { rankHitsByEntityCoverage } from "./siteTools.js"

// Shaped after the real /api/search response for "infant mortality", where the
// actual infant-mortality chart ranks third behind two child/youth mortality
// charts. Entity coverage is what lets an agent tell them apart.
const HITS = [
    {
        title: "Child mortality rate",
        slug: "child-mortality",
        type: "chart",
        availableEntities: ["Czechia", "Slovakia", "Poland"],
    },
    {
        title: "Global child mortality",
        slug: "global-child-mortality-timeseries",
        type: "chart",
        availableEntities: ["World"],
    },
    {
        title: "Infant mortality rate",
        slug: "infant-mortality",
        type: "chart",
        availableEntities: ["Czechia", "Slovakia"],
    },
]

describe(rankHitsByEntityCoverage, () => {
    it("demotes charts missing a requested entity", () => {
        const ranked = rankHitsByEntityCoverage(HITS, ["Czechia", "Slovakia"])
        expect(ranked.map((r) => r.hit.slug)).toEqual([
            "child-mortality",
            "infant-mortality",
            "global-child-mortality-timeseries",
        ])
        expect(ranked[2].missing).toEqual(["Czechia", "Slovakia"])
    })

    it("preserves OWID's search order within the covered group", () => {
        // Relevance ranking stays OWID's to own — this only separates charts
        // that can answer the question from ones that cannot.
        const ranked = rankHitsByEntityCoverage(HITS, ["Czechia"])
        expect(ranked.slice(0, 2).map((r) => r.hit.slug)).toEqual([
            "child-mortality",
            "infant-mortality",
        ])
    })

    it("leaves order untouched when no entities are requested", () => {
        const ranked = rankHitsByEntityCoverage(HITS, [])
        expect(ranked.map((r) => r.hit.slug)).toEqual(HITS.map((h) => h.slug))
        expect(ranked.every((r) => r.missing.length === 0)).toBe(true)
    })

    it("matches entity names case-insensitively", () => {
        const ranked = rankHitsByEntityCoverage(HITS, ["czechia"])
        expect(ranked[0].missing).toEqual([])
    })

    it("treats a hit with no availableEntities as missing everything", () => {
        const ranked = rankHitsByEntityCoverage(
            [{ title: "x", slug: "x", type: "chart" }],
            ["Czechia"]
        )
        expect(ranked[0].missing).toEqual(["Czechia"])
    })
})
