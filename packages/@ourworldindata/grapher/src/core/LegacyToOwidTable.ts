/**
 * Converts and combines our fetched indicator data & metadata files into an OwidTable.
 *
 * This involves simple steps like resolving the entity names and parsing annotations,
 * but crucially also involves joining multiple indicators together. This becomes
 * especially complex when there are both daily and yearly indicators, because they
 * need to be aligned and joined correctly.
 *
 * Performance note: This code runs for every grapher chart, and at times handles >100k rows
 * across many columns, so it needs to be written with performance in mind.
 * There are many choices in this code already: We operate on "frames", which are just very basic
 * multi-column objects, for a long time until we convert them to a OwidTable at the very end.
 * We also use efficient Int32Arrays for indexing rows inside joins.
 */

import * as _ from "lodash-es"
import {
    ColumnTypeNames,
    CoreValueType,
    IndicatorDimensionInterface,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidEntityIdColumnDef,
    OwidEntityNameColumnDef,
    OwidTableSlugs,
    OwidVariableDisplayConfigInterface,
    SelectedEntityColors,
    Time,
    TimeInterval,
    isIndicatorDimension,
} from "@ourworldindata/types"
import {
    ErrorValueTypes,
    OwidTable,
    makeOriginalTimeSlugFromColumnSlug,
} from "@ourworldindata/core-table"
import {
    ColumnSlug,
    EPOCH_DATE,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableWithSource,
    OwidVariableWithSourceAndDimension,
    dayjs,
    diffDatesInDays,
    epochDate,
    findClosestTimeIndex,
    findFinestCommonTimeInterval,
    getTimeInterval,
    getYearFromDaysSinceEpoch,
    isSubYearly,
    snapToIntervalStart,
    trimObject,
} from "@ourworldindata/utils"
import { getIndicatorColumnSlug } from "../chart/ChartDimension.js"
import { makeEntityColorColumn } from "./appendSelectedEntityColors.js"
import { mergeDisplayIntoDef } from "./applyDisplayAndConversionFactor.js"
import {
    EMPTY_FRAME,
    Frame,
    FrameColumn,
    findColumn,
    frameToTable,
    fullJoin,
    leftJoinWithFallbacks,
} from "./FrameJoin.js"
import { columnDefFromOwidVariable } from "./indicatorColumnDef.js"

// A frame, with some indicator metadata attached
interface IndicatorFrame {
    frame: Frame
    interval: TimeInterval
    timeColumnSlug: OwidTableSlugs.Day | OwidTableSlugs.Year
    valueColumnSlug: ColumnSlug
}

// Indicators grouped by their interval, and whether they have a targetTime set
interface IndicatorBuckets {
    dayFrames: IndicatorFrame[]
    yearFrames: IndicatorFrame[]
    /** Variables pinned to a target time; joined on entity only */
    targetTimeFrames: Frame[]
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export const legacyToOwidTableAndDimensions = (
    json: MultipleOwidVariableDataDimensionsMap,
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors: SelectedEntityColors | undefined
): OwidTable => {
    const buckets = buildIndicatorBuckets(json, dimensions)
    let joined = joinIndicatorBuckets(buckets)

    // The output table can mix both `day` and `year` columns, and we want to relabel
    // both to their interval (for example `day` -> "Week")
    joined = withFinestTimeColumnInterval(
        joined,
        buckets.dayFrames,
        OwidTableSlugs.Day
    )
    joined = withFinestTimeColumnInterval(
        joined,
        buckets.yearFrames,
        OwidTableSlugs.Year
    )

    return frameToTable(
        appendDerivedColumns(joined, json, selectedEntityColors)
    )
}

// ---------------------------------------------------------------------------
// High-level assembly steps
// ---------------------------------------------------------------------------

/** Builds one frame per unique [variable, targetTime] dimension and buckets them */
const buildIndicatorBuckets = (
    json: MultipleOwidVariableDataDimensionsMap,
    dimensions: OwidChartDimensionInterface[]
): IndicatorBuckets => {
    const indicatorDimensions = _.uniqBy(
        dimensions.filter(isIndicatorDimension),
        getIndicatorColumnSlug
    )

    const dayFrames: IndicatorFrame[] = []
    const yearFrames: IndicatorFrame[] = []
    const targetTimeFrames: Frame[] = []

    for (const dimension of indicatorDimensions) {
        const variable = json.get(dimension.variableId)
        // Shouldn't happen, but does when adding dimensions in the chart editor
        if (!variable) continue

        const variableFrame = buildIndicatorFrame(variable, dimension)
        const { targetYear } = dimension
        if (typeof targetYear === "number")
            targetTimeFrames.push(pinToTargetTime(variableFrame, targetYear))
        else if (isSubYearly(variableFrame.interval))
            dayFrames.push(variableFrame)
        else yearFrames.push(variableFrame)
    }

    return { dayFrames, yearFrames, targetTimeFrames }
}

/**
 * Joins the day, year, and target-time buckets into a single frame.
 *
 * When both day-based and year-based variables are present, day+entity is the
 * primary index. Each year-based variable is attached by year+entity (deriving
 * year from day), falling back to entity alone so static variables like
 * continents (which only have a single year) still attach to every day.
 *
 * Caveat: entities that only occur in year-based variables are dropped (e.g.
 * Antarctica from the continents variable, if no daily variable has data for
 * it).
 */
const joinIndicatorBuckets = ({
    dayFrames,
    yearFrames,
    targetTimeFrames,
}: IndicatorBuckets): Frame => {
    let joined: Frame
    let primaryTimeSlug: OwidTableSlugs.Day | OwidTableSlugs.Year

    if (dayFrames.length > 0) {
        const joinedByDay = fullJoin(
            dayFrames.map((v) => v.frame),
            [OwidTableSlugs.Day, OwidTableSlugs.EntityId]
        )
        joined =
            yearFrames.length > 0
                ? leftJoinWithFallbacks(
                      withYearDerivedFromDay(joinedByDay),
                      yearFrames.map((v) => v.frame),
                      [OwidTableSlugs.Day, OwidTableSlugs.EntityId],
                      [
                          [OwidTableSlugs.Year, OwidTableSlugs.EntityId],
                          [OwidTableSlugs.EntityId],
                      ]
                  )
                : joinedByDay
        primaryTimeSlug = OwidTableSlugs.Day
    } else if (yearFrames.length > 0) {
        joined = fullJoin(
            yearFrames.map((v) => v.frame),
            [OwidTableSlugs.Year, OwidTableSlugs.EntityId]
        )
        primaryTimeSlug = OwidTableSlugs.Year
    } else {
        joined = EMPTY_FRAME
        primaryTimeSlug = OwidTableSlugs.Day
    }

    if (targetTimeFrames.length > 0)
        joined = leftJoinWithFallbacks(
            joined,
            targetTimeFrames,
            [primaryTimeSlug, OwidTableSlugs.EntityId],
            [[OwidTableSlugs.EntityId]]
        )

    return joined
}

/**
 * Attaches `entityName`, the canonical `time` column, and optional
 * `entityColor` column to the joined frame.
 */
const appendDerivedColumns = (
    frame: Frame,
    json: MultipleOwidVariableDataDimensionsMap,
    selectedEntityColors: SelectedEntityColors | undefined
): Frame => {
    // Entity ids and names map one to one, so joins only carry ids, and names
    // are looked up once for the final joined rows
    const entityIdColumn = findColumn(frame, OwidTableSlugs.EntityId)
    const entityNames = entityIdColumn
        ? lookupEntityNames(json, entityIdColumn.values as number[])
        : []
    const entityNameColumns: FrameColumn[] = entityIdColumn
        ? [{ def: OwidEntityNameColumnDef, values: entityNames }]
        : []

    const extraColumns: FrameColumn[] = []
    const timeSource =
        findColumn(frame, OwidTableSlugs.Day) ??
        findColumn(frame, OwidTableSlugs.Year)
    if (timeSource)
        extraColumns.push({
            def: {
                ...timeSource.def,
                slug: OwidTableSlugs.Time,
                name: OwidTableSlugs.Time,
            },
            values: timeSource.values,
        })

    if (!_.isEmpty(selectedEntityColors))
        extraColumns.push(
            makeEntityColorColumn(entityNames, selectedEntityColors)
        )

    return {
        columns: [...entityNameColumns, ...frame.columns, ...extraColumns],
        numRows: frame.numRows,
    }
}

// ---------------------------------------------------------------------------
// Per-variable frames
// ---------------------------------------------------------------------------

/**
 * The name of each entity id, from the variables' metadata JSON file.
 *
 * While it shouldn't happen much, the data and metadata files could in theory be slightly
 * out of sync, and thus an entity name might be missing from the metadata file.
 * In that case, we simply fall back to the stringified ID as the entity name.
 */
const lookupEntityNames = (
    json: MultipleOwidVariableDataDimensionsMap,
    entityIds: readonly number[]
): string[] => {
    // Later variables win
    const nameById = new Map<number, string | undefined>()
    for (const variable of json.values())
        for (const entity of variable.metadata.dimensions.entities.values)
            nameById.set(entity.id, entity.name)

    const names: string[] = new Array(entityIds.length)
    for (let row = 0; row < entityIds.length; row++) {
        const id = entityIds[row]
        names[row] = nameById.get(id) ?? id.toString()
    }
    return names
}

const buildIndicatorFrame = (
    variable: OwidVariableDataMetadataDimensions,
    dimension: IndicatorDimensionInterface
): IndicatorFrame => {
    const { metadata, data } = variable
    const interval = getTimeInterval(metadata.display)
    const timeDef = TIME_COLUMN_DEF_BY_INTERVAL[interval]
    const timeColumnSlug = timeDef.slug
    const valueColumn = buildValueColumn(metadata, dimension, data.values ?? [])

    const entityIds = data.entities ?? []
    const numRows = entityIds.length
    const parsedIds: CoreValueType[] = new Array(numRows)
    for (let i = 0; i < numRows; i++) parsedIds[i] = parseNumber(entityIds[i])

    return {
        interval,
        timeColumnSlug,
        valueColumnSlug: valueColumn.def.slug,
        frame: {
            columns: [
                { def: OwidEntityIdColumnDef, values: parsedIds },
                {
                    def: timeDef,
                    values: timeValuesFromOwidVariable(
                        metadata,
                        data.years ?? []
                    ),
                },
                valueColumn,
            ],
            numRows,
        },
    }
}

const buildValueColumn = (
    metadata: OwidVariableWithSourceAndDimension,
    dimension: IndicatorDimensionInterface,
    rawValues: CoreValueType[]
): FrameColumn => {
    let def: OwidColumnDef = {
        ...columnDefFromOwidVariable(metadata),
        slug: getIndicatorColumnSlug(dimension),
        // Database columns can contain mixed types, so we don't parse values
        skipParsing: true,
    }
    def.display = trimObject(def.display)
    if (dimension.targetYear !== undefined)
        def.targetTime = dimension.targetYear

    const display = trimObject({
        conversionFactor: metadata.display?.conversionFactor,
        ...trimObject(dimension.display ?? {}),
    }) as OwidVariableDisplayConfigInterface

    let values = rawValues
    if (!_.isEmpty(display)) {
        def = mergeDisplayIntoDef(def, display)
        // Scale before joining, so values repeated across joined rows are
        // only converted once
        const { conversionFactor } = display
        if (conversionFactor !== undefined && conversionFactor !== 1)
            values = values.map((value) =>
                typeof value === "number" ? value * conversionFactor : value
            )
    }

    return { def, values }
}

/**
 * Keeps only the rows at (or, given the value column's tolerance, closest to)
 * the target time, and swaps the time column for an "originalTime" column, so
 * that the frame can be joined on entity alone.
 */
const pinToTargetTime = (
    variableFrame: IndicatorFrame,
    targetTime: Time
): Frame => {
    const { frame, timeColumnSlug, valueColumnSlug } = variableFrame
    const entityIdColumn = findColumn(frame, OwidTableSlugs.EntityId)!
    const timeColumn = findColumn(frame, timeColumnSlug)!
    const valueColumn = findColumn(frame, valueColumnSlug)!

    const tolerance =
        valueColumn.def.display?.tolerance ?? valueColumn.def.tolerance ?? 0
    const keptRows = findRowsMatchingTargetTime(
        entityIdColumn.values,
        timeColumn.values as number[],
        targetTime,
        tolerance
    )
    const take = (values: CoreValueType[]): CoreValueType[] =>
        keptRows.map((row) => values[row])

    return {
        columns: [
            ...frame.columns
                .filter((column) => column !== timeColumn)
                .map((column) => ({
                    def: column.def,
                    values: take(column.values),
                })),
            {
                def: {
                    ...timeColumn.def,
                    slug: makeOriginalTimeSlugFromColumnSlug(valueColumnSlug),
                    display: { includeInTable: false },
                    derivedFrom: {
                        columnSlug: valueColumnSlug,
                        relationship: "originalTime",
                    },
                },
                values: take(timeColumn.values),
            },
        ],
        numRows: keptRows.length,
    }
}

const findRowsMatchingTargetTime = (
    entityIds: CoreValueType[],
    times: number[],
    targetTime: Time,
    tolerance: number
): number[] => {
    if (tolerance === 0) {
        const rows: number[] = []
        for (let row = 0; row < times.length; row++)
            if (times[row] === targetTime) rows.push(row)
        return rows
    }

    // For each entity, find the row closest to the target time within tolerance
    const rowsByEntity = new Map<CoreValueType, number[]>()
    for (let row = 0; row < times.length; row++) {
        const entityId = entityIds[row]
        const rows = rowsByEntity.get(entityId)
        if (rows) rows.push(row)
        else rowsByEntity.set(entityId, [row])
    }

    const keptRowSet = new Set<number>()
    for (const rows of rowsByEntity.values()) {
        const sortedRows = rows.sort((a, b) => times[a] - times[b])
        const index = findClosestTimeIndex(
            sortedRows.map((row) => times[row]),
            targetTime,
            tolerance
        )
        if (index !== undefined) keptRowSet.add(sortedRows[index])
    }

    // Preserve original row order
    const keptRows: number[] = []
    for (let row = 0; row < times.length; row++)
        if (keptRowSet.has(row)) keptRows.push(row)
    return keptRows
}

/** Appends a year column, computed from the frame's day column */
const withYearDerivedFromDay = (frame: Frame): Frame => {
    const dayColumn = findColumn(frame, OwidTableSlugs.Day)
    if (!dayColumn) return frame

    const yearByDay = new Map<number, number>()
    const years = dayColumn.values.map((day) => {
        let year = yearByDay.get(day as number)
        if (year === undefined) {
            year = getYearFromDaysSinceEpoch(day as number)
            yearByDay.set(day as number, year)
        }
        return year
    })

    return {
        columns: [
            ...frame.columns,
            // Deliberately untyped, matching what this column always was
            {
                def: { slug: OwidTableSlugs.Year, name: OwidTableSlugs.Year },
                values: years,
            },
        ],
        numRows: frame.numRows,
        uniqueKey: frame.uniqueKey,
    }
}

/**
 * Relabels the joined time column with the finest interval that can represent
 * every joined variable's times.
 * For example, if one indicator is monthly and another one is quarterly, then
 * the whole `day` column gets labelled as "Month".
 */
const withFinestTimeColumnInterval = (
    frame: Frame,
    variableFrames: IndicatorFrame[],
    slug: OwidTableSlugs.Day | OwidTableSlugs.Year
): Frame => {
    if (variableFrames.length <= 1) return frame

    const intervals = variableFrames.map((v) => v.interval)
    if (new Set(intervals).size < 2) return frame
    const timeDef =
        TIME_COLUMN_DEF_BY_INTERVAL[findFinestCommonTimeInterval(intervals)]
    return {
        ...frame,
        columns: frame.columns.map((column) =>
            column.def.slug === slug
                ? { ...column, def: { ...column.def, ...timeDef } }
                : column
        ),
    }
}

// ---------------------------------------------------------------------------
// Parsing, matching what OwidTable does for untyped input
// ---------------------------------------------------------------------------

const parseNumber = (value: unknown): CoreValueType => {
    if (typeof value === "number" && !Number.isNaN(value)) return value
    if (value === null) return ErrorValueTypes.NullButShouldBeNumber
    if (value === undefined) return ErrorValueTypes.UndefinedButShouldBeNumber
    if (value === "") return ErrorValueTypes.BlankButShouldBeNumber
    if (Number.isNaN(Number(value))) return ErrorValueTypes.NaNButShouldBeNumber
    const parsed = parseFloat(String(value))
    return Number.isNaN(parsed)
        ? ErrorValueTypes.NotAParseableNumberButShouldBeNumber
        : parsed
}

const parseTime = (value: number): number =>
    Number.isInteger(value) ? value : parseInt(String(value))

// ---------------------------------------------------------------------------
// Time columns
// ---------------------------------------------------------------------------

// Maps each time interval to the time column it produces. Sub-yearly intervals
// all share the `day` slug (days-since-epoch) so they join in the same bucket
const TIME_COLUMN_DEF_BY_INTERVAL = {
    [TimeInterval.Day]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Day,
        name: "Day",
    },
    [TimeInterval.Week]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Week,
        name: "Week",
    },
    [TimeInterval.Month]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Month,
        name: "Month",
    },
    [TimeInterval.Quarter]: {
        slug: OwidTableSlugs.Day,
        type: ColumnTypeNames.Quarter,
        name: "Quarter",
    },
    [TimeInterval.Year]: {
        slug: OwidTableSlugs.Year,
        type: ColumnTypeNames.Year,
        name: "Year",
    },
    [TimeInterval.Decade]: {
        slug: OwidTableSlugs.Year,
        type: ColumnTypeNames.Decade,
        name: "Decade",
    },
} as const satisfies Record<TimeInterval, OwidColumnDef>

const timeValuesFromOwidVariable = (
    metadata: OwidVariableWithSource,
    years: number[]
): number[] => {
    const { display } = metadata
    const interval = getTimeInterval(display)
    if (!isSubYearly(interval)) return years.map(parseTime)

    // Day-encoded values might specify a custom zeroDay for the indicator; shift them
    // onto the shared EPOCH_DATE so that variables are comparable
    const zeroDay = display?.zeroDay
    const offset =
        zeroDay !== undefined && zeroDay !== EPOCH_DATE
            ? diffDatesInDays(dayjs.utc(zeroDay), epochDate())
            : 0

    if (interval === TimeInterval.Day)
        return years.map((year) => parseTime(year + offset))

    // Snap sub-yearly values (except days) to the start of their period,
    // so that variables that pick different representative days for the same
    // period still align
    return years.map((year) =>
        parseTime(snapToIntervalStart(year + offset, interval))
    )
}
