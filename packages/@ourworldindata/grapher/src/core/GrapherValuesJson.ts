import {
    EntityName,
    GRAPHER_MAP_TYPE,
    GrapherValuesJson,
    GrapherValuesJsonDataPoints,
    GrapherValuesJsonDataPoint,
    GrapherValuesJsonDimension,
    OwidVariableRow,
    PrimitiveType,
    Time,
    DimensionProperty,
    GrapherInterface,
} from "@ourworldindata/types"
import {
    excludeUndefined,
    getTimeDomainFromQueryString,
    isNegativeInfinity,
    isPositiveInfinity,
    omitUndefinedValues,
    getOriginAttributionFragments,
} from "@ourworldindata/utils"
import * as _ from "lodash-es"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { GrapherState } from "./GrapherState"
import { makeChartState } from "../chart/ChartTypeMap"
import { MapChartState } from "../mapCharts/MapChartState"

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

export function isValuesJsonValid(valuesJson: GrapherValuesJson): boolean {
    const columns = valuesJson.columns

    if (!columns || Object.keys(columns).length === 0) return false

    const isDataPointComplete = (
        dataPoint: GrapherValuesJsonDataPoint | undefined
    ): boolean => {
        if (!dataPoint) return false
        if (!columns[dataPoint.columnSlug]) return false
        if (dataPoint.value === undefined) return false
        if (dataPoint.time === undefined) return false
        return true
    }

    const areDataPointsComplete = (
        dataPoints: GrapherValuesJsonDataPoints | undefined
    ): boolean => {
        if (!dataPoints?.y?.length) return false
        // Use `some` instead of `every` to support comparison charts where
        // not all indicators have data for all entities/times
        if (!dataPoints.y.some(isDataPointComplete)) return false
        if (dataPoints.x && !isDataPointComplete(dataPoints.x)) return false
        return true
    }

    if (!valuesJson.endValues) return false
    if (valuesJson.startTime !== undefined && !valuesJson.startValues)
        return false
    if (valuesJson.endTime !== undefined && !valuesJson.endValues) return false

    if (
        valuesJson.startValues &&
        !areDataPointsComplete(valuesJson.startValues)
    )
        return false
    if (valuesJson.endValues && !areDataPointsComplete(valuesJson.endValues))
        return false

    return true
}

const makeColumnInfoForRelevantSlugs = (
    grapherState: GrapherState
): GrapherValuesJson["columns"] => {
    const targetSlugs = excludeUndefined([
        ...grapherState.yColumnSlugs,
        grapherState.xColumnSlug,
    ])

    const dimInfo: Record<string, any> = {}
    for (const slug of targetSlugs) {
        if (dimInfo[slug] !== undefined) continue
        const column = getTransformedColumn(grapherState, slug)
        const info = makeColumnInfo(column)
        if (info !== undefined) dimInfo[slug] = info
    }

    return dimInfo
}

const makeColumnInfo = (
    column: CoreColumn
): GrapherValuesJsonDimension | undefined => {
    if (column.isMissing) return undefined

    return omitUndefinedValues({
        name: column.titlePublicOrDisplayName.title,
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
    minTime: Time | undefined
    maxTime: Time | undefined
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
    const dimensions = config.dimensions ?? []

    // Compute column slug the same way ChartDimension does:
    // slug ?? variableId.toString()
    const getColumnSlug = (d: (typeof dimensions)[0]): string | undefined =>
        d.slug ?? d.variableId?.toString()

    // Extract column slugs from dimensions
    const yColumnSlugs = dimensions
        .filter((d) => d.property === DimensionProperty.y)
        .map(getColumnSlug)
        .filter((slug): slug is string => slug !== undefined)

    const xDimension = dimensions.find(
        (d) => d.property === DimensionProperty.x
    )
    const xColumnSlug = xDimension ? getColumnSlug(xDimension) : undefined

    // Get all relevant columns
    const allSlugs = excludeUndefined([...yColumnSlugs, xColumnSlug])

    // Pre-build column info
    const columns: GrapherValuesJson["columns"] = {}
    for (const slug of allSlugs) {
        const column = inputTable.get(slug)
        const info = makeColumnInfoDirect(column)
        if (info !== undefined) columns[slug] = info
    }

    // Build sources line from columns
    const sourcesLine =
        config.sourceDesc ?? buildSourcesLineFromTable(inputTable, yColumnSlugs)

    // Get sorted unique times from the table
    const times = inputTable.getTimesUniqSortedAscForColumns(yColumnSlugs)

    // Parse configured time bounds (handle both numeric and string formats)
    const parseTimeBound = (
        value: number | string | undefined
    ): Time | undefined => {
        if (value === undefined) return undefined
        if (typeof value === "number") return value
        // Handle string formats like "earliest", "latest", or numeric strings
        if (value === "earliest") return times[0]
        if (value === "latest") return times[times.length - 1]
        const parsed = parseInt(value, 10)
        return isNaN(parsed) ? undefined : parsed
    }

    const minTime = parseTimeBound(config.minTime)
    const maxTime = parseTimeBound(config.maxTime)

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

    // Get entity-specific times from the y columns
    // This matches how GrapherState.times works - filtered to selected entity
    const entityTimes = getEntityTimesFromTable(
        inputTable,
        yColumnSlugs,
        entityName
    )
    const effectiveTimes = entityTimes.length > 0 ? entityTimes : times

    // Resolve time bounds against entity-specific times
    const resolveTimeBound = (bound: Time): Time | undefined => {
        if (isNegativeInfinity(bound)) return effectiveTimes[0]
        if (isPositiveInfinity(bound))
            return effectiveTimes[effectiveTimes.length - 1]
        // Find closest time in effectiveTimes
        return findClosestTimeInArray(effectiveTimes, bound)
    }

    // Default to chart's configured time range resolved against entity times
    const resolvedMinTime =
        configMinTime !== undefined
            ? resolveTimeBound(configMinTime)
            : effectiveTimes[0]
    const resolvedMaxTime =
        configMaxTime !== undefined
            ? resolveTimeBound(configMaxTime)
            : effectiveTimes[effectiveTimes.length - 1]

    let endTime: Time | undefined = resolvedMaxTime
    let startTime: Time | undefined =
        resolvedMinTime !== undefined && resolvedMinTime !== endTime
            ? resolvedMinTime
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

const makeColumnInfoDirect = (
    column: CoreColumn
): GrapherValuesJsonDimension | undefined => {
    if (column.isMissing) return undefined

    return omitUndefinedValues({
        name: column.titlePublicOrDisplayName.title,
        unit: column.unit,
        shortUnit: column.shortUnit,
        isProjection: column.isProjection ? true : undefined,
        yearIsDay: column.display?.yearIsDay ? true : undefined,
    })
}

const makeDimensionValuesForTimeDirect = (
    table: OwidTable,
    ySlugs: string[],
    xSlug: string | undefined,
    entityName: EntityName,
    time?: Time
): GrapherValuesJsonDataPoints | undefined => {
    if (time === undefined) return undefined

    return omitUndefinedValues({
        y: ySlugs.map((ySlug) =>
            makeDimensionValueDirect(table.get(ySlug), entityName, time)
        ),
        x: makeDimensionValueDirect(table.get(xSlug), entityName, time),
    })
}

const makeDimensionValueDirect = (
    column: CoreColumn,
    entityName: string,
    time: Time
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

        // Note: valueLabel (custom tooltip labels) is not available without MapChartState
        // This is a trade-off for the performance optimization

        time: owidRow.originalTime,
        formattedTime: column.formatTime(owidRow.originalTime),
    })
}

/**
 * Build a sources line from table column metadata.
 * This replicates GrapherState.defaultSourcesLine but works directly with the table.
 */
const buildSourcesLineFromTable = (
    table: OwidTable,
    columnSlugs: string[]
): string => {
    const columns = table
        .getColumns(_.uniq(columnSlugs))
        .filter(
            (column) =>
                !!column.source.name || (column.def.origins?.length ?? 0) > 0
        )

    const attributions = columns.flatMap((column) => {
        const { presentation = {} } = column.def
        // If the variable metadata specifies an attribution on the
        // variable level then this is preferred over assembling it from
        // the source and origins
        if (
            presentation.attribution !== undefined &&
            presentation.attribution !== ""
        )
            return [presentation.attribution]
        else {
            const originFragments = getOriginAttributionFragments(
                column.def.origins
            )
            const sourceName = column.source?.name
            // If we have defined origins, we prefer them over the (often
            // duplicative) sources
            if (originFragments.length > 0) return originFragments
            else if (sourceName) return [sourceName]
            else return []
        }
    })

    return _.uniq(attributions).join("; ")
}

/**
 * Get sorted unique times for a specific entity from the table columns.
 * This gives entity-specific times, matching GrapherState.times behavior.
 */
const getEntityTimesFromTable = (
    table: OwidTable,
    columnSlugs: string[],
    entityName: EntityName
): Time[] => {
    const timesSet = new Set<Time>()
    for (const slug of columnSlugs) {
        const column = table.get(slug)
        if (column.isMissing) continue
        const entityTimes = column.owidRowByEntityNameAndTime.get(entityName)
        if (entityTimes) {
            for (const time of entityTimes.keys()) {
                timesSet.add(time)
            }
        }
    }
    return Array.from(timesSet).sort((a, b) => a - b)
}

/**
 * Find the closest time in a sorted array to the target time.
 */
const findClosestTimeInArray = (
    times: Time[],
    target: Time
): Time | undefined => {
    if (times.length === 0) return undefined
    if (target <= times[0]) return times[0]
    if (target >= times[times.length - 1]) return times[times.length - 1]

    // Binary search for closest
    let low = 0
    let high = times.length - 1
    while (low < high) {
        const mid = Math.floor((low + high) / 2)
        if (times[mid] === target) return target
        if (times[mid] < target) {
            low = mid + 1
        } else {
            high = mid
        }
    }

    // Check which neighbor is closer
    if (low === 0) return times[0]
    const prev = times[low - 1]
    const curr = times[low]
    return Math.abs(prev - target) <= Math.abs(curr - target) ? prev : curr
}
