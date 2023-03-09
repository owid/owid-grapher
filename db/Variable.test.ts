#! /usr/bin/env yarn jest

import {
    writeVariableCSV,
    getVariableData,
    VariableQueryRow,
    detectValuesType,
} from "./model/Variable.js"
import * as db from "./db.js"
import * as Variable from "./model/Variable.js"
import pl from "nodejs-polars"
import { Writable } from "stream"

afterEach(() => {
    jest.restoreAllMocks()
})

export const mockS3data = (s3data: any) => {
    jest.spyOn(Variable, "fetchS3Values").mockImplementation(
        jest.fn((key) => s3data[key])
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

        jest.spyOn(db, "queryMysql").mockResolvedValueOnce(
            [
                { id: 1, dataPath: "datapath1", metadataPath: "datapath1" },
                { id: 2, dataPath: "datapath2", metadataPath: "datapath2" },
                { id: 3, dataPath: "datapath3", metadataPath: "datapath3" },
            ].filter((row) => variableIds.includes(row.id))
        )

        if (s3data) mockS3data(s3data)

        let out = ""
        const writeStream = new Writable({
            write(chunk, encoding, callback): void {
                out += chunk.toString()
                callback(null)
            },
        })
        await writeVariableCSV(variableIds, writeStream)
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
UK,2000,1.0,3.0,5.0
UK,2001,2.0,4.0,6.0
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
                values: [1, NaN],
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
UK,2000,,1.0,3.0
UK,2001,2.0,NaN,
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

describe("getVariableData", () => {
    it("returns proper data and metadata", async () => {
        const date = new Date(Date.UTC(2023, 1, 1))
        const variableResult: VariableQueryRow = {
            id: 1,
            datasetName: "dataset",
            nonRedistributable: 0,
            sourceId: 1,
            sourceName: "source",
            sourceDescription: "{}",
            name: "",
            code: null,
            unit: "",
            shortUnit: null,
            description: null,
            createdAt: date,
            updatedAt: date,
            datasetId: 0,
            display: "{}",
            dimensions: "",
        }

        const s3data = {
            1: {
                values: [1, 2],
                years: [2000, 2001],
                entities: [1, 1],
            },
        }
        mockS3data(s3data)
        jest.spyOn(db, "mysqlFirst").mockResolvedValueOnce(variableResult)
        jest.spyOn(db, "queryMysql").mockResolvedValueOnce([
            { id: 1, name: "UK", code: "code" },
        ])

        const dataMetadata = await getVariableData(1)

        expect(dataMetadata).toEqual({
            data: { entities: [1, 1], values: [1, 2], years: [2000, 2001] },
            metadata: {
                createdAt: date,
                datasetId: 0,
                datasetName: "dataset",
                dimensions: {
                    entities: { values: [{ code: "code", id: 1, name: "UK" }] },
                    years: { values: [{ id: 2000 }, { id: 2001 }] },
                },
                display: {},
                id: 1,
                name: "",
                nonRedistributable: false,
                source: {
                    additionalInfo: "",
                    dataPublishedBy: "",
                    dataPublisherSource: "",
                    id: 1,
                    link: "",
                    name: "source",
                    retrievedDate: "",
                },
                type: "int",
                unit: "",
                updatedAt: date,
            },
        })
    })
})

describe("detectValuesType", () => {
    test("returns 'int' when all values are integers", () => {
        expect(detectValuesType([1, 2, 3])).toEqual("int")
    })

    test("returns 'float' when all values are floats", () => {
        expect(detectValuesType([1.1, 2.2, 3.3])).toEqual("float")
    })

    test("returns 'string' when all values are strings", () => {
        expect(detectValuesType(["a", "b", "c"])).toEqual("string")
    })

    test("returns 'mixed' when values are a mix of integers and strings", () => {
        expect(detectValuesType([1, "a", 2, "b"])).toEqual("mixed")
    })

    test("returns 'float' when values are a mix of integers and floats", () => {
        expect(detectValuesType([1, 1.1, 2, 2.2])).toEqual("float")
    })

    test("returns 'mixed' when values are a mix of floats and strings", () => {
        expect(detectValuesType([1.1, "a", 2.2, "b"])).toEqual("mixed")
    })

    test("returns 'mixed' when values are empty", () => {
        expect(detectValuesType([])).toEqual("mixed")
    })
})
