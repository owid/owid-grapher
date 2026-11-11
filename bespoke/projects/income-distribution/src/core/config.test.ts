import { describe, expect, it, vi } from "vitest"

import { parseConfigFromSpec } from "../../../../helpers/config.js"
import { BespokeConfigError } from "../../../../shared/bespokeComponentTypes.js"

import { CONFIG_SPEC, type IncomeDistributionConfig } from "../index.js"

// Reads a global the Vite plugin defines, which vitest doesn't load
vi.mock(import("vite-plugin-css-position/react"), () => ({
    default: vi.fn(),
}))

const parse = (authored: Record<string, string>): IncomeDistributionConfig =>
    parseConfigFromSpec(CONFIG_SPEC, authored)

describe("the authored config", () => {
    it("reads a fully specified ArchieML block", () => {
        expect(
            parse({
                hideControls: "true",
                title: "Custom title",
                subtitle: "Custom subtitle",
                view: "countries",
                countries: "China, United States,userLocation",
                year: "2020",
                povertyLine: "6.85",
                timeInterval: "monthly",
                currency: " DEU ",
            })
        ).toEqual({
            hideControls: true,
            title: "Custom title",
            subtitle: "Custom subtitle",
            view: "countries",
            countries: ["China", "United States", "userLocation"],
            year: 2020,
            povertyLine: 6.85,
            timeInterval: "monthly",
            currency: "DEU",
        })
    })

    it("fills in the defaults for an empty block", () => {
        expect(parse({})).toEqual({
            hideControls: undefined,
            title: undefined,
            subtitle: undefined,
            view: "global",
            countries: undefined,
            year: 2025,
            povertyLine: undefined,
            timeInterval: "daily",
            currency: undefined,
        })
    })

    it("falls back to the default year for a blank value", () => {
        expect(parse({ year: " " }).year).toBe(2025)
    })

    it.each<Record<string, string>>([
        { view: "map" },
        { timeInterval: "weekly" },
        { year: "abc" },
        { povertyLine: "0" },
        { povertyLine: "-2" },
        { povertyLine: "abc" },
    ])("rejects %j", (authored) => {
        expect(() => parse(authored)).toThrow(BespokeConfigError)
    })

    it("drops blank entries from the country list, and an all-blank list", () => {
        expect(parse({ countries: " China,, ,India " }).countries).toEqual([
            "China",
            "India",
        ])
        expect(parse({ countries: " , " }).countries).toBeUndefined()
    })

    it("treats a blank poverty line or currency as unset", () => {
        const config = parse({ povertyLine: "", currency: "   " })
        expect(config.povertyLine).toBeUndefined()
        expect(config.currency).toBeUndefined()
    })
})
