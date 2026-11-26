// Synthetic inputs for legacyToOwidTableAndDimensions, sized like real charts.
// Used by LegacyToOwidTable.bench.ts and LegacyToOwidTable.fixtures.test.ts.
// The data is generated from a seeded PRNG, so every run sees the same input

import {
    DimensionProperty,
    IndicatorDimensionInterface,
    MultipleOwidVariableDataDimensionsMap,
    OwidChartDimensionInterface,
    OwidVariableDataMetadataDimensions,
    OwidVariableDimensionValuePartial,
    OwidVariableDisplayConfigInterface,
    OwidVariableType,
    SelectedEntityColors,
    TimeInterval,
} from "@ourworldindata/types"
import { CONTINENTS_INDICATOR_ID } from "./GrapherConstants"

export interface LegacyTableFixture {
    name: string
    json: () => MultipleOwidVariableDataDimensionsMap
    dimensions: OwidChartDimensionInterface[]
    selectedEntityColors?: SelectedEntityColors
}

/** Describes a generated variable: `entities` × `times`, thinned by `density` */
interface VariableSpec {
    id: number
    entities: number
    times: number[]
    /** Fraction of entity-times that have a value (default: all) */
    density?: number
    display?: OwidVariableDisplayConfigInterface
    type?: OwidVariableType
    seed?: number
    /** Leave every 7th entity out of the metadata */
    missingMetaEntities?: boolean
    /** Give every 3rd entity a `null` code */
    nullCodes?: boolean
    /** Append copies of the first n rows */
    duplicateRows?: number
}

/** mulberry32: a small seeded PRNG */
const seededRandom = (seed: number): (() => number) => {
    let state = seed | 0
    return (): number => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const range = (start: number, end: number, step = 1): number[] => {
    const values: number[] = []
    for (let value = start; value < end; value += step) values.push(value)
    return values
}

const makeVariable = (
    spec: VariableSpec
): OwidVariableDataMetadataDimensions => {
    const random = seededRandom(spec.seed ?? spec.id)
    const entities: number[] = []
    const years: number[] = []
    const values: (number | string)[] = []
    for (let entity = 1; entity <= spec.entities; entity++)
        for (const time of spec.times) {
            if (random() > (spec.density ?? 1)) continue
            entities.push(entity)
            years.push(time)
            values.push(
                spec.type === "string"
                    ? `v${Math.floor(random() * 5)}`
                    : spec.type === "int"
                      ? Math.floor(random() * 1000)
                      : spec.type === "mixed" && random() < 0.1
                        ? "n/a"
                        : random() * 1000
            )
        }
    for (let row = 0; row < (spec.duplicateRows ?? 0); row++) {
        entities.push(entities[row])
        years.push(years[row])
        values.push(-1)
    }

    const metaEntities: OwidVariableDimensionValuePartial[] = []
    for (let entity = 1; entity <= spec.entities; entity++) {
        if (spec.missingMetaEntities && entity % 7 === 0) continue
        metaEntities.push({
            id: entity,
            name: `Entity ${entity}`,
            // The API can send null codes, which the types don't allow
            code:
                spec.nullCodes && entity % 3 === 0
                    ? (null as unknown as string)
                    : `E${entity}`,
        })
    }

    return {
        data: { entities, years, values },
        metadata: {
            id: spec.id,
            name: `Variable ${spec.id}`,
            unit: "u",
            type: spec.type ?? "float",
            display: spec.display,
            dimensions: {
                years: { values: spec.times.map((id) => ({ id })) },
                entities: { values: metaEntities },
            },
        },
    }
}

/** A variable with exactly the given rows, for edge cases */
const makeRawVariable = (
    id: number,
    rows: { entities: number[]; years: number[] },
    display?: OwidVariableDisplayConfigInterface
): OwidVariableDataMetadataDimensions => ({
    data: { ...rows, values: rows.years.map((year) => year + id) },
    metadata: {
        id,
        type: "float",
        display,
        dimensions: {
            years: { values: [] },
            entities: { values: [{ id: 1, name: "E1", code: "E1" }] },
        },
    },
})

const fromSpecs =
    (specs: VariableSpec[]): (() => MultipleOwidVariableDataDimensionsMap) =>
    (): MultipleOwidVariableDataDimensionsMap =>
        new Map(specs.map((spec) => [spec.id, makeVariable(spec)]))

const fromVariables =
    (
        variables: OwidVariableDataMetadataDimensions[]
    ): (() => MultipleOwidVariableDataDimensionsMap) =>
    (): MultipleOwidVariableDataDimensionsMap =>
        new Map(variables.map((variable) => [variable.metadata.id, variable]))

const slot = (
    variableId: number,
    property: DimensionProperty = DimensionProperty.y,
    extra: Partial<IndicatorDimensionInterface> = {}
): IndicatorDimensionInterface => ({ variableId, property, ...extra })

const DAILY: OwidVariableDisplayConfigInterface = {
    timeInterval: TimeInterval.Day,
}

/** Chart-sized inputs, for benchmarking */
export const benchmarkFixtures: LegacyTableFixture[] = [
    {
        name: "one yearly indicator (~45k rows)",
        json: fromSpecs([
            { id: 1, entities: 250, times: range(1800, 2024), density: 0.8 },
        ]),
        dimensions: [slot(1)],
    },
    {
        name: "four yearly indicators + continents",
        json: fromSpecs([
            { id: 1, entities: 250, times: range(1950, 2024), density: 0.9 },
            {
                id: 2,
                entities: 230,
                times: range(1960, 2024),
                density: 0.7,
                type: "int",
            },
            {
                id: 3,
                entities: 200,
                times: range(1900, 2024, 5),
                density: 0.9,
                display: { conversionFactor: 0.5 },
            },
            {
                id: 4,
                entities: 260,
                times: range(1990, 2024),
                density: 0.95,
                type: "mixed",
            },
            {
                id: CONTINENTS_INDICATOR_ID,
                entities: 260,
                times: [2015],
                type: "string",
            },
        ]),
        dimensions: [
            slot(1),
            slot(2, DimensionProperty.y, {
                display: { conversionFactor: 2.5 },
            }),
            slot(3),
            slot(4),
            slot(CONTINENTS_INDICATOR_ID, DimensionProperty.color),
        ],
        selectedEntityColors: { "Entity 1": "#f00", "Entity 5": "#0f0" },
    },
    {
        name: "daily + monthly + yearly (~180k day rows)",
        json: fromSpecs([
            {
                id: 1,
                entities: 200,
                times: range(0, 900),
                density: 0.9,
                display: { ...DAILY, zeroDay: "2020-01-21" },
            },
            {
                id: 2,
                entities: 200,
                times: range(18000, 19200, 30),
                density: 0.8,
                display: { timeInterval: TimeInterval.Month },
            },
            { id: 3, entities: 220, times: range(2015, 2024), density: 0.9 },
            { id: 4, entities: 240, times: [2015], type: "string" },
        ]),
        dimensions: [slot(1), slot(2), slot(3), slot(4)],
    },
    {
        name: "scatter with target years and tolerance",
        json: fromSpecs([
            { id: 1, entities: 250, times: range(1950, 2024), density: 0.6 },
            {
                id: 2,
                entities: 250,
                times: range(1950, 2024),
                density: 0.5,
                display: { tolerance: 3 },
            },
            { id: 3, entities: 250, times: range(1950, 2024), density: 0.5 },
        ]),
        dimensions: [
            slot(1),
            slot(2, DimensionProperty.x, { targetYear: 2000 }),
            slot(3, DimensionProperty.size, {
                targetYear: 2010,
                display: { tolerance: 5 },
            }),
        ],
    },
    {
        name: "five yearly indicators with identical coverage",
        json: fromSpecs(
            [1, 2, 3, 4, 5].map((id) => ({
                id,
                entities: 250,
                times: range(1800, 2024),
            }))
        ),
        dimensions: [1, 2, 3, 4, 5].map((id) => slot(id)),
    },
    {
        name: "three daily indicators with identical coverage + one yearly",
        json: fromSpecs([
            ...[1, 2, 3].map((id) => ({
                id,
                entities: 200,
                times: range(0, 900),
                display: DAILY,
            })),
            { id: 4, entities: 220, times: range(2015, 2024) },
        ]),
        dimensions: [1, 2, 3, 4].map((id) => slot(id)),
    },
]

/** Small inputs that each hit an edge case of the join */
export const edgeCaseFixtures: LegacyTableFixture[] = [
    {
        name: "only target years",
        json: fromSpecs([
            { id: 1, entities: 50, times: range(1990, 2024), density: 0.6 },
            { id: 2, entities: 50, times: range(1990, 2024), density: 0.6 },
        ]),
        dimensions: [
            slot(1, DimensionProperty.y, { targetYear: 2000 }),
            slot(2, DimensionProperty.x, { targetYear: 2005 }),
        ],
    },
    {
        name: "a single target-year indicator",
        json: fromSpecs([
            { id: 1, entities: 50, times: range(1990, 2024), density: 0.6 },
        ]),
        dimensions: [slot(1, DimensionProperty.y, { targetYear: 2000 })],
    },
    {
        name: "days + a target year",
        json: fromSpecs([
            {
                id: 1,
                entities: 30,
                times: range(0, 100),
                density: 0.9,
                display: DAILY,
            },
            { id: 2, entities: 30, times: range(1990, 2024), density: 0.6 },
        ]),
        dimensions: [
            slot(1),
            slot(2, DimensionProperty.x, { targetYear: 2000 }),
        ],
    },
    {
        name: "days + years + a target year",
        json: fromSpecs([
            {
                id: 1,
                entities: 30,
                times: range(0, 100),
                density: 0.9,
                display: DAILY,
            },
            { id: 2, entities: 30, times: range(1990, 2024), density: 0.6 },
            { id: 3, entities: 30, times: range(1990, 2024), density: 0.6 },
        ]),
        dimensions: [
            slot(1),
            slot(2),
            slot(3, DimensionProperty.x, { targetYear: 2000 }),
        ],
    },
    {
        name: "no dimensions, with entity colors",
        json: fromSpecs([]),
        dimensions: [],
        selectedEntityColors: { A: "#fff" },
    },
    {
        name: "a missing variable and a duplicate dimension",
        json: fromSpecs([{ id: 1, entities: 20, times: range(2000, 2010) }]),
        dimensions: [slot(1), slot(1), slot(99)],
    },
    {
        name: "null codes and entities missing from the metadata",
        json: fromSpecs([
            {
                id: 1,
                entities: 30,
                times: range(2000, 2010),
                nullCodes: true,
                missingMetaEntities: true,
            },
            {
                id: 2,
                entities: 35,
                times: range(2005, 2015),
                nullCodes: true,
            },
        ]),
        dimensions: [slot(1), slot(2)],
    },
    {
        name: "duplicate rows",
        json: fromSpecs([
            { id: 1, entities: 10, times: range(2000, 2010), duplicateRows: 3 },
            { id: 2, entities: 10, times: range(2000, 2010) },
        ]),
        dimensions: [slot(1), slot(2)],
    },
    {
        name: "weeks, months, decades and years",
        json: fromSpecs([
            {
                id: 1,
                entities: 10,
                times: range(18000, 18400, 7),
                display: { timeInterval: TimeInterval.Week },
            },
            {
                id: 2,
                entities: 10,
                times: range(18000, 18400, 30),
                display: { timeInterval: TimeInterval.Month },
            },
            {
                id: 3,
                entities: 10,
                times: range(1950, 2030, 10),
                display: { timeInterval: TimeInterval.Decade },
            },
            { id: 4, entities: 10, times: range(2015, 2024) },
        ]),
        dimensions: [slot(1), slot(2), slot(3), slot(4)],
    },
    {
        name: "an integer indicator with a fractional conversion factor",
        json: fromSpecs([
            {
                id: 1,
                entities: 10,
                times: range(2000, 2010),
                type: "int",
                display: { conversionFactor: 0.1, color: "#abc" },
            },
            { id: 2, entities: 10, times: range(2000, 2010), type: "string" },
        ]),
        dimensions: [
            slot(1),
            slot(2, DimensionProperty.y, {
                display: { color: "#def", name: "X" },
            }),
        ],
    },
    {
        name: "daily duplicates + years + a target year",
        json: fromSpecs([
            {
                id: 1,
                entities: 10,
                times: range(0, 60),
                duplicateRows: 4,
                display: DAILY,
            },
            {
                id: 2,
                entities: 12,
                times: range(0, 60),
                density: 0.7,
                display: DAILY,
            },
            { id: 3, entities: 10, times: range(2019, 2022), duplicateRows: 2 },
            { id: 4, entities: 10, times: range(2015, 2022) },
        ]),
        dimensions: [
            slot(1),
            slot(2),
            slot(3),
            slot(4, DimensionProperty.x, { targetYear: 2020 }),
        ],
    },
    {
        name: "negative years",
        json: fromSpecs([
            { id: 1, entities: 10, times: range(-5000, 2000, 250) },
            {
                id: 2,
                entities: 12,
                times: range(-3000, 2000, 500),
                density: 0.5,
            },
        ]),
        dimensions: [slot(1), slot(2)],
    },
    {
        name: "identical coverage with duplicate rows",
        json: fromSpecs(
            [1, 2].map((id) => ({
                id,
                entities: 10,
                times: range(2000, 2010),
                duplicateRows: 2,
                seed: 7,
            }))
        ),
        dimensions: [slot(1), slot(2)],
    },
    {
        name: "aligned indicators where an entity's rows come back later",
        json: fromVariables([
            makeRawVariable(1, {
                entities: [1, 2, 1, 1],
                years: [2000, 2000, 2001, 2001],
            }),
            makeRawVariable(2, {
                entities: [1, 2, 1, 1],
                years: [2000, 2000, 2001, 2001],
            }),
        ]),
        dimensions: [slot(1), slot(2)],
    },
    {
        name: "aligned indicators with decreasing times",
        json: fromVariables([
            makeRawVariable(1, {
                entities: [1, 1, 2],
                years: [2001, 2000, 2000],
            }),
            makeRawVariable(2, {
                entities: [1, 1, 2],
                years: [2001, 2000, 2000],
            }),
        ]),
        dimensions: [slot(1), slot(2)],
    },
    {
        // The first indicator has as many duplicate rows as the second adds new
        // keys, so the result has as many rows as the first indicator
        name: "duplicates in the first indicator offset by new keys (years)",
        json: fromVariables([
            makeRawVariable(1, {
                entities: [1, 1, 1],
                years: [2000, 2000, 2001],
            }),
            makeRawVariable(2, { entities: [1], years: [2002] }),
        ]),
        dimensions: [slot(1), slot(2)],
    },
    {
        name: "duplicates in the first indicator offset by new keys (days)",
        json: fromVariables([
            makeRawVariable(
                1,
                { entities: [1, 1, 1], years: [5, 5, 6] },
                DAILY
            ),
            makeRawVariable(2, { entities: [1], years: [7] }, DAILY),
            makeRawVariable(3, { entities: [1], years: [2020] }),
        ]),
        dimensions: [slot(1), slot(2), slot(3)],
    },
]
