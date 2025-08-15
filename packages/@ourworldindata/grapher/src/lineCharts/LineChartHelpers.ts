import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import {
    AxisAlign,
    AxisConfigInterface,
    ColumnSlug,
    EntityName,
    PrimitiveType,
    ScaleType,
    SeriesName,
    SeriesStrategy,
} from "@ourworldindata/types"
import { AxisConfig } from "../axis/AxisConfig"
import {
    LineChartSeries,
    PlacedLineChartSeries,
    PlacedPoint,
} from "./LineChartConstants"
import { DualAxis, HorizontalAxis, VerticalAxis } from "../axis/Axis"
import { LineChartState } from "./LineChartState"
import { darkenColorForLine } from "../color/ColorUtils"

export type AnnotationsMap = Map<PrimitiveType, Set<PrimitiveType>>

/**
 * Unique identifier for a series that must be shared between
 * line and slope charts since focus states are built on top of it.
 */
export function getSeriesName({
    entityName,
    columnName,
    seriesStrategy,
    availableEntityNames,
    canSelectMultipleEntities,
}: {
    entityName: EntityName
    columnName: string
    seriesStrategy: SeriesStrategy
    availableEntityNames: EntityName[]
    canSelectMultipleEntities: boolean
}): SeriesName {
    // if entities are plotted, use the entity name
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // if columns are plotted, use the column name
    // and prepend the entity name if multiple entities can be selected
    return availableEntityNames.length > 1 || canSelectMultipleEntities
        ? `${entityName} – ${columnName}`
        : columnName
}

export function getColorKey({
    entityName,
    columnName,
    seriesStrategy,
    availableEntityNames,
}: {
    entityName: EntityName
    columnName: string
    seriesStrategy: SeriesStrategy
    availableEntityNames: EntityName[]
}): SeriesName {
    // if entities are plotted, use the entity name
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // If only one entity is plotted, we want to use the column colors.
    // Unlike in `getSeriesName`, we don't care whether the user can select
    // multiple entities, only whether more than one is plotted.
    return availableEntityNames.length > 1
        ? `${entityName} - ${columnName}`
        : columnName
}

export function getAnnotationsMap(
    table: OwidTable,
    slug: ColumnSlug
): AnnotationsMap | undefined {
    return table
        .getAnnotationColumnForColumn(slug)
        ?.getUniqueValuesGroupedBy(table.entityNameSlug)
}

export function getAnnotationsForSeries(
    annotationsMap: AnnotationsMap | undefined,
    seriesName: SeriesName
): string | undefined {
    const annotations = annotationsMap?.get(seriesName)
    if (!annotations) return undefined
    return Array.from(annotations.values())
        .filter((anno) => anno)
        .join(" & ")
}

export function getYAxisConfigDefaults(
    config?: AxisConfigInterface
): AxisConfigInterface {
    return {
        nice: config?.scaleType !== ScaleType.log,
        // if we only have a single y value (probably 0), we want the
        // horizontal axis to be at the bottom of the chart.
        // see https://github.com/owid/owid-grapher/pull/975#issuecomment-890798547
        singleValueAxisPointAlign: AxisAlign.start,
        // default to 0 if not set
        min: 0,
    }
}

export function toHorizontalAxis(
    config: AxisConfig,
    chartState: LineChartState
): HorizontalAxis {
    const axis = config.toHorizontalAxis()

    // Update domain
    axis.updateDomainPreservingUserSettings(
        chartState.transformedTable.timeDomainFor(chartState.yColumnSlugs)
    )

    axis.scaleType = ScaleType.linear
    axis.formatColumn = chartState.inputTable.timeColumn
    axis.hideFractionalTicks = true

    return axis
}

export function toVerticalAxis(
    config: AxisConfig,
    chartState: LineChartState
): VerticalAxis {
    const axis = config.toVerticalAxis()

    // Update domain
    const yDomain = chartState.transformedTable.domainFor(
        chartState.yColumnSlugs
    )
    axis.updateDomainPreservingUserSettings([
        Math.min(axis.domain[0], yDomain[0]),
        Math.max(axis.domain[1], yDomain[1]),
    ])

    // all y axis points are integral, don't show fractional ticks in that case
    axis.hideFractionalTicks = chartState.yColumns.every(
        (yColumn) => yColumn.isAllIntegers
    )

    // line charts never render an axis label
    axis.label = ""

    axis.formatColumn = chartState.formatColumn

    return axis
}

export function toPlacedSeries(
    series: readonly LineChartSeries[],
    { chartState, dualAxis }: { chartState: LineChartState; dualAxis: DualAxis }
): PlacedLineChartSeries[] {
    const { horizontalAxis, verticalAxis } = dualAxis

    return series.toReversed().map((series) => {
        const placedPoints = series.points.map((point): PlacedPoint => {
            const color = chartState.hasColorScale
                ? darkenColorForLine(
                      chartState.getColorScaleColor(point.colorValue)
                  )
                : series.color

            return {
                time: point.x,
                x: _.round(horizontalAxis.place(point.x), 1),
                y: _.round(verticalAxis.place(point.y), 1),
                color,
            }
        })
        return { ...series, placedPoints }
    })
}
