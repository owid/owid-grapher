/**
 * Tests for the dataset CSV export, which is the only code built on
 * nodejs-polars. They exercise the real polars pipeline end to end and fake
 * only the two I/O boundaries: MySQL (a stub knex whose `raw` answers the two
 * queries we issue) and the data API (a stubbed global `fetch`). This is so a
 * nodejs-polars upgrade that changes join, pivot, sort or CSV-writing behaviour
 * shows up here.
 */

import { expect, it, describe, afterEach, vi } from "vitest"

import { writeVariableCSV, _dataAsDFfromS3 } from "./model/Variable.js"
import { Writable } from "stream"
import { OwidVariableMixedData } from "@ourworldindata/utils"
import * as db from "./db.js"

interface FakeVariable {
    id: number
    name: string
    columnOrder: number
}

interface FakeEntity {
    id: number
    name: string
    code: string | null
}

const ENTITIES: FakeEntity[] = [
    { id: 1, name: "United Kingdom", code: "GBR" },
    { id: 2, name: "France", code: "FRA" },
    { id: 3, name: "Korea, South", code: null },
]

/** A knex stand-in that answers the `variables` and `entities` lookups. */
const fakeKnex = (
    variables: FakeVariable[],
    entities: FakeEntity[] = ENTITIES
): db.KnexReadonlyTransaction => {
    const raw = async (
        sql: string,
        params: unknown[]
    ): Promise<[Record<string, unknown>[]]> => {
        const ids = params[0] as number[]
        if (sql.includes("FROM variables"))
            return [
                variables
                    .filter((v) => ids.includes(v.id))
                    .map((v) => ({
                        variableId: v.id,
                        variableName: v.name,
                        columnOrder: v.columnOrder,
                    })),
            ]
        if (sql.includes("FROM entities"))
            return [
                entities
                    .filter((e) => ids.includes(e.id))
                    .map((e) => ({
                        entityId: e.id,
                        entityName: e.name,
                        entityCode: e.code,
                    })),
            ]
        throw new Error(`Unexpected query: ${sql}`)
    }
    return { raw } as unknown as db.KnexReadonlyTransaction
}

/** Serve `<variableId>.data.json` from the given map via a stubbed fetch. */
const stubDataApi = (data: Record<number, OwidVariableMixedData>): void => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string) => {
            const variableId = Number(url.match(/(\d+)\.data\.json/)?.[1])
            const body = data[variableId]
            if (!body) return new Response("not found", { status: 404 })
            return Response.json(body)
        })
    )
}

const csvFor = async (
    variableIds: number[],
    knex: db.KnexReadonlyTransaction
): Promise<string> => {
    let out = ""
    const stream = new Writable({
        write(chunk, _encoding, callback): void {
            out += chunk.toString()
            callback(null)
        },
    })
    await writeVariableCSV(variableIds, stream, knex)
    return out
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe(writeVariableCSV, () => {
    it("pivots variables into columns ordered by columnOrder, rows sorted by entity and year", async () => {
        // columnOrder deliberately disagrees with both id and name order
        const knex = fakeKnex([
            { id: 1, name: "a", columnOrder: 2 },
            { id: 2, name: "b", columnOrder: 0 },
            { id: 3, name: "c", columnOrder: 1 },
        ])
        stubDataApi({
            1: {
                values: [1, 2, 7],
                years: [2001, 2000, 2000],
                entities: [1, 1, 2],
            },
            2: {
                values: [3, 4, 8],
                years: [2001, 2000, 2000],
                entities: [1, 1, 2],
            },
            3: {
                values: [5, 6, 9],
                years: [2001, 2000, 2000],
                entities: [1, 1, 2],
            },
        })

        expect(await csvFor([1, 2, 3], knex)).toEqual(
            [
                "Entity,Year,b,c,a",
                "France,2000,8,9,7",
                "United Kingdom,2000,4,6,2",
                "United Kingdom,2001,3,5,1",
                "",
            ].join("\n")
        )
    })

    it("leaves cells empty for null and for entity-years a variable has no value for", async () => {
        const knex = fakeKnex([
            { id: 1, name: "a", columnOrder: 0 },
            { id: 2, name: "b", columnOrder: 1 },
        ])
        stubDataApi({
            1: {
                values: [null as any, 2],
                years: [2000, 2001],
                entities: [1, 1],
            },
            // no 2001 row at all
            2: { values: [1], years: [2000], entities: [1] },
        })

        expect(await csvFor([1, 2], knex)).toEqual(
            [
                "Entity,Year,a,b",
                "United Kingdom,2000,,1",
                "United Kingdom,2001,2,",
                "",
            ].join("\n")
        )
    })

    it("writes mixed numeric/text values verbatim and quotes entity names containing commas", async () => {
        const knex = fakeKnex([{ id: 1, name: "status", columnOrder: 0 }])
        stubDataApi({
            1: {
                values: [0.1, "not available", 1e21],
                years: [2000, 2000, 2001],
                entities: [3, 1, 1],
            },
        })

        expect(await csvFor([1], knex)).toEqual(
            [
                "Entity,Year,status",
                '"Korea, South",2000,0.1',
                "United Kingdom,2000,not available",
                "United Kingdom,2001,1e+21",
                "",
            ].join("\n")
        )
    })

    it("writes only the header when no variable has data", async () => {
        const knex = fakeKnex([
            { id: 1, name: "a", columnOrder: 0 },
            { id: 2, name: "b", columnOrder: 1 },
        ])
        stubDataApi({
            1: { values: [], years: [], entities: [] },
            2: { values: [], years: [], entities: [] },
        })

        expect(await csvFor([1, 2], knex)).toEqual("Entity,Year\n")
    })

    it("raises an error naming variables that don't exist", async () => {
        const knex = fakeKnex([
            { id: 1, name: "a", columnOrder: 0 },
            { id: 2, name: "b", columnOrder: 1 },
        ])

        await expect(csvFor([1, 2, 3, 4], knex)).rejects.toThrow(
            "Variable IDs do not exist: 3, 4"
        )
    })
})

describe(_dataAsDFfromS3, () => {
    it("joins entity names/codes and stringifies values", async () => {
        stubDataApi({
            1: { values: [1, "NA"], years: [2000, 2001], entities: [1, 3] },
        })

        const df = await _dataAsDFfromS3([1], fakeKnex([]))

        expect(df.toObject()).toEqual({
            variableId: [1, 1],
            entityId: [1, 3],
            entityName: ["United Kingdom", "Korea, South"],
            entityCode: ["GBR", null],
            year: [2000, 2001],
            value: ["1", "NA"],
        })
    })
})
