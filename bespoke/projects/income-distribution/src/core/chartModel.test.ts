import { describe, expect, it } from "vitest"

import {
    COUNTRY_COLOR_ROTATION,
    REGION_COLORS,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "./constants.js"
import { assignCountryColors, buildChartModel } from "./chartModel.js"
import { estimateLogDensity } from "./density.js"
import { YEAR } from "./testFixtures.js"

describe(buildChartModel, () => {
    const globalModel = (breakdown: "regions" | "countries") =>
        buildChartModel({
            year: YEAR,
            view: "global",
            breakdown,
            selectedCountries: [],
        })

    it("stacks one area per country, coloured by region", () => {
        const model = globalModel("countries")
        expect(model.series.map((s) => [s.key, s.color, s.isCountry])).toEqual([
            ["Poorland", REGION_COLORS["Sub-Saharan Africa"], true],
            ["Richland", REGION_COLORS["Sub-Saharan Africa"], true],
            ["Middleland", REGION_COLORS["South Asia"], true],
        ])
        expect(model.series[1].y0).toEqual(model.series[0].y1)
    })

    it("stacks one area per region in the regions breakdown", () => {
        const model = globalModel("regions")
        expect(model.series.map((s) => [s.key, s.isCountry])).toEqual([
            ["Sub-Saharan Africa", false],
            ["South Asia", false],
        ])
    })

    it("places region bands identically whichever the breakdown", () => {
        const byCountry = globalModel("countries").regionBands
        const byRegion = globalModel("regions").regionBands
        expect(byCountry.map((b) => b.region)).toEqual([
            "Sub-Saharan Africa",
            "South Asia",
        ])
        expect(byRegion).toEqual(byCountry)
    })

    it("lists the regions present in the legend in REGIONS order", () => {
        expect(globalModel("regions").legend).toEqual([
            {
                key: "South Asia",
                color: REGION_COLORS["South Asia"],
            },
            {
                key: "Sub-Saharan Africa",
                color: REGION_COLORS["Sub-Saharan Africa"],
            },
        ])
    })

    it("scales yMax to the top of the stack", () => {
        const model = globalModel("countries")
        expect(model.yMax).toBe(Math.max(...model.series[2].y1))
    })

    describe("the countries view", () => {
        const model = buildChartModel({
            year: YEAR,
            view: "countries",
            breakdown: "regions",
            selectedCountries: ["Richland", "Atlantis", "Middleland"],
        })

        it("draws known selected countries alphabetically, unstacked and per capita", () => {
            expect(model.series.map((s) => s.key)).toEqual([
                "Middleland",
                "Richland",
            ])
            const richland = model.series[1]
            expect(richland.y0.every((y) => y === 0)).toBe(true)
            expect(richland.y1).toEqual(
                estimateLogDensity(YEAR.byName.get("Richland")!.avgs)
            )
        })

        it("lists the selection alphabetically, coloured in selection order, without region bands", () => {
            expect(model.legend).toEqual([
                { key: "Middleland", color: COUNTRY_COLOR_ROTATION[1] },
                { key: "Richland", color: COUNTRY_COLOR_ROTATION[0] },
            ])
            expect(model.regionBands).toEqual([])
        })

        it("has a yMax of 0 with nothing selected", () => {
            expect(
                buildChartModel({
                    year: YEAR,
                    view: "countries",
                    breakdown: "regions",
                    selectedCountries: [],
                }).yMax
            ).toBe(0)
        })
    })
})

describe(assignCountryColors, () => {
    it("rotates colours in selection order, so adding a country keeps the others' colours", () => {
        const colors = assignCountryColors(["Zambia", "Austria", "Chile"])
        expect(colors.get("Zambia")).toBe(COUNTRY_COLOR_ROTATION[0])
        expect(colors.get("Austria")).toBe(COUNTRY_COLOR_ROTATION[1])
        expect(colors.get("Chile")).toBe(COUNTRY_COLOR_ROTATION[2])
        const more = assignCountryColors([
            "Zambia",
            "Austria",
            "Chile",
            "Benin",
        ])
        expect(more.get("Chile")).toBe(COUNTRY_COLOR_ROTATION[2])
        expect(more.get("Benin")).toBe(COUNTRY_COLOR_ROTATION[3])
    })

    it("wraps around the rotation for long selections", () => {
        const names = COUNTRY_COLOR_ROTATION.map((_, i) => `Country ${i}`)
        const colors = assignCountryColors([...names, "Country Z"])
        expect(colors.get("Country Z")).toBe(COUNTRY_COLOR_ROTATION[0])
    })

    it("gives the world its own colour", () => {
        expect(
            assignCountryColors(["Chile", WORLD_ENTITY_NAME]).get(
                WORLD_ENTITY_NAME
            )
        ).toBe(WORLD_COLOR)
    })
})
