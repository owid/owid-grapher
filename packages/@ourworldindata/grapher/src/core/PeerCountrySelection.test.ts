import { expect, it, describe } from "vitest"
import {
    findClosestByValue,
    selectParentRegionsAsPeers,
} from "./PeerCountrySelection.js"

describe(findClosestByValue, () => {
    it("finds entities with values closest to target using logarithmic distance", () => {
        // GDP per capita-like values
        const values = new Map([
            ["Germany", 48_000],
            ["United Kingdom", 46_000],
            ["France", 42_000],
            ["Italy", 35_000],
            ["Spain", 30_000],
            ["Poland", 18_000],
        ])

        const result = findClosestByValue({ target: "United Kingdom", values })

        expect(result).toEqual(["Germany", "France", "Italy"])
    })

    it("returns no peers when target is isolated beyond maxPeerRatio", () => {
        const values = new Map([
            ["Vatican", 500],
            ["Poland", 38_000_000],
            ["Germany", 84_000_000],
        ])

        const result = findClosestByValue({ target: "Vatican", values })

        expect(result).toEqual([])
    })

    it("prefers proportionally closer peers over absolutely closer ones", () => {
        const values = new Map([
            ["Large", 200_000_000], // 2x larger, 100M absolute diff, log diff = 0.3
            ["Target", 100_000_000],
            ["Small", 30_000_000], // 3.3x smaller, 70M absolute diff, log diff = 0.52
        ])

        const result = findClosestByValue({
            target: "Target",
            values,
            targetCount: 1,
            maxPeerRatio: 5,
        })

        // Log distance: Large (2x) is closer than Small (3.3x)
        expect(result).toEqual(["Large"])
    })

    it("falls back to global search when no same-continent peers exist", () => {
        // Australia has high GDP in Oceania, other Oceania countries are too far
        const values = new Map([
            ["Australia", 50_000],
            ["New Zealand", 35_000], // 1.43x smaller - outside 1.25x threshold
            ["Papua New Guinea", 3_000], // 16.7x smaller - way outside threshold
            ["Germany", 48_000],
            ["France", 42_000],
        ])

        const result = findClosestByValue({
            target: "Australia",
            values,
            maxPeerRatio: 1.25,
        })

        // Australia has no Oceania peers within threshold, falls back to global
        expect(result).toEqual(["Germany", "France"])
    })
})

describe(selectParentRegionsAsPeers, () => {
    it("returns World and parent regions for a country", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "Germany",
            availableEntities: [
                "Germany",
                "World",
                "Europe",
                "High-income countries",
                "Asia",
            ],
        })

        // Germany should have World, Europe (continent), and High-income countries (income group)
        expect(result).toContain("World")
        expect(result).toContain("Europe")
        expect(result).toContain("High-income countries")
        expect(result).not.toContain("Asia")
        expect(result).not.toContain("Germany")
    })

    it("only returns entities that are available", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "France",
            availableEntities: ["France", "World", "Africa"], // Missing Europe
        })

        // Should only return World since Europe is not available
        expect(result).toEqual(["World"])
    })

    it("returns empty array for non-existent entity", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "NonExistentCountry",
            availableEntities: ["World", "Europe"],
        })

        expect(result).toEqual([])
    })

    it("includes World even when no parent regions are available", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "Brazil",
            availableEntities: ["Brazil", "World"], // No South America or other parent regions
        })

        expect(result).toEqual(["World"])
    })

    it("returns empty array when World is not available", () => {
        const result = selectParentRegionsAsPeers({
            targetCountry: "Germany",
            availableEntities: ["Germany", "Asia"], // No World or relevant parent regions
        })

        // Should return empty since neither World nor parent regions are available
        expect(result).toEqual([])
    })
})
