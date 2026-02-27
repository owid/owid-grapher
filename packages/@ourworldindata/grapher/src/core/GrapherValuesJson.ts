import * as _ from "lodash-es"
import {
    EntityName,
    GRAPHER_MAP_TYPE,
    GrapherValuesJson,
    GrapherValuesJsonDataPoints,
    GrapherValuesJsonDataPoint,
    GrapherValuesJsonDimension,
    OwidVariableRow,
    OwidColumnDef,
    PrimitiveType,
    Time,
    DimensionProperty,
    GrapherInterface,
} from "@ourworldindata/types"
import {
    excludeUndefined,
    findClosestTime,
    getTimeDomainFromQueryString,
    isNegativeInfinity,
    isPositiveInfinity,
    minTimeBoundFromJSONOrNegativeInfinity,
    maxTimeBoundFromJSONOrPositiveInfinity,
    omitUndefinedValues,
} from "@ourworldindata/utils"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { GrapherState } from "./GrapherState"
import { makeChartState } from "../chart/ChartTypeMap"
import { MapChartState } from "../mapCharts/MapChartState"
import { ChartDimension } from "../chart/ChartDimension"
import {
    buildSourcesLineFromColumns,
    pickColumnsForSourcesLine,
} from "./sourcesLine"

export function constructGrapherValuesJson(
    grapherState: GrapherState,
    entityName: EntityName,
    timeQueryParam?: string
): GrapherValuesJson {
    // Make sure the given entityName is the only entity that is currently selected
    let selectionWasModified = false
    let originalSelection: EntityName[] | undefined
    if (
        grapherState.selection.numSelectedEntities !== 1 ||
        grapherState.selection.selectedEntityNames[0] !== entityName
    ) {
        originalSelection = grapherState.selection.selectedEntityNames
        grapherState.selection.setSelectedEntities([entityName])
        selectionWasModified = true
    }

    const resolveTimeBound = (bound: Time): Time | undefined => {
        const times = grapherState.times
        if (times.length === 0) return undefined
        if (isNegativeInfinity(bound)) return times[0]
        if (isPositiveInfinity(bound)) return times[times.length - 1]
        return bound
    }

    // Find the relevant times
    let endTime = grapherState.endTime
    let startTime =
        grapherState.startTime !== grapherState.endTime
            ? grapherState.startTime
            : undefined
    if (timeQueryParam) {
        const [rawStartTime, rawEndTime] =
            getTimeDomainFromQueryString(timeQueryParam)
        const resolvedEndTime = resolveTimeBound(rawEndTime)
        const resolvedStartTime = resolveTimeBound(rawStartTime)
        endTime = resolvedEndTime
        startTime =
            resolvedStartTime !== resolvedEndTime
                ? resolvedStartTime
                : undefined
    }

    // Create a map chart state to access custom label formatting.
    // When `map.tooltipUseCustomLabels` is enabled, this allows us to display
    // custom color scheme labels (e.g. "Low", "Medium", "High") instead of
    // the numeric values
    const mapChartState = makeChartState(
        GRAPHER_MAP_TYPE,
        grapherState
    ) as MapChartState
    const formatValueForTooltip = (value: PrimitiveType): string | undefined =>
        mapChartState.formatValueForTooltip(value)?.label

    const result = omitUndefinedValues({
        entityName,
        startTime,
        endTime,
        columns: makeColumnInfoForRelevantSlugs(grapherState),
        startValues: makeDimensionValuesForTime(
            grapherState,
            entityName,
            startTime,
            formatValueForTooltip
        ),
        endValues: makeDimensionValuesForTime(
            grapherState,
            entityName,
            endTime,
            formatValueForTooltip
        ),
        source: grapherState.sourcesLine,
    })

    if (selectionWasModified) {
        grapherState.selection.setSelectedEntities(originalSelection ?? [])
    }

    return result
}

const makeColumnInfoForRelevantSlugs = (
    grapherState: GrapherState
): GrapherValuesJson["columns"] => {
    const targetSlugs = excludeUndefined([
        ...grapherState.yColumnSlugs,
        grapherState.xColumnSlug,
    ])

    const columns = targetSlugs.map((slug) =>
        getTransformedColumn(grapherState, slug)
    )
    return buildColumnInfoMap(columns)
}

const buildColumnInfoMap = (
    columns: CoreColumn[]
): Record<string, GrapherValuesJsonDimension> => {
    const result: Record<string, GrapherValuesJsonDimension> = {}
    for (const column of columns) {
        const slug = column.def.slug
        if (slug && result[slug] === undefined) {
            const info = makeColumnInfo(column)
            if (info !== undefined) result[slug] = info
        }
    }
    return result
}

const makeColumnInfo = (
    column: CoreColumn
): GrapherValuesJsonDimension | undefined => {
    if (column.isMissing) return undefined

    return omitUndefinedValues({
        name: column.titlePublicOrDisplayName.title,
        shortName: (column.def as OwidColumnDef).shortName,
        unit: column.unit,
        shortUnit: column.shortUnit,
        isProjection: column.isProjection ? true : undefined,
        yearIsDay: column.display?.yearIsDay ? true : undefined,
    })
}

const makeDimensionValuesForTime = (
    grapherState: GrapherState,
    entityName: EntityName,
    time?: Time,
    formatValueForTooltip?: (value: PrimitiveType) => string | undefined
): GrapherValuesJsonDataPoints | undefined => {
    if (time === undefined) return undefined

    const ySlugs = grapherState.yColumnSlugs
    const xSlug = grapherState.xColumnSlug

    return omitUndefinedValues({
        y: ySlugs.map((ySlug) =>
            makeDimensionValueForColumnAndTime(
                getTransformedColumn(grapherState, ySlug),
                entityName,
                time,
                formatValueForTooltip
            )
        ),
        x: makeDimensionValueForColumnAndTime(
            getTransformedColumn(grapherState, xSlug),
            entityName,
            time,
            formatValueForTooltip
        ),
    })
}

const makeDimensionValueForColumnAndTime = (
    column: CoreColumn,
    entityName: string,
    time: Time,
    formatValueForTooltip?: (value: PrimitiveType) => string | undefined
): GrapherValuesJsonDataPoint | undefined => {
    if (column.isMissing) return undefined

    const owidRow: OwidVariableRow<PrimitiveType> | undefined =
        column.owidRowByEntityNameAndTime.get(entityName)?.get(time)

    const value = owidRow?.value
    if (owidRow === undefined || value === undefined)
        return { columnSlug: column.def.slug }

    return omitUndefinedValues({
        columnSlug: column.def.slug,

        value,
        formattedValue: column.formatValue(value),
        formattedValueShort: column.formatValueShort(value),
        formattedValueShortWithAbbreviations:
            column.formatValueShortWithAbbreviations(value),

        valueLabel: formatValueForTooltip?.(value),

        time: owidRow.originalTime,
        formattedTime: column.formatTime(owidRow.originalTime),
    })
}

/**
 * Returns the transformed column for the given slug.
 *
 * Note that the chart's transformed table is used, rather than
 * grapherState.transformedTable, because in rare cases the
 * chart's transformed table includes transformations that are not
 * applied to grapherState.transformedTable (e.g. relative mode in
 * line charts).
 */
const getTransformedColumn = (
    grapherState: GrapherState,
    slug?: string
): CoreColumn => grapherState.chartState.transformedTable.get(slug)

// ============================================================================
// Direct table-based value extraction (optimized for batch processing)
// ============================================================================

/**
 * Prepared state for extracting callout values from a table without
 * going through GrapherState mutations. This is used for batch processing
 * of many entities with the same chart configuration.
 */
export interface PreparedCalloutTable {
    inputTable: OwidTable
    yColumnSlugs: string[]
    xColumnSlug: string | undefined
    columns: GrapherValuesJson["columns"]
    sourcesLine: string
    times: Time[]
    minTime: Time
    maxTime: Time
}

/**
 * Prepare a table and metadata for batch extraction of callout values.
 * Call this once per unique chart configuration, then use
 * constructGrapherValuesJsonFromTable for each entity.
 */
export function prepareCalloutTable(
    inputTable: OwidTable,
    config: GrapherInterface
): PreparedCalloutTable {
    const chartDimensions = (config.dimensions ?? []).map(
        (d) => new ChartDimension(d, { table: inputTable })
    )

    // Extract column slugs from dimensions
    const yColumnSlugs = chartDimensions
        .filter((d) => d.property === DimensionProperty.y)
        .map((d) => d.slug)
    const xColumnSlug = chartDimensions.find(
        (d) => d.property === DimensionProperty.x
    )?.slug
    const colorColumnSlug = chartDimensions.find(
        (d) => d.property === DimensionProperty.color
    )?.slug
    const sizeColumnSlug = chartDimensions.find(
        (d) => d.property === DimensionProperty.size
    )?.slug

    // Get all relevant columns and build column info
    const allSlugs = excludeUndefined([...yColumnSlugs, xColumnSlug])
    const columns = buildColumnInfoMap(
        allSlugs.map((slug) => inputTable.get(slug))
    )

    // Build sources line from columns
    const columnSlugsForSourcesLine = pickColumnsForSourcesLine({
        table: inputTable,
        yColumnSlugs,
        xColumnSlug,
        sizeColumnSlug,
        colorColumnSlug,
    })
    const sourcesLine =
        config.sourceDesc ??
        buildSourcesLineFromColumns(
            inputTable.getColumns(columnSlugsForSourcesLine)
        )

    // Get sorted unique times from the table
    const times = inputTable.getTimesUniqSortedAscForColumns(yColumnSlugs)

    // Parse configured time bounds using standard utilities.
    // These return TimeBound values (-Infinity/+Infinity/number) which get
    // resolved against actual times via findClosestTime downstream.
    const minTime = minTimeBoundFromJSONOrNegativeInfinity(config.minTime)
    const maxTime = maxTimeBoundFromJSONOrPositiveInfinity(config.maxTime)

    return {
        inputTable,
        yColumnSlugs,
        xColumnSlug,
        columns,
        sourcesLine,
        times,
        minTime,
        maxTime,
    }
}

/**
 * Construct GrapherValuesJson directly from a prepared table.
 * This is optimized for batch processing - no GrapherState mutations.
 *
 * Note: This bypasses chart-specific transformations (like relative mode).
 * For most callouts this is fine, but some edge cases may produce different
 * results than the full GrapherState approach.
 */
export function constructGrapherValuesJsonFromTable(
    prepared: PreparedCalloutTable,
    entityName: EntityName,
    timeQueryParam?: string
): GrapherValuesJson {
    const {
        inputTable,
        yColumnSlugs,
        xColumnSlug,
        columns,
        sourcesLine,
        times,
        minTime: configMinTime,
        maxTime: configMaxTime,
    } = prepared

    if (times.length === 0) {
        return omitUndefinedValues({
            entityName,
            columns,
            source: sourcesLine,
        })
    }

    // Resolve time bounds against all available times (not entity-specific).
    // Per-column closest-time resolution happens in makeDimensionValueForColumnAndTime.
    const resolvedMinTime = findClosestTime(times, configMinTime)
    const resolvedMaxTime = findClosestTime(times, configMaxTime)

    let endTime: Time | undefined = resolvedMaxTime
    let startTime: Time | undefined =
        resolvedMinTime !== undefined && resolvedMinTime !== endTime
            ? resolvedMinTime
            : undefined

    if (timeQueryParam) {
        const [rawStartTime, rawEndTime] =
            getTimeDomainFromQueryString(timeQueryParam)
        endTime = findClosestTime(times, rawEndTime)
        startTime =
            findClosestTime(times, rawStartTime) !== endTime
                ? findClosestTime(times, rawStartTime)
                : undefined
    }

    return omitUndefinedValues({
        entityName,
        startTime,
        endTime,
        columns,
        startValues: makeDimensionValuesForTimeDirect(
            inputTable,
            yColumnSlugs,
            xColumnSlug,
            entityName,
            startTime
        ),
        endValues: makeDimensionValuesForTimeDirect(
            inputTable,
            yColumnSlugs,
            xColumnSlug,
            entityName,
            endTime
        ),
        source: sourcesLine,
    })
}

export const makeDimensionValuesForTimeDirect = (
    table: OwidTable,
    ySlugs: string[],
    xSlug: string | undefined,
    entityName: EntityName,
    targetTime?: Time
): GrapherValuesJsonDataPoints | undefined => {
    if (targetTime === undefined) return undefined

    // For each column, resolve the target time against that column's
    // entity-specific times. This handles cases where columns have
    // data for different years.
    const resolveTimeForColumn = (column: CoreColumn): Time | undefined => {
        if (column.isMissing) return undefined
        const entityRows = column.owidRowByEntityNameAndTime.get(entityName)
        if (!entityRows) return undefined
        const columnTimes = Array.from(entityRows.keys()).sort((a, b) => a - b)
        return findClosestTime(columnTimes, targetTime)
    }

    const column = table.get(xSlug)
    const resolvedTime = resolveTimeForColumn(column)
    const xValue = makeDimensionValueForColumnAndTime(
        column,
        entityName,
        resolvedTime ?? targetTime
    )

    return omitUndefinedValues({
        y: ySlugs.map((ySlug) => {
            const column = table.get(ySlug)
            const resolvedTime = resolveTimeForColumn(column)
            return makeDimensionValueForColumnAndTime(
                column,
                entityName,
                resolvedTime ?? targetTime
            )
        }),
        x: xValue,
    })
}
