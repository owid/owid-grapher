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
import {
    LineChartSeries,
    PlacedLineChartSeries,
    PlacedPoint,
    RenderLineChartSeries,
} from "./LineChartConstants"
import { DualAxis } from "../axis/Axis"
import { LineChartState } from "./LineChartState"
import { darkenColorForLine } from "../color/ColorUtils"
import {
    byHoverThenFocusState,
    getHoverStateForSeries,
} from "../chart/ChartUtils"

export type AnnotationsMap = Map<PrimitiveType, Set<PrimitiveType>>

export interface GetSeriesNameArgs {
    entityName: EntityName
    columnName: string
    seriesStrategy: SeriesStrategy
    hasMultipleEntitiesSelected?: boolean
    allowsMultiEntitySelection?: boolean
}

/**
 * Unique identifier for a series that is shared between line and slope charts
 * since focus states are built on top of it.
 */
export function getSeriesName({
    entityName,
    columnName,
    seriesStrategy,
    hasMultipleEntitiesSelected,
    allowsMultiEntitySelection,
}: GetSeriesNameArgs): SeriesName {
    // When plotting entities as series, use the entity name as the unique identifier
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // When plotting columns as series, use the column name. Prepend the entity
    // name if multiple entities can be selected or are currently selected to
    // ensure unique series names across all possible selection states
    return allowsMultiEntitySelection || hasMultipleEntitiesSelected
        ? `${entityName} - ${columnName}`
        : columnName
}

export function getDisplayName({
    entityName,
    columnName,
    seriesStrategy,
    hasMultipleEntitiesSelected,
}: Omit<GetSeriesNameArgs, "canSelectMultipleEntities">): SeriesName {
    // When plotting entities as series, each series represents one entity
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // When plotting columns as series, show just the column name by default.
    // Only prepend the entity name when multiple entities are currently selected
    // (this is different from series names that always include the entity name)
    return hasMultipleEntitiesSelected
        ? `${entityName} – ${columnName}` // Uses en dash for display
        : columnName
}

export function getColorKey({
    entityName,
    columnName,
    seriesStrategy,
    hasMultipleEntitiesSelected,
}: Omit<GetSeriesNameArgs, "canSelectMultipleEntities">): SeriesName {
    // When plotting entities as series, each entity gets its own color
    if (seriesStrategy === SeriesStrategy.entity) return entityName

    // When plotting columns as series, show just the column name by default.
    // Only prepend the entity name when multiple entities are currently selected
    // (this is different from series names that always include the entity name)
    return hasMultipleEntitiesSelected
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

export function toPlacedLineChartSeries(
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

export function toRenderLineChartSeries(
    placedSeries: PlacedLineChartSeries[],
    {
        isFocusModeActive = false,
        isHoverModeActive = false,
        hoveredSeriesNames = [],
    }: {
        isFocusModeActive?: boolean
        isHoverModeActive?: boolean
        hoveredSeriesNames?: SeriesName[]
    }
): RenderLineChartSeries[] {
    let series: RenderLineChartSeries[] = placedSeries.map((series) => {
        return {
            ...series,
            hover: getHoverStateForSeries(series, {
                isHoverModeActive,
                hoveredSeriesNames,
            }),
        }
    })

    // draw lines on top of markers-only series
    series = _.sortBy(series, (series) => !series.plotMarkersOnly)

    // sort by interaction state so that foreground series
    // are drawn on top of background series
    if (isFocusModeActive || isHoverModeActive) {
        series = _.sortBy(series, byHoverThenFocusState)
    }

    return series
}
