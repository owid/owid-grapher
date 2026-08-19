import { describe, expect, it } from "vitest"
import {
    DimensionProperty,
    GRAPHER_CHART_TYPES,
    OwidTableSlugs,
} from "@ourworldindata/types"
import {
    constructGrapherValuesJson,
    makeDimensionValuesForTimeDirect,
} from "./GrapherValuesJson"
import {
    OwidTable,
    SynthesizeGDPTable,
    SampleColumnSlugs,
} from "@ourworldindata/core-table"
import { GrapherState } from "./GrapherState"
import { GrapherProgrammaticInterface } from "./Grapher"

describe(makeDimensionValuesForTimeDirect, () => {
    const makeTestTable = (): OwidTable => {
        return new OwidTable([
            {
                [OwidTableSlugs.EntityName]: "France",
                [OwidTableSlugs.Time]: 2000,
                gdp: 1000,
                population: 60,
            },
            {
                [OwidTableSlugs.EntityName]: "France",
                [OwidTableSlugs.Time]: 2010,
                gdp: 1500,
                population: 65,
            },
            {
                [OwidTableSlugs.EntityName]: "Germany",
                [OwidTableSlugs.Time]: 2000,
                gdp: 2000,
                population: 80,
            },
            {
                [OwidTableSlugs.EntityName]: "Germany",
                [OwidTableSlugs.Time]: 2010,
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

    it("resolves to closest available time when exact time has no data", () => {
        const table = makeTestTable()
        const result = makeDimensionValuesForTimeDirect(
            table,
            ["gdp"],
            undefined,
            "France",
            2020 // No data for 2020, closest is 2010
        )

        expect(result?.y?.[0].columnSlug).toBe("gdp")
        expect(result?.y?.[0].value).toBe(1500) // France GDP at 2010
        expect(result?.y?.[0].time).toBe(2010)
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

describe(constructGrapherValuesJson, () => {
    const selectedEntityNames = ["Philippines", "Benin", "Eritrea"]

    const makeGrapherState = (
        overrides: GrapherProgrammaticInterface = {}
    ): GrapherState => {
        const table = SynthesizeGDPTable(
            { entityCount: 5, timeRange: [2000, 2010] },
            12 // Seed
        )
        return new GrapherState({
            table,
            selectedEntityNames,
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
            ],
            ...overrides,
        })
    }

    it("extracts start and end values for the entity over the default time range", () => {
        const result = constructGrapherValuesJson(
            makeGrapherState(),
            "Philippines"
        )

        expect(result.entityName).toBe("Philippines")
        expect(result.startTime).toBe(2000)
        expect(result.endTime).toBe(2009)
        expect(result.startValues?.y).toHaveLength(1)
        expect(result.startValues?.y[0]).toMatchObject({
            columnSlug: SampleColumnSlugs.GDP,
            time: 2000,
            formattedValueShort: "$664 billion",
        })
        expect(result.endValues?.y[0]).toMatchObject({
            columnSlug: SampleColumnSlugs.GDP,
            time: 2009,
            formattedValueShort: "$682 billion",
        })
    })

    it("omits the start values for a single-time chart (two-column dumbbell)", () => {
        // A two-column dumbbell compares two columns at a single time point,
        // so there's no start time and hence no start values.
        const grapherState = makeGrapherState({
            chartTypes: [GRAPHER_CHART_TYPES.Dumbbell],
            selectedEntityNames: ["Philippines"],
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
                {
                    slug: SampleColumnSlugs.Population,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.Population as any,
                },
            ],
        })

        const result = constructGrapherValuesJson(grapherState, "Philippines")

        expect(result.startTime).toBeUndefined()
        expect(result.startValues).toBeUndefined()
        expect(result.endTime).toBe(2009)
        expect(result.endValues?.y).toHaveLength(2)
        expect(result.endValues?.y[0].time).toBe(2009)
    })

    it("restores the original selection afterwards", () => {
        const grapherState = makeGrapherState()
        constructGrapherValuesJson(grapherState, "Benin")
        expect(grapherState.selection.selectedEntityNames).toEqual(
            selectedEntityNames
        )
    })

    it("includes one y data point per y-column", () => {
        const grapherState = makeGrapherState({
            selectedEntityNames: ["Philippines"],
            dimensions: [
                {
                    slug: SampleColumnSlugs.GDP,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.GDP as any,
                },
                {
                    slug: SampleColumnSlugs.Population,
                    property: DimensionProperty.y,
                    variableId: SampleColumnSlugs.Population as any,
                },
            ],
        })

        const result = constructGrapherValuesJson(grapherState, "Philippines")

        expect(result.endValues?.y.map((d) => d.columnSlug)).toEqual([
            SampleColumnSlugs.GDP,
            SampleColumnSlugs.Population,
        ])
    })
})
