import { describe, expect, it } from "vitest"

import { parseConfig } from "./config.js"

describe(parseConfig, () => {
    it("reads a fully specified ArchieML block", () => {
        expect(
            parseConfig({
                hideControls: "true",
                title: "Custom title",
                subtitle: "Custom subtitle",
                view: "countries",
                breakdown: "regions",
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
            breakdown: "regions",
            countries: ["China", "United States", "userLocation"],
            year: 2020,
            povertyLine: 6.85,
            timeInterval: "monthly",
            currency: "DEU",
        })
    })

    it("leaves everything unset for an empty block, so the defaults apply", () => {
        expect(parseConfig({})).toEqual({
            hideControls: false,
            title: undefined,
            subtitle: undefined,
            view: undefined,
            breakdown: undefined,
            countries: undefined,
            year: undefined,
            povertyLine: undefined,
            timeInterval: undefined,
            currency: undefined,
        })
    })

    it("ignores values outside the allowed options", () => {
        const config = parseConfig({
            view: "map",
            breakdown: "continents",
            timeInterval: "weekly",
        })
        expect(config.view).toBeUndefined()
        expect(config.breakdown).toBeUndefined()
        expect(config.timeInterval).toBeUndefined()
    })

    it("drops blank entries from the country list, and an all-blank list", () => {
        expect(
            parseConfig({ countries: " China,, ,India " }).countries
        ).toEqual(["China", "India"])
        expect(parseConfig({ countries: " , " }).countries).toBeUndefined()
    })

    it.each(["0", "-2", "abc", ""])(
        "has no custom poverty line for %j",
        (povertyLine) => {
            expect(parseConfig({ povertyLine }).povertyLine).toBeUndefined()
        }
    )

    it.each(["0", "", "abc"])(
        "falls back to the default year for %j",
        (year) => {
            expect(parseConfig({ year }).year).toBeUndefined()
        }
    )

    it("treats a blank currency as unset", () => {
        expect(parseConfig({ currency: "   " }).currency).toBeUndefined()
    })
})
