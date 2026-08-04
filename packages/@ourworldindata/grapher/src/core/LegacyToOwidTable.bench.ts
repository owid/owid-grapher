// Benchmarks for fullJoinTables(), the multi-table join at the heart of
// legacyToOwidTableAndDimensions(). Run with `yarn testBench`.
//
// The cases below mirror the shapes fullJoinTables() sees in production:
// - year variables joined on year+entity (by far the most common case)
// - sub-yearly (day/week/month) variables joined on day+entity
// - a mix of both, where the day+entity index is the primary one and lookups
//   into the year tables go through the year+entity and entity-only fallbacks
// - variables with a targetTime, which are joined on entity only

import * as _ from "lodash-es"
import { bench, describe } from "vitest"
import {
    ColumnTypeNames,
    DimensionProperty,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidTableSlugs,
    TimeInterval,
} from "@ourworldindata/types"
import { OwidTable } from "@ourworldindata/core-table"
import {
    EPOCH_DATE,
    getYearFromISOStringAndDayOffset,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
} from "@ourworldindata/utils"
import {
    buildVariableTable,
    fullJoinTables,
    JoinTable,
    legacyToOwidTableAndDimensionsWithMandatorySlug,
    owidTableToJoinTable,
} from "./LegacyToOwidTable"

const YEAR_INDEX = [OwidTableSlugs.Year, OwidTableSlugs.EntityId]
const DAY_INDEX = [OwidTableSlugs.Day, OwidTableSlugs.EntityId]
const ENTITY_INDEX = [OwidTableSlugs.EntityId]

/**
 * OwidTable computes its column store and columns lazily and memoizes them.
 * Benchmarks reuse the same tables across iterations, so we touch everything
 * once up front to measure the join itself rather than a one-off parse in the
 * first iteration.
 */
const warmTable = (table: OwidTable): OwidTable => {
    table.getColumns(table.columnSlugs).forEach((col) => col.values)
    return table
}

const entityIdsRange = (count: number, offset = 0): number[] =>
    _.range(offset + 1, offset + count + 1)

interface VariableOptions {
    variableId: number
    entityIds: number[]
    times: number[]
    timeInterval?: TimeInterval
}

/** Builds a legacy variable with one row per (entity, time) pair */
const makeVariable = ({
    variableId,
    entityIds,
    times,
    timeInterval = TimeInterval.Year,
}: VariableOptions): OwidVariableDataMetadataDimensions => {
    const entities: number[] = []
    const years: number[] = []
    const values: number[] = []
    for (const entityId of entityIds)
        for (const time of times) {
            entities.push(entityId)
            years.push(time)
            // deterministic, so runs are comparable
            values.push((entityId * 31 + time * 7) % 1000)
        }

    return {
        data: { entities, values, years },
        metadata: {
            id: variableId,
            display: { timeInterval },
            dimensions: {
                years: { values: [] },
                entities: {
                    values: entityIds.map((id) => ({
                        id,
                        name: `Country ${id}`,
                        code: `C${id.toString().padStart(3, "0")}`,
                    })),
                },
            },
        },
    }
}

/**
 * Builds a variable table with one row per (entity, time) pair, going through
 * the same buildVariableTable() the real code uses.
 */
const makeVariableTable = (options: VariableOptions): JoinTable =>
    owidTableToJoinTable(warmTable(buildVariableTable(makeVariable(options))))

/**
 * A variable with a targetTime, as produced for scatter/marimekko dimensions:
 * filtered down to a single time and with the time column dropped, so it can
 * only be joined on entity.
 */
const makeTargetTimeTable = ({
    variableId,
    entityIds,
    times,
    targetTime,
}: {
    variableId: number
    entityIds: number[]
    times: number[]
    targetTime: number
}): JoinTable => {
    const table = warmTable(
        buildVariableTable(makeVariable({ variableId, entityIds, times }))
    )
    return owidTableToJoinTable(
        warmTable(
            table
                .filterByTargetTimes([targetTime], 0)
                .interpolateColumnWithTolerance(variableId.toString(), {
                    toleranceOverride: 0,
                })
                .dropColumns([OwidTableSlugs.Year])
        )
    )
}

/**
 * Joins day tables together and derives a year column from the day column,
 * mirroring what legacyToOwidTableAndDimensions() does before joining the
 * result with the year based variables.
 */
const joinDaysAndFillYear = (dayTables: JoinTable[]): JoinTable => {
    const joined = fullJoinTables(dayTables, DAY_INDEX)
    const dayValues = joined.columnStore[OwidTableSlugs.Day]
    const getYearMemoized = _.memoize((day: number) =>
        getYearFromISOStringAndDayOffset(EPOCH_DATE, day)
    )
    const yearColumnDef: OwidColumnDef = {
        slug: OwidTableSlugs.Year,
        name: OwidTableSlugs.Year,
        type: ColumnTypeNames.Year,
    }
    return {
        columnStore: {
            ...joined.columnStore,
            [OwidTableSlugs.Year]: dayValues.map((day) =>
                getYearMemoized(day as number)
            ),
        },
        defs: [...joined.defs, yearColumnDef],
        numRows: joined.numRows,
    }
}

describe("fullJoinTables: year variables", () => {
    const smallTables = _.range(0, 3).map((i) =>
        makeVariableTable({
            variableId: 100 + i,
            entityIds: entityIdsRange(30),
            times: _.range(2000, 2025),
        })
    )
    // 6 variables × 200 entities × 60 years = 12k rows each
    const mediumTables = _.range(0, 6).map((i) =>
        makeVariableTable({
            variableId: 200 + i,
            entityIds: entityIdsRange(200),
            times: _.range(1960, 2020),
        })
    )
    // 12 variables × 250 entities × 120 years = 30k rows each
    const largeTables = _.range(0, 12).map((i) =>
        makeVariableTable({
            variableId: 300 + i,
            entityIds: entityIdsRange(250),
            times: _.range(1900, 2020),
        })
    )
    // Barely overlapping coverage: the union of all index values is far larger
    // than any single table, so most lookups miss and end up as
    // NoMatchingValueAfterJoin
    const raggedTables = _.range(0, 6).map((i) =>
        makeVariableTable({
            variableId: 400 + i,
            entityIds: entityIdsRange(120, i * 40),
            times: _.range(1950 + i * 15, 1950 + i * 15 + 40),
        })
    )

    bench("3 tables × 30 entities × 25 years", () => {
        fullJoinTables(smallTables, YEAR_INDEX)
    })

    bench("6 tables × 200 entities × 60 years", () => {
        fullJoinTables(mediumTables, YEAR_INDEX)
    })

    bench("12 tables × 250 entities × 120 years", () => {
        fullJoinTables(largeTables, YEAR_INDEX)
    })

    bench("6 tables with barely overlapping entities and years", () => {
        fullJoinTables(raggedTables, YEAR_INDEX)
    })
})

describe("fullJoinTables: sub-yearly variables", () => {
    // 3 variables × 60 entities × 2 years of daily data = 22k rows each
    const dayTables = _.range(0, 3).map((i) =>
        makeVariableTable({
            variableId: 500 + i,
            entityIds: entityIdsRange(60),
            times: _.range(18000, 18000 + 365 * 2),
            timeInterval: TimeInterval.Day,
        })
    )
    // Daily, weekly and monthly variables all end up in the day column, but at
    // different granularities, so their index values only partially overlap
    const mixedIntervalTables = [
        makeVariableTable({
            variableId: 600,
            entityIds: entityIdsRange(60),
            times: _.range(18000, 18000 + 365 * 2),
            timeInterval: TimeInterval.Day,
        }),
        makeVariableTable({
            variableId: 601,
            entityIds: entityIdsRange(60),
            times: _.range(18000, 18000 + 365 * 2, 7),
            timeInterval: TimeInterval.Week,
        }),
        makeVariableTable({
            variableId: 602,
            entityIds: entityIdsRange(60),
            // a 32 day step never lands twice in the same month, so no two
            // rows snap onto the same month start
            times: _.range(18000, 18000 + 365 * 2, 32),
            timeInterval: TimeInterval.Month,
        }),
    ]

    bench("3 day tables × 60 entities × 730 days", () => {
        fullJoinTables(dayTables, DAY_INDEX)
    })

    bench("day + week + month tables × 60 entities × 730 days", () => {
        fullJoinTables(mixedIntervalTables, DAY_INDEX)
    })
})

describe("fullJoinTables: mixed day and year variables", () => {
    const entityIds = entityIdsRange(60)
    const dayTimes = _.range(18000, 18000 + 365 * 2)
    const joinedDays = joinDaysAndFillYear(
        _.range(0, 2).map((i) =>
            makeVariableTable({
                variableId: 700 + i,
                entityIds,
                times: dayTimes,
                timeInterval: TimeInterval.Day,
            })
        )
    )
    const yearTables = _.range(0, 3).map((i) =>
        makeVariableTable({
            variableId: 800 + i,
            entityIds,
            times: _.range(1960, 2025),
        })
    )
    // A continents-style variable with data for a single year only: no lookup
    // by day+entity or year+entity can hit, so every row falls through to the
    // entity-only fallback
    const singleYearTable = makeVariableTable({
        variableId: 900,
        entityIds,
        times: [2015],
    })
    const fallbacks = [
        [OwidTableSlugs.Year, OwidTableSlugs.EntityId],
        [OwidTableSlugs.EntityId],
    ]

    bench("2 day tables + 3 year tables (year+entity fallback)", () => {
        fullJoinTables([joinedDays, ...yearTables], DAY_INDEX, fallbacks)
    })

    bench("2 day tables + single-year table (entity-only fallback)", () => {
        fullJoinTables([joinedDays, singleYearTable], DAY_INDEX, fallbacks)
    })

    bench("2 day tables + 3 year tables + single-year table", () => {
        fullJoinTables(
            [joinedDays, ...yearTables, singleYearTable],
            DAY_INDEX,
            fallbacks
        )
    })
})

describe("fullJoinTables: variables with a targetTime", () => {
    const entityIds = entityIdsRange(200)
    const times = _.range(1960, 2020)
    const yearTables = _.range(0, 3).map((i) =>
        makeVariableTable({ variableId: 1000 + i, entityIds, times })
    )
    const joinedYears = fullJoinTables(yearTables, YEAR_INDEX)
    const targetTimeTables = _.range(0, 2).map((i) =>
        makeTargetTimeTable({
            variableId: 1100 + i,
            entityIds,
            times,
            targetTime: 2010,
        })
    )

    bench("2 targetTime tables joined on entity only", () => {
        fullJoinTables(targetTimeTables, ENTITY_INDEX)
    })

    bench("joined year table + 2 targetTime tables", () => {
        fullJoinTables([joinedYears, ...targetTimeTables], YEAR_INDEX, [
            ENTITY_INDEX,
        ])
    })
})

describe("legacyToOwidTableAndDimensions: end to end", () => {
    const yDimensions = (
        variables: OwidVariableDataMetadataDimensions[],
        targetYear?: number
    ): OwidChartDimensionInterface[] =>
        variables.map((variable) => ({
            variableId: variable.metadata.id,
            property: DimensionProperty.y,
            targetYear,
        }))
    const varMap = (
        variables: OwidVariableDataMetadataDimensions[]
    ): MultipleOwidVariableDataDimensionsMap =>
        new Map(variables.map((variable) => [variable.metadata.id, variable]))
    const selectedEntityColors = { "Country 1": "#f00", "Country 2": "#0f0" }

    const yearVariables = _.range(0, 6).map((i) =>
        makeVariable({
            variableId: 2000 + i,
            entityIds: entityIdsRange(200),
            times: _.range(1960, 2020),
        })
    )
    const largeYearVariables = _.range(0, 12).map((i) =>
        makeVariable({
            variableId: 2100 + i,
            entityIds: entityIdsRange(250),
            times: _.range(1900, 2020),
        })
    )
    const dayVariables = _.range(0, 2).map((i) =>
        makeVariable({
            variableId: 2200 + i,
            entityIds: entityIdsRange(60),
            times: _.range(18000, 18000 + 365 * 2),
            timeInterval: TimeInterval.Day,
        })
    )
    const mixedYearVariables = _.range(0, 3).map((i) =>
        makeVariable({
            variableId: 2210 + i,
            entityIds: entityIdsRange(60),
            times: _.range(1960, 2025),
        })
    )
    // Monthly values arrive as representative days and get snapped to the
    // month start when the table is built
    const monthlyVariables = _.range(0, 3).map((i) =>
        makeVariable({
            variableId: 2300 + i,
            entityIds: entityIdsRange(60),
            times: _.range(18000 + i, 18000 + i + 365 * 4, 32),
            timeInterval: TimeInterval.Month,
        })
    )
    const scatterVariables = _.range(0, 2).map((i) =>
        makeVariable({
            variableId: 2400 + i,
            entityIds: entityIdsRange(200),
            times: _.range(1960, 2020),
        })
    )
    const scatterTargetTimeVariables = _.range(0, 2).map((i) =>
        makeVariable({
            variableId: 2410 + i,
            entityIds: entityIdsRange(200),
            times: _.range(1960, 2020),
        })
    )

    bench("6 year variables × 200 entities × 60 years", () => {
        legacyToOwidTableAndDimensionsWithMandatorySlug(
            varMap(yearVariables),
            yDimensions(yearVariables),
            selectedEntityColors
        )
    })

    bench("12 year variables × 250 entities × 120 years", () => {
        legacyToOwidTableAndDimensionsWithMandatorySlug(
            varMap(largeYearVariables),
            yDimensions(largeYearVariables),
            selectedEntityColors
        )
    })

    bench("2 day variables + 3 year variables", () => {
        const variables = [...dayVariables, ...mixedYearVariables]
        legacyToOwidTableAndDimensionsWithMandatorySlug(
            varMap(variables),
            yDimensions(variables),
            selectedEntityColors
        )
    })

    bench("3 monthly variables × 60 entities × 4 years", () => {
        legacyToOwidTableAndDimensionsWithMandatorySlug(
            varMap(monthlyVariables),
            yDimensions(monthlyVariables),
            selectedEntityColors
        )
    })

    bench("scatter: 2 year variables + 2 targetTime variables", () => {
        const variables = [...scatterVariables, ...scatterTargetTimeVariables]
        legacyToOwidTableAndDimensionsWithMandatorySlug(
            varMap(variables),
            [
                ...yDimensions(scatterVariables),
                ...yDimensions(scatterTargetTimeVariables, 2010),
            ],
            selectedEntityColors
        )
    })
})
