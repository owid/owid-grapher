#! /usr/bin/env yarn jest

import { OwidTable, BasicTable } from "owidTable/OwidTable"
import { OwidVariablesAndEntityKey } from "./OwidVariable"

describe(OwidTable, () => {
    // Scenarios
    // create: rows|noRows & noSpec|fullSpec|partialSpec|incorrectSpec?
    //  add: rows
    //  add: spec
    //  add: spec with rowGen
    //  add: partialSpec
    //  add partialSpec with rowGen
    //  change spec?

    const rows = [
        {
            year: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
        },
    ]
    const table = new OwidTable(rows)
    it("can create a table and detect columns", () => {
        expect(table.rows.length).toEqual(1)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(5)
    })

    it("a column can be added", () => {
        table.addNumericComputedColumn({
            slug: "populationInMillions",
            fn: (row) => row.population / 1000000,
        })
        expect(table.rows[0].populationInMillions).toEqual(300)
    })
})

const legacyVarSet: OwidVariablesAndEntityKey = {
    variables: {
        "3512": {
            years: [1983, 1985, 1985, 1985, 1985, 1986, 1986],
            entities: [99, 45, 204, 213, 104, 28, 172],
            values: [5.5, 4.2, 12.6, 18.3, 25.3, 17.3, 0.7],
            id: 3512,
            name:
                "Prevalence of wasting, weight for height (% of children under 5)",
            unit: "% of children under 5",
            description:
                "Prevalence of wasting is the proportion of children under age 5 whose weight for height is more than two standard deviations below the median for the international reference population ages 0-59.",
            createdAt: "2017-07-06T09:04:22.000Z",
            updatedAt: "2018-12-11T20:12:30.000Z",
            code: "SH.STA.WAST.ZS",
            coverage: "",
            timespan: "1960-2017",
            datasetId: 563,
            sourceId: 2174,
            shortUnit: "%",
            display: {},
            columnOrder: 0,
            originalMetadata: null,
            datasetName: "World Development Indicators - Health",
            s_id: 2174,
            s_name:
                "World Bank - WDI: Prevalence of wasting, weight for height (% of children under 5)",
            source: {
                id: 2174,
                name:
                    "World Bank - WDI: Prevalence of wasting, weight for height (% of children under 5)",
                dataPublishedBy: "World Bank – World Development Indicators",
                dataPublisherSource:
                    "UNICEF, WHO, World Bank: Joint child malnutrition estimates (JME). Aggregation is based on UNICEF, WHO, and the World Bank harmonized dataset (adjusted, comparable data) and methodology.",
                link:
                    "http://data.worldbank.org/data-catalog/world-development-indicators",
                retrievedData: "",
                additionalInfo:
                    "General comments: Undernourished children have lower resistance to infection and are more likely to die from common childhood ailments such as diarrheal diseases and respiratory infections. Frequent illness saps the nutritional status of those who survive, locking them into a vicious cycle of recurring sickness and faltering growth (UNICEF, www.childinfo.org). Estimates of child malnutrition, based on prevalence of underweight and stunting, are from national survey data. The proportion of underweight children is the most common malnutrition indicator. Being even mildly underweight increases the risk of death and inhibits cognitive development in children. And it perpetuates the problem across generations, as malnourished women are more likely to have low-birth-weight babies. Stunting, or being below median height for age, is often used as a proxy for multifaceted deprivation and as an indicator of long-term changes in malnutrition.",
            },
        },
    },
    entityKey: {
        28: { name: "Bangladesh", code: "BGD" },
        45: { name: "Cape Verde", code: "CPV" },
        99: { name: "Papua New Guinea", code: "PNG" },
        104: { name: "Niger", code: "NER" },
        172: { name: "Chile", code: "CHL" },
        204: { name: "Kiribati", code: "KIR" },
        213: { name: "Mauritius", code: "MUS" },
    },
} as any

describe("from legacy", () => {
    const table = OwidTable.fromLegacy(legacyVarSet)
    const name =
        "Prevalence of wasting, weight for height (% of children under 5)"

    it("can create a table and detect columns from legacy", () => {
        expect(table.rows.length).toEqual(7)
        expect(Array.from(table.columnsBySlug.keys())).toEqual([
            "entityName",
            "entityId",
            "entityCode",
            "year",
            "3512",
        ])

        expect(Array.from(table.columnsByName.keys())).toEqual([
            "Entity",
            "entityId",
            "Code",
            "Year",
            name,
        ])
    })
})

describe("annotations column", () => {
    const csv = `entityName,pop,notes,year
usa,322,in hundreds of millions,2000
hi,1,in millions,2000
hi,1,,2001`
    const table = BasicTable.fromDelimited(csv)
    table.addStringColumnSpec({ slug: "pop", annotationsColumnSlug: "notes" })

    it("can get annotations for a row", () => {
        const annotationsColumn = table.columnsBySlug.get("pop")
            ?.annotationsColumn
        expect(annotationsColumn?.spec.slug).toBe("notes")

        const entityNameMap = annotationsColumn!.entityNameMap

        expect(entityNameMap.size).toEqual(2)
        expect(entityNameMap.get("hi")).toContain("in millions")
        expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
    })
})

describe("from csv", () => {
    const csv = `country,population
iceland,1
france,50
usa,300
canada,20`
    const table = BasicTable.fromDelimited(csv)

    it("a table can be made from csv", () => {
        expect(table.rows.length).toEqual(4)
        expect(Array.from(table.columnsByName.keys())).toEqual([
            "country",
            "population",
        ])
    })

    describe("filtering", () => {
        const col = table.columnsBySlug.get("country")!
        it("one filter works", () => {
            expect(col.values[3]).toEqual("canada")
            table.addFilterColumn(
                "pop_filter",
                (row) => parseInt(row.population) > 40
            )
            expect(col?.values[0]).toEqual("france")
            expect(col?.values[1]).toEqual("usa")
        })

        it("multiple filters work", () => {
            table.addFilterColumn("name_filter", (row) =>
                (row.country as string).startsWith("u")
            )
            expect(col?.values[0]).toEqual("usa")
            expect(col?.values[1]).toEqual(undefined)
        })

        it("adding rows works with filters", () => {
            table.cloneAndAddRowsAndDetectColumns([
                { country: "ireland", population: "7" },
                { country: "united kingdom", population: "60" },
            ])
            expect(col?.values[0]).toEqual("usa")
            expect(col?.values[1]).toEqual("united kingdom")
        })
    })
})

describe("toDelimited", () => {
    const csv = `country,Population in 2020
iceland,1`
    const table = BasicTable.fromDelimited(csv)
    it("delimited uses slugs as default", () => {
        const csv = table.toDelimited()
        expect(csv).toEqual(`country,Population-in-2020
iceland,1`)
    })
})

describe("immutability", () => {
    const rows = [{ country: "USA" }, { country: "Germany" }]
    const table = new BasicTable(rows)
    it("does not modify rows", () => {
        table.addNumericComputedColumn({
            slug: "firstLetter",
            fn: (row) => row.country.length,
        })
        expect(table.columnsBySlug.get("firstLetter")?.values.join("")).toEqual(
            `37`
        )
        expect((rows[0] as any).firstLetter).toEqual(undefined)
    })
})

describe("getting entities with all requires columns", () => {
    const csv = `entityName,entityCode,entityId,gdp,pop
iceland,ice,1,123,3
usa,us,2,23,
france,fr,3,23,4`
    const table = OwidTable.fromDelimited(csv)

    it("gets entities only with values for that column", () => {
        expect(table.columnsBySlug.get("pop")?.entityNamesUniq.size).toEqual(2)
    })

    it("filters rows correctly", () => {
        expect(table.entitiesWith(["gdp"]).size).toEqual(3)
    })

    it("filters rows correctly", () => {
        expect(table.entitiesWith(["gdp"]).size).toEqual(3)
        expect(table.entitiesWith(["gdp", "pop"]).size).toEqual(2)
    })
})

describe("rolling averages", () => {
    const rows = [
        {
            year: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
            continent: "North America",
        },
        {
            year: 2020,
            entityName: "World",
            population: 10e8,
            entityId: 12,
            entityCode: "World",
            continent: "",
        },
        {
            year: 2020,
            entityName: "United States",
            population: 3e8,
            entityId: 1,
            entityCode: "USA",
            continent: "North America",
        },
    ]
    const colLength = Object.keys(rows[0]).length
    const table = new OwidTable(rows)
    it("a column can be added", () => {
        expect(table.rows.length).toEqual(rows.length)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(colLength)
        table.addNumericComputedColumn({
            slug: "populationInMillions",
            fn: (row) => row.population / 1000000,
        })
        expect(table.rows[0].populationInMillions).toEqual(300)
        expect(Array.from(table.columnsByName.keys()).length).toEqual(
            colLength + 1
        )
    })

    // sortedUniqNonEmptyStringVals
    it("cam get values for color legend", () => {
        expect(
            table.columnsBySlug.get("continent")?.sortedUniqNonEmptyStringVals
                .length
        ).toEqual(1)
    })
})
