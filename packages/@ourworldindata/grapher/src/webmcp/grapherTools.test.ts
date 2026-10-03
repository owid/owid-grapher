import { expect, it, describe } from "vitest"
import { matchEntities } from "./grapherTools.js"

const AVAILABLE = [
    "Czechia",
    "Slovakia",
    "Poland",
    "Germany",
    "European Union (27)",
    "High-income countries",
]

describe(matchEntities, () => {
    it("resolves exact names", () => {
        const { resolved, unresolved } = matchEntities(
            ["Czechia", "Slovakia"],
            AVAILABLE
        )
        expect(resolved).toEqual(["Czechia", "Slovakia"])
        expect(unresolved).toHaveLength(0)
    })

    it("resolves case-insensitively but returns the canonical name", () => {
        const { resolved } = matchEntities(["czechia", "POLAND"], AVAILABLE)
        expect(resolved).toEqual(["Czechia", "Poland"])
    })

    it("never guesses: an unknown name resolves to nothing", () => {
        // "Czech Republic" is the kind of name an agent will confidently
        // produce. Silently mapping it would make the failure invisible when
        // the guess is wrong, so we surface candidates instead.
        const { resolved, unresolved } = matchEntities(
            ["Czech Republic"],
            AVAILABLE
        )
        expect(resolved).toEqual([])
        expect(unresolved).toHaveLength(1)
        expect(unresolved[0].requested).toBe("Czech Republic")
    })

    it("offers substring candidates so the model can pick", () => {
        const { unresolved } = matchEntities(["European Union"], AVAILABLE)
        expect(unresolved[0].candidates).toContain("European Union (27)")
    })

    it("reports no candidates when nothing is close", () => {
        const { unresolved } = matchEntities(["Atlantis"], AVAILABLE)
        expect(unresolved[0].candidates).toEqual([])
    })

    it("partially resolves, reporting only what failed", () => {
        const { resolved, unresolved } = matchEntities(
            ["Czechia", "Narnia"],
            AVAILABLE
        )
        expect(resolved).toEqual(["Czechia"])
        expect(unresolved.map((u) => u.requested)).toEqual(["Narnia"])
    })
})
