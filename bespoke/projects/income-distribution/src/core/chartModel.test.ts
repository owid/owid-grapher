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
    const globalModel = () =>
        buildChartModel({
            year: YEAR,
            view: "global",
            selectedCountries: [],
        })

    it("stacks one area per region, in its colour", () => {
        const model = globalModel()
        expect(model.series.map((s) => [s.key, s.color])).toEqual([
            ["Sub-Saharan Africa", REGION_COLORS["Sub-Saharan Africa"]],
            ["South Asia", REGION_COLORS["South Asia"]],
        ])
        expect(model.series[1].y0).toEqual(model.series[0].y1)
    })

    it("labels each region's band", () => {
        const model = globalModel()
        expect(model.regionBands.map((b) => [b.region, b.y0, b.y1])).toEqual(
            model.series.map((s) => [s.region, s.y0, s.y1])
        )
    })

    it("lists the regions present in the legend in REGIONS order", () => {
        expect(globalModel().legend).toEqual([
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
        const model = globalModel()
        expect(model.yMax).toBe(Math.max(...model.series.at(-1)!.y1))
    })

    describe("the countries view", () => {
        const model = buildChartModel({
            year: YEAR,
            view: "countries",
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
