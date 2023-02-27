#! /usr/bin/env yarn jest

import {
    writeVariableCSV,
    getVariableData,
    VariableQueryRow,
} from "./model/Variable.js"
import * as db from "./db.js"
import * as Variable from "./model/Variable.js"
import pl from "nodejs-polars"
import { Writable } from "stream"

describe("writeVariableCSV", () => {
    const getCSVOutput = async (
        variablesDf: pl.DataFrame | undefined,
        dataDf: pl.DataFrame | undefined,
        variableIds: number[] = [1, 2]
    ): Promise<string> => {
        const spy = jest.spyOn(Variable, "readSQLasDF")
        if (variablesDf) spy.mockResolvedValueOnce(variablesDf)
        if (dataDf) spy.mockResolvedValueOnce(dataDf)

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
            variableId: [1, 2],
            variableName: ["a", "b"],
            columnOrder: [0, 1],
        })

        const dataDf = pl.DataFrame({
            variableId: [1, 1, 2, 2],
            value: [1, 2, 3, 4],
            year: [2000, 2001, 2000, 2001],
            entityId: [1, 1, 1, 1],
            entityName: ["UK", "UK", "UK", "UK"],
            entityCode: ["code", "code", "code", "code"],
        })

        const out = await getCSVOutput(variablesDf, dataDf)
        expect(out).toEqual(`Entity,Year,a,b
UK,2000,1.0,3.0
UK,2001,2.0,4.0
`)
    })

    it("handles null and NaN values", async () => {
        const variablesDf = pl.DataFrame({
            variableId: [1, 2],
            variableName: ["a", "b"],
            columnOrder: [0, 1],
        })

        const dataDf = pl.DataFrame({
            variableId: [1, 1, 2, 2],
            value: [null, 2, 1, NaN],
            year: [2000, 2001, 2000, 2001],
            entityId: [1, 1, 1, 1],
            entityName: ["UK", "UK", "UK", "UK"],
            entityCode: ["code", "code", "code", "code"],
        })

        const out = await getCSVOutput(variablesDf, dataDf)
        expect(out).toEqual(`Entity,Year,a,b
UK,2000,,1.0
UK,2001,2.0,NaN
`)
    })

    it("returns empty dataframe for variable without data", async () => {
        const variablesDf = pl.DataFrame({
            variableId: [1, 2],
            variableName: ["a", "b"],
            columnOrder: [0, 1],
        })

        const dataDf = pl.DataFrame()

        const out = await getCSVOutput(variablesDf, dataDf)
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

        const dataDf = pl.DataFrame({
            variableId: [1, 1],
            value: [1, 2],
            year: [2000, 2001],
            entityId: [1, 1],
            entityName: ["UK", "UK"],
            entityCode: ["code", "code"],
        })

        jest.spyOn(db, "mysqlFirst").mockResolvedValueOnce(variableResult)
        jest.spyOn(Variable, "readSQLasDF").mockResolvedValueOnce(dataDf)

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
