import { describe, expect, it } from "vitest"

import { MAX_SELECTED_COUNTRIES, USER_LOCATION_SENTINEL } from "./constants.js"
import { parseIncomeDistributionYear } from "./data.js"
import { resolveSelectedCountries } from "./resolveSelectedCountries.js"
import { syntheticAvgs, YEAR, YEAR_WITH_MODELLED } from "./testFixtures.js"

describe(resolveSelectedCountries, () => {
    it("keeps known countries in order and drops the rest", () => {
        expect(
            resolveSelectedCountries(
                ["Richland", "Atlantis", "Poorland"],
                undefined,
                YEAR
            )
        ).toEqual(["Richland", "Poorland"])
    })

    it("drops a country the data only models, even the reader's own", () => {
        expect(
            resolveSelectedCountries(
                ["Modelland", "Richland", USER_LOCATION_SENTINEL],
                "Modelland",
                YEAR_WITH_MODELLED
            )
        ).toEqual(["Richland"])
    })

    it("puts the reader's country in for the sentinel, or nothing while it's unknown", () => {
        expect(
            resolveSelectedCountries(
                ["Richland", USER_LOCATION_SENTINEL],
                "Middleland",
                YEAR
            )
        ).toEqual(["Richland", "Middleland"])
        expect(
            resolveSelectedCountries(
                ["Richland", USER_LOCATION_SENTINEL],
                undefined,
                YEAR
            )
        ).toEqual(["Richland"])
    })

    it("collapses a country picked twice, as when the sentinel resolves to one already there", () => {
        expect(
            resolveSelectedCountries(
                ["Poorland", USER_LOCATION_SENTINEL, "Poorland"],
                "Poorland",
                YEAR
            )
        ).toEqual(["Poorland"])
    })

    it("takes the first MAX_SELECTED_COUNTRIES", () => {
        const names = Array.from(
            { length: MAX_SELECTED_COUNTRIES + 2 },
            (_, i) => `Country ${i}`
        )
        const year = parseIncomeDistributionYear({
            year: 2025,
            data: Object.fromEntries(
                names.map((name) => [
                    name,
                    {
                        country: name,
                        region: "South Asia",
                        totalPopulation: 10,
                        welfareType: "income",
                        estimationType: "survey",
                        avgs: syntheticAvgs(5),
                    },
                ])
            ),
        })
        expect(resolveSelectedCountries(names, undefined, year)).toEqual(
            names.slice(0, MAX_SELECTED_COUNTRIES)
        )
    })
})
