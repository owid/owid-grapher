import * as _ from "lodash-es"
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
import { GrapherState } from "./core/Grapher.js"
import { makeChartState } from "./chart/ChartTypeMap.js"
import { MapChartState } from "./mapCharts/MapChartState.js"

export function constructGrapherValuesJson(
    grapherState: GrapherState,
    entityName: EntityName
): GrapherValuesJson {
    // Make sure the given entityName is currently selected
    let selectionWasModified = false
    if (!grapherState.selection.selectedSet.has(entityName)) {
        grapherState.selection.selectEntity(entityName)
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
    const formatValueIfCustom = (value: PrimitiveType): string | undefined =>
        mapChartState.formatTooltipValueIfCustom(value)

    const result = omitUndefinedValues({
        entityName,
        startTime: grapherState.startTime,
        endTime: grapherState.endTime,
        columns: makeColumnInfoForRelevantSlugs(grapherState),
        startTimeValues: makeDimensionValuesForTime(
            grapherState,
            entityName,
            startTime,
            formatValueIfCustom
        ),
        endTimeValues: makeDimensionValuesForTime(
            grapherState,
            entityName,
            endTime,
            formatValueIfCustom
        ),
        source: grapherState.sourcesLine,
    })

    if (selectionWasModified) grapherState.selection.deselectEntity(entityName)

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
    formatValueIfCustom?: (value: PrimitiveType) => string | undefined
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
                formatValueIfCustom
            )
        ),
        x: makeDimensionValueForColumnAndTime(
            getTransformedColumn(grapherState, xSlug),
            entityName,
            time,
            formatValueIfCustom
        ),
    })
}

const makeDimensionValueForColumnAndTime = (
    column: CoreColumn,
    entityName: string,
    time: Time,
    formatValueIfCustom?: (value: PrimitiveType) => string | undefined
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

        valueLabel: formatValueIfCustom?.(value),

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
