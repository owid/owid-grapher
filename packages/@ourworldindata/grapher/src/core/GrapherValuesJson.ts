import {
    EntityName,
    GRAPHER_MAP_TYPE,
    GrapherValuesJson,
    GrapherValuesJsonDataPoints,
    GrapherValuesJsonDataPoint,
    OwidVariableRow,
    PrimitiveType,
    Time,
} from "@ourworldindata/types"
import { excludeUndefined, omitUndefinedValues } from "@ourworldindata/utils"
import { CoreColumn } from "@ourworldindata/core-table"
import { GrapherState } from "./GrapherState"
import { makeChartState } from "../chart/ChartTypeMap"
import { MapChartState } from "../mapCharts/MapChartState"

export function constructGrapherValuesJson(
    grapherState: GrapherState,
    entityName: EntityName
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

    // Find the relevant times
    const endTime = grapherState.endTime
    const startTime =
        grapherState.startTime !== grapherState.endTime
            ? grapherState.startTime
            : undefined

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
        startTime: grapherState.startTime,
        endTime: grapherState.endTime,
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

    const dimInfo: Record<string, any> = {}
    for (const slug of targetSlugs) {
        if (dimInfo[slug] !== undefined) continue
        const column = getTransformedColumn(grapherState, slug)
        const info = makeColumnInfo(column)
        if (info !== undefined) dimInfo[slug] = info
    }

    return dimInfo
}

const makeColumnInfo = (column: CoreColumn) => {
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
const getTransformedColumn = (grapherState: GrapherState, slug?: string) =>
    grapherState.chartState.transformedTable.get(slug)
