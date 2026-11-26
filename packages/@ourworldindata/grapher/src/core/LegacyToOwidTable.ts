// Turns the variable data + metadata we fetch from our data API into the
// single OwidTable that a chart renders from.
//
// Performance notes: this runs on every chart load and its input can be
// hundreds of thousands of rows (daily indicators), so the per-variable tables
// and the joins between them are built on plain column arrays (see FrameJoin).
// Only the final result becomes an OwidTable, constructed from typed values so
// it never needs to parse anything.

import * as _ from "lodash-es"
import {
    AnnotationTimeScope,
    ColumnTypeNames,
    CoreValueType,
    EntityName,
    ErrorValue,
    IndicatorAnnotation,
    IndicatorDimensionInterface,
    OwidChartDimensionInterface,
    OwidColumnDef,
    OwidEntityIdColumnDef,
    OwidEntityNameColumnDef,
    OwidTableSlugs,
    OwidVariableAnnotation,
    OwidVariableDimensions,
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
    OwidVariableType,
    OwidVariableWithSource,
    OwidVariableWithSourceAndDimension,
    convertDateToDaysSinceEpoch,
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
import { isContinentsVariableId } from "./GrapherConstants"
import { getIndicatorColumnSlug } from "../chart/ChartDimension.js"
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

interface VariableFrame {
    frame: Frame
    interval: TimeInterval
    timeSlug: OwidTableSlugs.Day | OwidTableSlugs.Year
    valueSlug: ColumnSlug
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

export const legacyToOwidTableAndDimensions = (
    json: MultipleOwidVariableDataDimensionsMap,
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors: SelectedEntityColors | undefined
): OwidTable => {
    const lookupEntityName = makeEntityNameLookup(json)

    // One column per unique [variable, targetTime] pair, so a variable can
    // contribute several columns
    const indicatorDimensions = _.uniqBy(
        dimensions.filter(isIndicatorDimension),
        getIndicatorColumnSlug
    )

    const yearFrames: VariableFrame[] = []
    const dayFrames: VariableFrame[] = []
    // Variables pinned to a target time; joined on entity only
    const targetTimeFrames: Frame[] = []

    for (const dimension of indicatorDimensions) {
        const variable = json.get(dimension.variableId)
        // Shouldn't happen, but does when adding dimensions in the chart editor
        if (!variable) continue

        const variableFrame = buildVariableFrame(
            variable,
            dimension,
            lookupEntityName
        )
        const { targetYear } = dimension
        if (typeof targetYear === "number")
            targetTimeFrames.push(pinToTargetTime(variableFrame, targetYear))
        else if (isSubYearly(variableFrame.interval))
            dayFrames.push(variableFrame)
        else yearFrames.push(variableFrame)
    }

    let joined: Frame
    let primaryTimeSlug: OwidTableSlugs.Day | OwidTableSlugs.Year
    if (dayFrames.length > 0) {
        const joinedByDay = fullJoin(
            dayFrames.map((v) => v.frame),
            [OwidTableSlugs.Day, OwidTableSlugs.EntityId]
        )
        // When both day-based and year-based variables are present, day+entity
        // is the primary index. Each year-based variable is attached by
        // year+entity (deriving year from day), falling back to entity alone so
        // static variables like continents (which only have a single year) still
        // attach to every day.
        //
        // Caveat: entities that only occur in year-based variables are dropped
        // (e.g. Antarctica from the continents variable, if no daily variable
        // has data for it).
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

    // A bucket can hold several intervals (e.g. a daily and a monthly
    // indicator both live in the day bucket), but the joined table has a
    // single time column, which should be tagged with the finest of them
    joined = withFinestTimeColumnInterval(joined, dayFrames, OwidTableSlugs.Day)
    joined = withFinestTimeColumnInterval(
        joined,
        yearFrames,
        OwidTableSlugs.Year
    )

    // Inject the canonical "time" column, e.g. used for the timeline
    const timeSource =
        findColumn(joined, OwidTableSlugs.Day) ??
        findColumn(joined, OwidTableSlugs.Year)
    const extraColumns: FrameColumn[] = []
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
            makeEntityColorColumn(
                findColumn(joined, OwidTableSlugs.EntityName)?.values ?? [],
                selectedEntityColors
            )
        )

    return frameToTable({
        columns: [...joined.columns, ...extraColumns],
        numRows: joined.numRows,
    })
}

/** Adds the entity color column that applies a config's `selectedEntityColors` */
export const appendSelectedEntityColors = (
    table: OwidTable,
    selectedEntityColors: SelectedEntityColors | undefined
): OwidTable => {
    if (_.isEmpty(selectedEntityColors)) return table
    const { def, values } = makeEntityColorColumn(
        table.entityNameColumn.valuesIncludingErrorValues,
        selectedEntityColors
    )
    return table.appendColumns([{ ...def, values }])
}

const makeEntityColorColumn = (
    entityNames: readonly CoreValueType[],
    selectedEntityColors: SelectedEntityColors | undefined
): FrameColumn => ({
    def: {
        slug: OwidTableSlugs.EntityColor,
        name: OwidTableSlugs.EntityColor,
        type: ColumnTypeNames.Color,
    },
    values: entityNames.map(
        (entityName): string | ErrorValue =>
            (entityName
                ? selectedEntityColors?.[entityName as EntityName]
                : undefined) ?? ErrorValueTypes.UndefinedButShouldBeString
    ),
})

// ---------------------------------------------------------------------------
// Per-variable frames
// ---------------------------------------------------------------------------

/**
 * Resolves entity ids to their (already parsed) name, caching per id.
 *
 * Data comes from S3 and metadata from MySQL, so an id can be missing from the
 * metadata; such entities are named after their id.
 */
const makeEntityNameLookup = (
    json: MultipleOwidVariableDataDimensionsMap
): ((id: number) => CoreValueType) => {
    // Later variables win, matching the previous object-based lookup
    const metaNameById = new Map<string, string | undefined>()
    for (const variable of json.values())
        for (const entity of variable.metadata.dimensions.entities.values)
            metaNameById.set(entity.id.toString(), entity.name)

    const cache = new Map<number, CoreValueType>()
    return (id: number): CoreValueType => {
        let name = cache.get(id)
        if (name === undefined) {
            name = parseString(metaNameById.get(String(id)) ?? id.toString())
            cache.set(id, name)
        }
        return name
    }
}

const buildVariableFrame = (
    variable: OwidVariableDataMetadataDimensions,
    dimension: IndicatorDimensionInterface,
    lookupEntityName: (id: number) => CoreValueType
): VariableFrame => {
    const { metadata, data } = variable
    const interval = getTimeInterval(metadata.display)
    const timeDef = TIME_COLUMN_DEF_BY_INTERVAL[interval]
    const timeSlug = timeDef.slug as OwidTableSlugs.Day | OwidTableSlugs.Year
    const valueColumn = buildValueColumn(metadata, dimension, data.values ?? [])

    const entityIds = data.entities ?? []
    const numRows = entityIds.length
    const parsedIds: CoreValueType[] = []
    const names: CoreValueType[] = []
    for (let i = 0; i < numRows; i++) {
        const id = entityIds[i]
        parsedIds.push(parseNumber(id))
        names.push(lookupEntityName(id))
    }

    return {
        interval,
        timeSlug,
        valueSlug: valueColumn.def.slug,
        frame: {
            columns: [
                { def: OwidEntityNameColumnDef, values: names },
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
    variableFrame: VariableFrame,
    targetTime: Time
): Frame => {
    const { frame, timeSlug, valueSlug } = variableFrame
    const nameColumn = findColumn(frame, OwidTableSlugs.EntityName)!
    const timeColumn = findColumn(frame, timeSlug)!
    const valueColumn = findColumn(frame, valueSlug)!

    const tolerance =
        valueColumn.def.display?.tolerance ?? valueColumn.def.tolerance ?? 0
    const keptRows = findRowsMatchingTargetTime(
        nameColumn.values,
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
                    slug: makeOriginalTimeSlugFromColumnSlug(valueSlug),
                    display: { includeInTable: false },
                    derivedFrom: {
                        columnSlug: valueSlug,
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
    entityNames: CoreValueType[],
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
        const name = entityNames[row]
        const rows = rowsByEntity.get(name)
        if (rows) rows.push(row)
        else rowsByEntity.set(name, [row])
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

/** Appends a year column, derived from the frame's day column */
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
 * every joined variable's times
 */
const withFinestTimeColumnInterval = (
    frame: Frame,
    variableFrames: VariableFrame[],
    slug: OwidTableSlugs.Day | OwidTableSlugs.Year
): Frame => {
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

const parseString = (value: unknown): CoreValueType => {
    if (value === null) return ErrorValueTypes.NullButShouldBeString
    if (value === undefined) return ErrorValueTypes.UndefinedButShouldBeString
    return String(value)
}

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
const TIME_COLUMN_DEF_BY_INTERVAL: Record<TimeInterval, OwidColumnDef> = {
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
}

const timeValuesFromOwidVariable = (
    metadata: OwidVariableWithSource,
    years: number[]
): number[] => {
    const { display } = metadata
    const interval = getTimeInterval(display)
    if (!isSubYearly(interval)) return years.map(parseTime)

    // Day-encoded values are relative to the variable's zeroDay; shift them
    // onto the shared EPOCH_DATE so that variables are comparable
    const zeroDay = display?.zeroDay
    const offset =
        zeroDay !== undefined && zeroDay !== EPOCH_DATE
            ? diffDatesInDays(dayjs.utc(zeroDay), epochDate())
            : 0

    // Snap sub-yearly values (except plain days) to the start of their
    // period, so that variables that pick different representative days for
    // the same period still align
    if (interval === TimeInterval.Day)
        return years.map((year) => parseTime(year + offset))
    return years.map((year) =>
        parseTime(snapToIntervalStart(year + offset, interval))
    )
}

// ---------------------------------------------------------------------------
// Column defs
// ---------------------------------------------------------------------------

const variableTypeToColumnType = (type: OwidVariableType): ColumnTypeNames => {
    switch (type) {
        case "ordinal":
            return ColumnTypeNames.Ordinal
        case "string":
            return ColumnTypeNames.String
        case "int":
            return ColumnTypeNames.Integer
        case "float":
            return ColumnTypeNames.Numeric
        case "mixed":
        default:
            return ColumnTypeNames.NumberOrString
    }
}

/** The sort order of an ordinal variable's categories, e.g. Low, Medium, High */
const getSortFromDimensions = (
    dimensions: OwidVariableDimensions
): string[] | undefined => {
    const sort = dimensions.values?.values
        ?.map((value) => value.name)
        .filter((name) => name !== undefined)
    return sort?.length ? sort : undefined
}

const columnDefFromOwidVariable = (
    variable: OwidVariableWithSourceAndDimension
): OwidColumnDef => {
    const { source, display } = variable
    const parsedType = variable.type
        ? variableTypeToColumnType(variable.type)
        : ColumnTypeNames.NumberOrString

    return {
        name: variable.name,
        slug: variable.id.toString(),
        unit: variable.unit,
        shortUnit: variable.shortUnit,
        description: variable.description,
        descriptionShort: variable.descriptionShort,
        descriptionProcessing: variable.descriptionProcessing,
        descriptionKey: variable.descriptionKey,
        descriptionFromProducer: variable.descriptionFromProducer,
        coverage: variable.coverage,
        datasetId: variable.datasetId,
        datasetName: variable.datasetName,
        display,
        color: display?.color,
        nonRedistributable: variable.nonRedistributable,
        sourceLink: source?.link,
        sourceName: source?.name,
        dataPublishedBy: source?.dataPublishedBy,
        dataPublisherSource: source?.dataPublisherSource,
        retrievedDate: source?.retrievedDate,
        additionalInfo: source?.additionalInfo,
        timespan: variable.timespan,
        origins: variable.origins,
        annotations: parseIndicatorAnnotations(variable),
        presentation: variable.presentation,
        catalogPath: variable.catalogPath,
        updatePeriodDays: variable.updatePeriodDays,
        owidVariableId: variable.id,
        owidProcessingLevel: variable.processingLevel,
        owidSchemaVersion: variable.schemaVersion,
        // The Continents variable gets its own column type
        type: isContinentsVariableId(variable.id)
            ? ColumnTypeNames.Continent
            : parsedType,
        sort:
            parsedType === ColumnTypeNames.Ordinal
                ? getSortFromDimensions(variable.dimensions)
                : undefined,
        shortName: variable.shortName,
    }
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

const parseIndicatorAnnotations = (
    variable: OwidVariableWithSourceAndDimension
): IndicatorAnnotation[] | undefined => {
    const legacyAnnotations = parseLegacyEntityAnnotations(
        variable.display?.entityAnnotationsMap
    )
    if (!variable.annotations?.length && !legacyAnnotations.length)
        return undefined

    const annotations = (variable.annotations ?? []).flatMap((annotation) => {
        const parsed = parseIndicatorAnnotation(annotation, variable)
        return parsed ? [parsed] : []
    })
    return [...annotations, ...legacyAnnotations]
}

/**
 * Parses the legacy `entityAnnotationsMap`: one "Entity: text" line per
 * entity. A repeated entity keeps its last line.
 */
const parseLegacyEntityAnnotations = (
    entityAnnotationsMap: string | undefined
): IndicatorAnnotation[] => {
    const textByEntity = new Map<string, string>()
    for (const line of (entityAnnotationsMap ?? "").split("\n")) {
        const [entityName, ...words] = line.split(":")
        textByEntity.set(entityName.trim(), words.join(":").trim())
    }
    return [...textByEntity].flatMap(([entityName, text]) =>
        entityName && text
            ? [{ text, entityNames: [entityName], timeScope: "all" }]
            : []
    )
}

const parseIndicatorAnnotation = (
    annotation: OwidVariableAnnotation,
    variable: OwidVariableWithSourceAndDimension
): IndicatorAnnotation | undefined => {
    const { text, entities } = annotation
    const timeScope = parseTimeScope(annotation, variable)
    if (!timeScope) return undefined

    const [firstEntityName, ...otherEntityNames] = entities ?? []
    return firstEntityName === undefined
        ? { text, ...timeScope }
        : {
              text,
              entityNames: [firstEntityName, ...otherEntityNames],
              ...timeScope,
          }
}

const parseTimeScope = (
    annotation: OwidVariableAnnotation,
    variable: OwidVariableWithSourceAndDimension
): AnnotationTimeScope | undefined => {
    const drop = (reason: string): undefined => {
        console.warn(
            `Dropping annotation of variable ${variable.id} with ${reason}`
        )
        return undefined
    }

    if (annotation.time === undefined) {
        if (annotation.timeEnd === undefined) return { timeScope: "all" }
        return drop(`a timeEnd but no time: ${annotation.timeEnd}`)
    }

    const interval = getTimeInterval(variable.display)
    const time = parseAnnotationTime(annotation.time, interval)
    if (time === undefined) return drop(`an invalid time: ${annotation.time}`)

    if (annotation.timeEnd === undefined) return { timeScope: "point", time }
    const timeEnd = parseAnnotationTime(annotation.timeEnd, interval)
    if (timeEnd === undefined)
        return drop(`an invalid timeEnd: ${annotation.timeEnd}`)

    if (timeEnd === time) return { timeScope: "point", time }
    if (timeEnd < time)
        return drop(
            `end time ${annotation.timeEnd} before start time ${annotation.time}`
        )
    return { timeScope: "range", startTime: time, endTime: timeEnd }
}

const parseAnnotationTime = (
    value: Time | string,
    interval: TimeInterval
): Time | undefined => {
    if (!isSubYearly(interval))
        return typeof value === "number" ? value : undefined

    if (typeof value !== "string") return undefined
    const date = dayjs.utc(value)
    if (!date.isValid() || date.format("YYYY-MM-DD") !== value) return undefined
    return snapToIntervalStart(convertDateToDaysSinceEpoch(date), interval)
}
