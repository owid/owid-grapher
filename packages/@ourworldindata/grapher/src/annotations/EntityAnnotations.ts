import {
    EntityName,
    IndicatorAnnotation,
    TimeRange,
} from "@ourworldindata/types"

export type PointAnnotation = Extract<
    IndicatorAnnotation,
    { timeScope: "point"; entityNames: EntityName[] }
>

function isPointAnnotation(
    annotation: IndicatorAnnotation
): annotation is PointAnnotation {
    return (
        annotation.timeScope === "point" && annotation.entityNames !== undefined
    )
}

/** Point annotations for an entity within a time range, in time order */
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
