import * as _ from "lodash-es"
import {
    AnnotationTimeScope,
    EntityName,
    IndicatorAnnotation,
    TimeRange,
} from "@ourworldindata/types"
import { CoreColumn } from "@ourworldindata/core-table"
import { SeriesLabelAnnotation } from "../seriesLabel/SeriesLabelState"

export type PointAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "point"; entityNames: EntityName[] }
>

export type RangeAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "range"; entityNames: EntityName[] }
>

export interface EntityAnnotations {
    pointAnnotations: PointAnnotation[]
    rangeAnnotations: RangeAnnotation[]
}

export type AnnotationMarker = Extract<
    AnnotationTimeScope,
    { timeScope: "point" | "range" }
>

function isPointAnnotation(
    annotation: IndicatorAnnotation
): annotation is PointAnnotation {
    return (
        annotation.timeScope === "point" && annotation.entityNames !== undefined
    )
}

function isRangeAnnotation(
    annotation: IndicatorAnnotation
): annotation is RangeAnnotation {
    return (
        annotation.timeScope === "range" && annotation.entityNames !== undefined
    )
}

interface SelectEntityAnnotationsArgs {
    annotations: IndicatorAnnotation[]
    entityName: EntityName
    timeRange: TimeRange
}

export function selectEntityAnnotations(
    args: SelectEntityAnnotationsArgs
): EntityAnnotations {
    return {
        pointAnnotations: selectEntityPointAnnotations(args),
        rangeAnnotations: selectEntityRangeAnnotations(args),
    }
}

function selectEntityPointAnnotations({
    annotations,
    entityName,
    timeRange,
}: SelectEntityAnnotationsArgs): PointAnnotation[] {
    const [startTime, endTime] = timeRange
    return annotations
        .filter(isPointAnnotation)
        .filter(
            (annotation) =>
                annotation.entityNames.includes(entityName) &&
                annotation.time >= startTime &&
                annotation.time <= endTime
        )
        .sort((a, b) => a.time - b.time)
}

function selectEntityRangeAnnotations({
    annotations,
    entityName,
    timeRange,
}: SelectEntityAnnotationsArgs): RangeAnnotation[] {
    const [windowStart, windowEnd] = timeRange
    return annotations
        .filter(isRangeAnnotation)
        .filter(
            (annotation) =>
                annotation.entityNames.includes(entityName) &&
                annotation.startTime <= windowEnd &&
                annotation.endTime >= windowStart
        )
        .sort((a, b) => a.startTime - b.startTime)
}

export function toSeriesLabelAnnotations(
    annotations: EntityAnnotations,
    timeColumn: CoreColumn
): SeriesLabelAnnotation[] {
    const entries = [
        ...annotations.pointAnnotations.map(({ time, text }) => ({
            startTime: time,
            heading: timeColumn.formatTime(time),
            text,
        })),
        ...annotations.rangeAnnotations.map(({ startTime, endTime, text }) => ({
            startTime,
            heading: timeColumn.formatTimeRange(startTime, endTime),
            text,
        })),
    ]
    return _.sortBy(entries, (entry) => entry.startTime).map(
        ({ heading, text }) => ({ heading, text })
    )
}
