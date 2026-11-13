import {
    AnnotationTimeScope,
    EntityName,
    IndicatorAnnotation,
    TimeRange,
} from "@ourworldindata/types"

export type PointAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "point"; entityNames: EntityName[] }
>

export type RangeAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "range"; entityNames: EntityName[] }
>

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

export function selectEntityPointAnnotations(
    annotations: IndicatorAnnotation[],
    entityName: EntityName,
    timeRange: TimeRange
): PointAnnotation[] {
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

export function selectEntityRangeAnnotations(
    annotations: IndicatorAnnotation[],
    entityName: EntityName,
    timeRange: TimeRange
): RangeAnnotation[] {
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
