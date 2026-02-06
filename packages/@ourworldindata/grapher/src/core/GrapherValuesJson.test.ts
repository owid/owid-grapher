import { describe, expect, it } from "vitest"
import { OwidTableSlugs } from "@ourworldindata/types"
import { makeDimensionValuesForTimeDirect } from "./GrapherValuesJson"
import { OwidTable } from "@ourworldindata/core-table"

describe(makeDimensionValuesForTimeDirect, () => {
    const makeTestTable = (): OwidTable => {
        return new OwidTable([
            {
                [OwidTableSlugs.entityName]: "France",
                [OwidTableSlugs.time]: 2000,
                gdp: 1000,
                population: 60,
            },
            {
                [OwidTableSlugs.entityName]: "France",
                [OwidTableSlugs.time]: 2010,
                gdp: 1500,
                population: 65,
            },
            {
                [OwidTableSlugs.entityName]: "Germany",
                [OwidTableSlugs.time]: 2000,
                gdp: 2000,
                population: 80,
            },
            {
                [OwidTableSlugs.entityName]: "Germany",
                [OwidTableSlugs.time]: 2010,
                gdp: 2500,
                population: 82,
            },
        ])
    }

    it("returns undefined when time is undefined", () => {
        const table = makeTestTable()
        expect(
            makeDimensionValuesForTimeDirect(
                table,
                ["gdp"],
                undefined,
                "France",
                undefined
            )
        ).toBeUndefined()
    })

    it("extracts y values for a single column", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            undefined,
            "France",
            2000
        )

        expect(result).toBeDefined()
        expect(result?.y).toHaveLength(1)
        expect(result?.y?.[0].columnSlug).toBe("gdp")
        expect(result?.y?.[0].value).toBe(1000)
        expect(result?.y?.[0].time).toBe(2000)
    })

    it("extracts y values for multiple columns", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp", "population"],
            undefined,
            "Germany",
            2010
        )

        expect(result?.y).toHaveLength(2)
        expect(result?.y?.[0].value).toBe(2500)
        expect(result?.y?.[1].value).toBe(82)
    })

    it("extracts x value when x column is specified", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            "population",
            "France",
            2010
        )

        expect(result?.y?.[0].value).toBe(1500)
        expect(result?.x?.columnSlug).toBe("population")
        expect(result?.x?.value).toBe(65)
    })

    it("returns data point with only columnSlug when no data exists for entity/time", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            undefined,
            "France",
            2020 // No data for 2020
        )

        expect(result?.y?.[0].columnSlug).toBe("gdp")
        expect(result?.y?.[0].value).toBeUndefined()
    })

    it("returns data point with only columnSlug for non-existent entity", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            undefined,
            "Spain", // Entity not in table
            2000
        )

        expect(result?.y?.[0].columnSlug).toBe("gdp")
        expect(result?.y?.[0].value).toBeUndefined()
    })
})
