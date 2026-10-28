import * as _ from "lodash-es"
import {
    Bounds,
    excludeUndefined,
    isMobile,
    PointVector,
} from "@ourworldindata/utils"
import { CoreColumn, OwidTable } from "@ourworldindata/core-table"
import { match } from "ts-pattern"
import {
    AxisAlign,
    AxisConfigInterface,
    ColumnSlug,
    EntityName,
    PrimitiveType,
    ScaleType,
    SeriesName,
    SeriesStrategy,
    Time,
} from "@ourworldindata/types"
import {
    AnnotationTooltipEvent,
    AnnotationTooltipState,
    LineChartSeries,
    LinePoint,
    PlacedLineChartSeries,
    PlacedPoint,
    PlacedRangeAnnotation,
    RenderLineChartSeries,
} from "./LineChartConstants"
import { DualAxis, HorizontalAxis } from "../axis/Axis"
import { LineChartState } from "./LineChartState"
import { darkenColorForLine } from "../color/ColorUtils"
import {
    byHoverThenFocusState,
    getHoverStateForSeries,
} from "../chart/ChartUtils"
import { Emphasis, resolveEmphasis } from "../interaction/Emphasis"
import { RangeAnnotation } from "../annotations/EntityAnnotations"
import { SeriesLabelAnnotation } from "../seriesLabel/SeriesLabelState"

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
        // If we only have a single y value (probably 0), we want the
        // horizontal axis to be at the bottom of the chart.
        // see https://github.com/owid/owid-grapher/pull/975#issuecomment-890798547
        singleValueAxisPointAlign: AxisAlign.start,
        // Default to 0 if not set
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
                x: horizontalAxis.place(point.x),
                y: verticalAxis.place(point.y),
                color,
            }
        })
        const placedPointsByTime = new Map(
            placedPoints.map((point) => [point.time, point])
        )
        const placedPointAnnotations = excludeUndefined(
            series.pointAnnotations.map((annotation) => {
                const point = placedPointsByTime.get(annotation.time)
                return point ? { annotation, point } : undefined
            })
        )
        const placedRangeAnnotations = excludeUndefined(
            series.rangeAnnotations.map((annotation) =>
                placeRangeAnnotation(annotation, placedPoints)
            )
        )
        return {
            ...series,
            placedPoints,
            placedPointAnnotations,
            placedRangeAnnotations,
        }
    })
}

export function placeRangeAnnotation(
    annotation: RangeAnnotation,
    placedPoints: readonly PlacedPoint[]
): PlacedRangeAnnotation | undefined {
    const { startTime, endTime } = annotation
    const startIndex = placedPoints.findIndex(
        (point) => point.time >= startTime
    )
    const endIndex = placedPoints.findLastIndex(
        (point) => point.time <= endTime
    )
    if (startIndex === -1 || endIndex === -1) return undefined

    const startsMidSegment =
        startIndex > 0 && placedPoints[startIndex].time > startTime
    const endsMidSegment =
        endIndex < placedPoints.length - 1 &&
        placedPoints[endIndex].time < endTime

    const midSegmentStart = startsMidSegment
        ? placePointOnSegment(
              placedPoints[startIndex - 1],
              placedPoints[startIndex],
              startTime
          )
        : undefined
    const midSegmentEnd = endsMidSegment
        ? placePointOnSegment(
              placedPoints[endIndex],
              placedPoints[endIndex + 1],
              endTime
          )
        : undefined

    const points = excludeUndefined([
        midSegmentStart,
        ...placedPoints.slice(startIndex, endIndex + 1),
        midSegmentEnd,
    ])

    const snappedTimeRange = {
        startTime: startsMidSegment
            ? placedPoints[startIndex - 1].time
            : placedPoints[startIndex].time,
        endTime: endsMidSegment
            ? placedPoints[endIndex + 1].time
            : placedPoints[endIndex].time,
    }

    return { annotation, points, snappedTimeRange }
}

function placePointOnSegment(
    a: PlacedPoint,
    b: PlacedPoint,
    time: Time
): PlacedPoint {
    const fraction = (time - a.time) / (b.time - a.time)
    return {
        time,
        x: a.x + (b.x - a.x) * fraction,
        y: a.y + (b.y - a.y) * fraction,
        color: a.color,
    }
}

/**
 * Find the time of the data point whose x is closest to the mouse position.
 * Returns undefined if the mouse is outside the bounds.
 */
export function findClosestTimeAtMouse({
    mouse,
    innerBounds,
    horizontalAxis,
    allValues,
}: {
    mouse: PointVector
    innerBounds: Bounds
    horizontalAxis: HorizontalAxis
    allValues: LinePoint[]
}): Time | undefined {
    // Expand the hit box so the first/last timepoints are easy to hover
    const hoverMargin = isMobile() ? 44 : 25
    const boundedBox = innerBounds.expand({
        left: hoverMargin,
        right: hoverMargin,
    })

    if (!boundedBox.contains(mouse)) return undefined

    const invertedX = horizontalAxis.invert(mouse.x)
    const closest = _.minBy(allValues, (point) => Math.abs(invertedX - point.x))
    return closest?.x
}

export function toRenderLineChartSeries(
    placedSeries: PlacedLineChartSeries[],
    {
        isFocusModeActive = false,
        isHoverModeActive = false,
        hoveredSeriesNames = [],
        shouldElevateSingleSeries = true,
    }: {
        isFocusModeActive?: boolean
        isHoverModeActive?: boolean
        hoveredSeriesNames?: SeriesName[]
        shouldElevateSingleSeries?: boolean
    }
): RenderLineChartSeries[] {
    const isSingleSeries = placedSeries.length === 1

    let series: RenderLineChartSeries[] = placedSeries.map((series) => {
        const hover = getHoverStateForSeries(series, {
            isHoverModeActive,
            hoveredSeriesNames,
        })
        let emphasis = resolveEmphasis({ hover, focus: series.focus })

        // Emphasize series if it's the only one in the chart
        if (
            shouldElevateSingleSeries &&
            isSingleSeries &&
            emphasis === Emphasis.Default
        )
            emphasis = Emphasis.Elevated

        return { ...series, hover, emphasis }
    })

    // Draw lines on top of markers-only series
    series = _.sortBy(series, (series) => !series.plotMarkersOnly)

    // Sort by interaction state so that foreground series
    // are drawn on top of background series
    if (isFocusModeActive || isHoverModeActive) {
        series = _.sortBy(series, byHoverThenFocusState)
    }

    return series
}

export function toSeriesLabelAnnotations(
    series: Pick<LineChartSeries, "pointAnnotations" | "rangeAnnotations">,
    timeColumn: CoreColumn
): SeriesLabelAnnotation[] {
    const entries = [
        ...series.pointAnnotations.map(({ time, text }) => ({
            startTime: time,
            heading: timeColumn.formatTime(time),
            text,
        })),
        ...series.rangeAnnotations.map(({ startTime, endTime, text }) => ({
            startTime,
            heading: timeColumn.formatTimeRange(startTime, endTime),
            text,
        })),
    ]
    return _.sortBy(entries, (entry) => entry.startTime).map(
        ({ heading, text }) => ({ heading, text })
    )
}

export function transitionAnnotationTooltipState(
    state: AnnotationTooltipState,
    event: AnnotationTooltipEvent
): AnnotationTooltipState {
    return match<AnnotationTooltipEvent, AnnotationTooltipState>(event)
        .with({ type: "labelTooltipShow" }, ({ seriesName }) => ({
            kind: "labelOpen",
            seriesName,
        }))
        .with({ type: "labelTooltipHide" }, ({ seriesName }) =>
            state.kind === "labelOpen" && state.seriesName === seriesName
                ? { kind: "idle" }
                : state
        )
        .with({ type: "markerClick" }, ({ seriesName, time }) =>
            state.kind === "markerOpen" &&
            state.seriesName === seriesName &&
            state.time === time
                ? { kind: "idle" }
                : { kind: "markerOpen", seriesName, time }
        )
        .with({ type: "markerTooltipClose" }, () =>
            state.kind === "markerOpen" ? { kind: "idle" } : state
        )
        .exhaustive()
}
