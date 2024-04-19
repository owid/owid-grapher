#! /usr/bin/env yarn jest

import { writeVariableCSV, _dataAsDFfromS3 } from "./model/Variable.js"
import * as Variable from "./model/Variable.js"
import pl from "nodejs-polars"
import { Writable } from "stream"
import { OwidVariableId } from "@ourworldindata/utils"
import * as db from "./db.js"

import { jest } from "@jest/globals"

afterEach(() => {
    jest.restoreAllMocks()
})

export const mockS3data = (s3data: Record<string, any>): void => {
    jest.spyOn(Variable, "fetchS3Values").mockImplementation(
        jest.fn((key: OwidVariableId) => s3data[key])
    )

    const entities = pl
        .DataFrame({
            entityId: [1],
            entityName: ["UK"],
            entityCode: ["code"],
        })
        .withColumn(pl.col("entityId").cast(pl.Int32))
    jest.spyOn(Variable, "entitiesAsDF").mockResolvedValueOnce(entities)
}

describe("writeVariableCSV", () => {
    const getCSVOutput = async (
        variablesDf: pl.DataFrame | undefined,
        s3data: any,
        variableIds: number[]
    ): Promise<string> => {
        const spy = jest.spyOn(Variable, "readSQLasDF")
        if (variablesDf) spy.mockResolvedValueOnce(variablesDf)

        if (s3data) mockS3data(s3data)

        let out = ""
        const writeStream = new Writable({
            write(chunk, encoding, callback): void {
                out += chunk.toString()
                callback(null)
            },
        })

        await writeVariableCSV(
            variableIds,
            writeStream,
            {} as db.KnexReadonlyTransaction
        )

        return out
    }

    it("writes to a stream", async () => {
        const variablesDf = pl.DataFrame({
            variableId: [1, 2, 3],
            variableName: ["a", "b", "c"],
            columnOrder: [0, 1, 2],
        })

        const s3data = {
            1: {
                values: [1, 2],
                years: [2000, 2001],
                entities: [1, 1],
            },
            2: {
                values: [3, 4],
                years: [2000, 2001],
                entities: [1, 1],
            },
            3: {
                values: [5, 6],
                years: [2000, 2001],
                entities: [1, 1],
            },
        }

        const out = await getCSVOutput(variablesDf, s3data, [1, 2, 3])
        expect(out).toEqual(`Entity,Year,a,b,c
UK,2000,1,3,5
UK,2001,2,4,6
`)
    })

    it("handles null and NaN values", async () => {
        const variablesDf = pl.DataFrame({
            variableId: [1, 2, 3],
            variableName: ["a", "b", "c"],
            columnOrder: [0, 1, 2],
        })

        const s3data = {
            1: {
                values: [null, 2],
                years: [2000, 2001],
                entities: [1, 1],
            },
            2: {
                values: [1, null],
                years: [2000, 2001],
                entities: [1, 1],
            },
            3: {
                values: [3, null],
                years: [2000, 2001],
                entities: [1, 1],
            },
        }

        const out = await getCSVOutput(variablesDf, s3data, [1, 2, 3])
        expect(out).toEqual(`Entity,Year,a,b,c
UK,2000,,1,3
UK,2001,2,,
`)
    })

    it("returns empty dataframe for variable without data", async () => {
        const variablesDf = pl.DataFrame({
            variableId: [1, 2],
            variableName: ["a", "b"],
            columnOrder: [0, 1],
        })

        const s3data = {
            1: {
                values: [],
                years: [],
                entities: [],
            },
            2: {
                values: [],
                years: [],
                entities: [],
            },
        }

        const out = await getCSVOutput(variablesDf, s3data, [1, 2])
        expect(out).toEqual(`Entity,Year
`)
    })

    it("raises error for missing variable", async () => {
        const variablesDf = pl.DataFrame({
            variableId: [1, 2],
            variableName: ["a", "b"],
            columnOrder: [0, 1],
        })

        expect.assertions(1)
        try {
            await getCSVOutput(variablesDf, undefined, [1, 2, 3])
        } catch (e: any) {
            expect(e.message).toEqual("Variable IDs do not exist: 3")
        }
    })
})

describe("_dataAsDFfromS3", () => {
    it("works correctly for mixed data", async () => {
        const s3data = {
            1: {
                values: [1, "NA"],
                years: [2000, 2001],
                entities: [1, 1],
            },
        }
        mockS3data(s3data)
        const df = await _dataAsDFfromS3([1], {} as db.KnexReadonlyTransaction)
        expect(df.toObject()).toEqual({
            entityCode: ["code", "code"],
            entityId: [1, 1],
            entityName: ["UK", "UK"],
            value: ["1", "NA"],
            variableId: [1, 1],
            year: [2000, 2001],
        })
    })
})
