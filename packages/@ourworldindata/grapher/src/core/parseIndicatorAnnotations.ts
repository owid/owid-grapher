import {
    AnnotationTimeScope,
    IndicatorAnnotation,
    OwidVariableAnnotation,
    Time,
    TimeInterval,
} from "@ourworldindata/types"
import {
    OwidVariableWithSourceAndDimension,
    convertDateToDaysSinceEpoch,
    dayjs,
    getTimeInterval,
    isSubYearly,
    snapToIntervalStart,
} from "@ourworldindata/utils"

/**
 * Parses both structured `variable.annotations` and the legacy
 * `display.entityAnnotationsMap` text format into normalized
 * `IndicatorAnnotation`s. Invalid annotations are logged and dropped.
 */
export const parseIndicatorAnnotations = (
    variable: OwidVariableWithSourceAndDimension
): IndicatorAnnotation[] | undefined => {
    const legacyAnnotations = parseLegacyEntityAnnotations(
        variable.display?.entityAnnotationsMap
    )
    if (!variable.annotations?.length && !legacyAnnotations.length)
        return undefined

    const annotations = (variable.annotations ?? []).flatMap((annotation) => {
        const parsed = parseIndicatorAnnotation(annotation, variable)
        return parsed ? [parsed] : []
    })
    return [...annotations, ...legacyAnnotations]
}

/**
 * Parses the legacy `entityAnnotationsMap`: one "Entity: text" line per
 * entity. A repeated entity keeps its last line.
 */
const parseLegacyEntityAnnotations = (
    entityAnnotationsMap: string | undefined
): IndicatorAnnotation[] => {
    const textByEntity = new Map<string, string>()
    for (const line of (entityAnnotationsMap ?? "").split("\n")) {
        const [entityName, ...words] = line.split(":")
        textByEntity.set(entityName.trim(), words.join(":").trim())
    }
    return [...textByEntity].flatMap(([entityName, text]) =>
        entityName && text
            ? [{ text, entityNames: [entityName], timeScope: "all" }]
            : []
    )
}

const parseIndicatorAnnotation = (
    annotation: OwidVariableAnnotation,
    variable: OwidVariableWithSourceAndDimension
): IndicatorAnnotation | undefined => {
    const { text, entities } = annotation
    const timeScope = parseTimeScope(annotation, variable)
    if (!timeScope) return undefined

    const [firstEntityName, ...otherEntityNames] = entities ?? []
    return firstEntityName === undefined
        ? { text, ...timeScope }
        : {
              text,
              entityNames: [firstEntityName, ...otherEntityNames],
              ...timeScope,
          }
}

const parseTimeScope = (
    annotation: OwidVariableAnnotation,
    variable: OwidVariableWithSourceAndDimension
): AnnotationTimeScope | undefined => {
    const drop = (reason: string): undefined => {
        console.warn(
            `Dropping annotation of variable ${variable.id} with ${reason}`
        )
        return undefined
    }

    if (annotation.time === undefined) {
        if (annotation.timeEnd === undefined) return { timeScope: "all" }
        return drop(`a timeEnd but no time: ${annotation.timeEnd}`)
    }

    const interval = getTimeInterval(variable.display)
    const time = parseAnnotationTime(annotation.time, interval)
    if (time === undefined) return drop(`an invalid time: ${annotation.time}`)

    if (annotation.timeEnd === undefined) return { timeScope: "point", time }
    const timeEnd = parseAnnotationTime(annotation.timeEnd, interval)
    if (timeEnd === undefined)
        return drop(`an invalid timeEnd: ${annotation.timeEnd}`)

    if (timeEnd === time) return { timeScope: "point", time }
    if (timeEnd < time)
        return drop(
            `end time ${annotation.timeEnd} before start time ${annotation.time}`
        )
    return { timeScope: "range", startTime: time, endTime: timeEnd }
}

/**
 * Parses an annotation's time bound into the table's numeric time space:
 * years stay numbers, while sub-yearly YYYY-MM-DD dates become days since
 * EPOCH_DATE snapped to the start of the variable's interval.
 */
const parseAnnotationTime = (
    value: Time | string,
    interval: TimeInterval
): Time | undefined => {
    if (!isSubYearly(interval))
        return typeof value === "number" ? value : undefined

    if (typeof value !== "string") return undefined
    const date = dayjs.utc(value)
    // Round-trip format check rejects non-strict dates like "2020-3-1" or "2020-02-30"
    if (!date.isValid() || date.format("YYYY-MM-DD") !== value) return undefined
    return snapToIntervalStart(convertDateToDaysSinceEpoch(date), interval)
}
