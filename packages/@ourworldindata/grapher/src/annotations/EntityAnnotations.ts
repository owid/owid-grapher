import * as _ from "lodash-es"
import {
    AnnotationTimeScope,
    ColumnSlug,
    EntityName,
    IndicatorAnnotation,
    TimeRange,
} from "@ourworldindata/types"
import { excludeUndefined } from "@ourworldindata/utils"
import { CoreColumn, OwidColumn } from "@ourworldindata/core-table"
import { SeriesLabelAnnotation } from "../seriesLabel/SeriesLabelState"

export type PointAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "point"; entityNames: EntityName[] }
>

export type RangeAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "range"; entityNames: EntityName[] }
>

export type EntityAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "all"; entityNames: EntityName[] }
>

export interface EntityTimeAnnotations {
    pointAnnotations: PointAnnotation[]
    rangeAnnotations: RangeAnnotation[]
}

export type AnnotationMarker = Extract<
    AnnotationTimeScope,
    { timeScope: "point" | "range" }
>

export type TooltipAnnotationPlacement =
    | { kind: "shared"; text: string }
    | { kind: "perColumn"; textBySlug: Map<ColumnSlug, string> }

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

function isEntityAnnotation(
    annotation: IndicatorAnnotation
): annotation is EntityAnnotation {
    return (
        annotation.timeScope === "all" && annotation.entityNames !== undefined
    )
}

interface SelectEntityTimeAnnotationsArgs {
    column: OwidColumn
    entityName: EntityName
    timeRange: TimeRange
}

export function selectEntityTimeAnnotations(
    args: SelectEntityTimeAnnotationsArgs
): EntityTimeAnnotations {
    return {
        pointAnnotations: selectEntityPointAnnotations(args),
        rangeAnnotations: selectEntityRangeAnnotations(args),
    }
}

function selectEntityPointAnnotations({
    column,
    entityName,
    timeRange,
}: SelectEntityTimeAnnotationsArgs): PointAnnotation[] {
    const [startTime, endTime] = timeRange
    return column.annotations
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
    column,
    entityName,
    timeRange,
}: SelectEntityTimeAnnotationsArgs): RangeAnnotation[] {
    const [windowStart, windowEnd] = timeRange
    return column.annotations
        .filter(isRangeAnnotation)
        .filter(
            (annotation) =>
                annotation.entityNames.includes(entityName) &&
                annotation.startTime <= windowEnd &&
                annotation.endTime >= windowStart
        )
        .sort((a, b) => a.startTime - b.startTime)
}

export function selectEntityAnnotation(
    column: OwidColumn,
    entityName: EntityName
): EntityAnnotation | undefined {
    return column.annotations
        .filter(isEntityAnnotation)
        .find((annotation) => annotation.entityNames.includes(entityName))
}

export function selectEntityAnnotationsForColumns(
    columns: OwidColumn[],
    entityName: EntityName
): Map<ColumnSlug, string> {
    return new Map(
        excludeUndefined(
            columns.map((column) => {
                const entityAnnotation = selectEntityAnnotation(
                    column,
                    entityName
                )
                if (!entityAnnotation?.text) return undefined
                return [column.slug, entityAnnotation.text]
            })
        )
    )
}

export function toSeriesLabelAnnotations(
    annotations: EntityTimeAnnotations,
    timeColumn: CoreColumn
): SeriesLabelAnnotation[] {
    const entries = [
        ...annotations.pointAnnotations.map(({ time, text }) => ({
            startTime: time,
            timeScope: "point" as const,
            heading: timeColumn.formatTime(time),
            text,
        })),
        ...annotations.rangeAnnotations.map(({ startTime, endTime, text }) => ({
            startTime,
            timeScope: "range" as const,
            heading: timeColumn.formatTimeRange(startTime, endTime),
            text,
        })),
    ]
    return _.sortBy(entries, (entry) => entry.startTime).map(
        ({ heading, text, timeScope }) => ({ heading, text, timeScope })
    )
}

export function placeEntityAnnotationsInTooltip(
    textBySlug: Map<ColumnSlug, string>,
    columnSlugs: ColumnSlug[]
): TooltipAnnotationPlacement {
    const texts = columnSlugs.map((slug) => textBySlug.get(slug))
    const [firstText] = texts
    if (firstText !== undefined && texts.every((text) => text === firstText))
        return { kind: "shared", text: firstText }
    return { kind: "perColumn", textBySlug }
}
