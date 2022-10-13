#! /usr/bin/env yarn jest

import {
    normalizeEntityName,
    constructParquetQuery,
    readValuesFromParquet,
} from "./model/Variable.js"
import * as Variable from "./model/Variable.js"

describe("normalizeEntityName", () => {
    it("works", () => {
        expect(normalizeEntityName("United kingdom ")).toBe("united kingdom")
    })
})

describe("constructParquetQuery", () => {
    it("works without dimensions", () => {
        const row: any = {
            shortName: "test_var",
            catalogPath: "dataset",
        }
        const expectedSql = `
            select
                test_var as value,
                year,
                country as entityName
            from read_parquet('https://owid-catalog.nyc3.digitaloceanspaces.com/dataset.parquet')
            where test_var is not null and 1 = 1
            order by year asc
        `
        expect(constructParquetQuery(row)).toBe(expectedSql)
    })

    it("works with dimensions", () => {
        const row: any = {
            shortName: "test_var__age_0_4__sex_male",
            catalogPath: "dataset",
            dimensions: JSON.stringify({
                originalShortName: "test_var",
                filters: [
                    {
                        name: "age",
                        value: "0-4",
                    },
                    {
                        name: "sex",
                        value: "male",
                    },
                ],
            }),
        }
        const expectedSql = `
            select
                test_var as value,
                year,
                country as entityName
            from read_parquet('https://owid-catalog.nyc3.digitaloceanspaces.com/dataset.parquet')
            where test_var is not null and age = '0-4' and sex = 'male'
            order by year asc
        `
        expect(constructParquetQuery(row)).toBe(expectedSql)
    })

    it("works for backported variables", () => {
        const row: any = {
            shortName: "test_var",
            catalogPath: "backport/dataset",
        }
        const expectedSql = `
            select
                test_var as value,
                year,
                entity_name as entityName,
                entity_code as entityCode,
                entity_id as entityId
            from read_parquet('https://owid-catalog.nyc3.digitaloceanspaces.com/backport/dataset.parquet')
            where test_var is not null and 1 = 1
            order by year asc
        `
        expect(constructParquetQuery(row)).toBe(expectedSql)
    })
})

describe("readValuesFromParquet", () => {
    it("works", async () => {
        const row: any = {
            shortName: "gdp",
            catalogPath: "grapher/ggdc/2020-10-01/ggdc_maddison/maddison_gdp",
        }
        const variableId = 1

        jest.spyOn(Variable, "executeSQL").mockResolvedValueOnce([
            { value: 286800000, year: 1, entityName: "Belgium" },
        ])
        jest.spyOn(Variable, "fetchEntities").mockResolvedValueOnce([
            { entityId: 2, entityCode: "BE", entityName: "Belgium" },
        ])

        const data = await readValuesFromParquet(variableId, row)

        expect(data).toStrictEqual([
            {
                entityCode: "BE",
                entityId: 2,
                entityName: "Belgium",
                value: 286800000,
                year: 1,
            },
        ])
    })
})
