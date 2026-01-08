import * as _ from "lodash-es"
import { ColumnSlug } from "@ourworldindata/utils"
import {
    ErrorValue,
    CoreColumnDef,
    CoreColumnStore,
    Time,
    CoreValueType,
} from "@ourworldindata/types"
import {
    ErrorValueTypes,
    isNotErrorValue,
    MissingValuePlaceholder,
    ValueTooLow,
    DivideByZeroError,
} from "./ErrorValues.js"
import * as R from "remeda"

export enum TransformParamType {
    /** Column with time */
    TimeSlug = "TimeSlug",
    /** Column with entity */
    EntitySlug = "EntitySlug",
    /** Column with data */
    DataSlug = "DataSlug",
    Number = "Number",
    String = "String",
}

interface TransformParam {
    type: TransformParamType
}

interface Transform {
    params: TransformParam[]
    fn: (...args: any[]) => CoreValueType[]
}

// In Grapher we return just the years for which we have values for. This puts MissingValuePlaceholder
// in the spots where we are missing values (added to make computing rolling windows easier).
// Takes an array of value/year pairs and expands it so that there is an undefined
// for each missing value from the first year to the last year, preserving the position of
// the existing values.
export const insertMissingValuePlaceholders = (
    values: number[],
    times: number[]
): (number | MissingValuePlaceholder)[] => {
    const startTime = times[0]
    const endTime = times[times.length - 1]
    const filledRange = []
    let time = startTime
    const timeToValueIndex = new Map()
    times.forEach((time, index) => {
        timeToValueIndex.set(time, index)
    })
    while (time <= endTime) {
        filledRange.push(
            timeToValueIndex.has(time)
                ? values[timeToValueIndex.get(time)]
                : ErrorValueTypes.MissingValuePlaceholder
        )
        time++
    }
    return filledRange
}

// todo: add the precision param to ensure no floating point effects
export function computeRollingAverage(
    numbers: (number | undefined | null | ErrorValue)[],
    windowSize: number,
    align: "right" | "center" = "right"
): (number | ErrorValue)[] {
    const result: (number | ErrorValue)[] = []

    for (let valueIndex = 0; valueIndex < numbers.length; valueIndex++) {
        // If a value is undefined in the original input, keep it undefined in the output
        const currentVal = numbers[valueIndex]
        if (currentVal === null) {
            result[valueIndex] = ErrorValueTypes.NullButShouldBeNumber
            continue
        } else if (currentVal === undefined) {
            result[valueIndex] = ErrorValueTypes.UndefinedButShouldBeNumber
            continue
        } else if (currentVal instanceof ErrorValue) {
            result[valueIndex] = currentVal
            continue
        }

        // Take away 1 for the current value (windowSize=1 means no smoothing & no expansion)
        const expand = windowSize - 1

        // With centered smoothing, expand uneven windows asymmetrically (ceil & floor) to ensure
        // a correct number of window values get taken into account.
        // Arbitrarily biased towards left (past).
        const expandLeft = align === "center" ? Math.ceil(expand / 2) : expand
        const expandRight = align === "center" ? Math.floor(expand / 2) : 0

        const startIndex = Math.max(valueIndex - expandLeft, 0)
        const endIndex = Math.min(valueIndex + expandRight, numbers.length - 1)

        let count = 0
        let sum = 0
        for (
            let windowIndex = startIndex;
            windowIndex <= endIndex;
            windowIndex++
        ) {
            const value = numbers[windowIndex]
            if (
                value !== undefined &&
                value !== null &&
                !(value instanceof ErrorValue)
            ) {
                sum += value!
                count++
            }
        }

        result[valueIndex] = sum / count
    }

    return result
}

// Assumptions: data is sorted by entity, then time
// todo: move tests over from CE
const timeSinceEntityExceededThreshold: Transform = {
    params: [
        { type: TransformParamType.TimeSlug },
        { type: TransformParamType.EntitySlug },
        { type: TransformParamType.DataSlug },
        { type: TransformParamType.String },
    ],
    fn: (
        columnStore: CoreColumnStore,
        timeSlug: ColumnSlug,
        entitySlug: ColumnSlug,
        columnSlug: ColumnSlug,
        thresholdAsString: string
    ): (number | ValueTooLow)[] => {
        const threshold = parseFloat(thresholdAsString)
        const groupValues = columnStore[entitySlug] as string[]
        const columnValues = columnStore[columnSlug] as number[]
        const timeValues = columnStore[timeSlug] as number[]
        let currentGroup: string
        let groupExceededThresholdAtTime: number
        return columnValues.map((value, index) => {
            const group = groupValues[index]
            const currentTime = timeValues[index]
            if (group !== currentGroup) {
                if (!isNotErrorValue(value)) return value
                if (value < threshold) return ErrorValueTypes.ValueTooLow

                currentGroup = group
                groupExceededThresholdAtTime = currentTime
            }
            return currentTime - groupExceededThresholdAtTime
        })
    },
}

// Assumptions: data is sorted by entity, then time
// todo: move tests over from CE
const rollingAverage: Transform = {
    params: [
        { type: TransformParamType.TimeSlug },
        { type: TransformParamType.EntitySlug },
        { type: TransformParamType.DataSlug },
        { type: TransformParamType.Number },
    ],
    fn: (
        columnStore: CoreColumnStore,
        timeSlug: ColumnSlug,
        entitySlug: ColumnSlug,
        columnSlug: ColumnSlug,
        windowSize: number
    ): (number | ErrorValue)[] => {
        const entityNames = columnStore[entitySlug] as string[]
        const columnValues = columnStore[columnSlug] as number[]
        const timeValues = columnStore[timeSlug] as number[]
        const len = entityNames.length
        if (!len) return []
        let currentEntity = entityNames[0]
        let currentValues: number[] = []
        let currentTimes: Time[] = []

        const groups: (number | ErrorValue)[][] = []
        for (let rowIndex = 0; rowIndex <= len; rowIndex++) {
            const entityName = entityNames[rowIndex]
            const value = columnValues[rowIndex]
            const time = timeValues[rowIndex]
            if (currentEntity !== entityName) {
                const averages = computeRollingAverage(
                    insertMissingValuePlaceholders(currentValues, currentTimes),
                    windowSize
                ).filter(
                    (value) =>
                        !(value === ErrorValueTypes.MissingValuePlaceholder)
                ) // filter the placeholders back out
                groups.push(averages)
                if (value === undefined) break // We iterate to <= so that we push the last row
                currentValues = []
                currentTimes = []
                currentEntity = entityName
            }
            currentValues.push(value)
            currentTimes.push(time)
        }
        return groups.flat()
    },
}

const divideBy: Transform = {
    params: [
        { type: TransformParamType.DataSlug },
        { type: TransformParamType.DataSlug },
    ],
    fn: (
        columnStore: CoreColumnStore,
        numeratorSlug: ColumnSlug,
        denominatorSlug: ColumnSlug
    ): (number | DivideByZeroError)[] => {
        const numeratorValues = columnStore[numeratorSlug] as number[]
        const denominatorValues = columnStore[denominatorSlug] as number[]
        return denominatorValues.map((denominator, index) => {
            if (denominator === 0) return ErrorValueTypes.DivideByZeroError
            const numerator = numeratorValues[index]
            if (!isNotErrorValue(numerator)) return numerator
            if (!isNotErrorValue(denominator)) return denominator
            return numerator / denominator
        })
    },
}

const multiplyBy: Transform = {
    params: [
        { type: TransformParamType.DataSlug },
        { type: TransformParamType.Number },
    ],
    fn: (
        columnStore: CoreColumnStore,
        columnSlug: ColumnSlug,
        factor: number
    ): (number | ErrorValue)[] =>
        columnStore[columnSlug].map((value) =>
            isNotErrorValue(value) ? (value as number) * factor : value
        ),
}

const subtract: Transform = {
    params: [
        { type: TransformParamType.DataSlug },
        { type: TransformParamType.DataSlug },
    ],
    fn: (
        columnStore: CoreColumnStore,
        columnSlugA: ColumnSlug,
        columnSlugB: ColumnSlug
    ): number[] => {
        const values = columnStore[columnSlugA] as number[]
        const subValues = columnStore[columnSlugB] as number[]
        return subValues.map((subValue, index) => {
            const value = values[index]
            if (!isNotErrorValue(value)) return value
            if (!isNotErrorValue(subValue)) return subValue
            return value - subValue
        })
    },
}

// Assumptions: data is sorted by entity, then time, and time is a continous integer with a row for each time step.
// todo: move tests over from CE
const percentChange: Transform = {
    params: [
        { type: TransformParamType.TimeSlug },
        { type: TransformParamType.EntitySlug },
        { type: TransformParamType.DataSlug },
        { type: TransformParamType.Number },
    ],
    fn: (
        columnStore: CoreColumnStore,
        _timeSlug: ColumnSlug,
        entitySlug: ColumnSlug,
        columnSlug: ColumnSlug,
        windowSize: number
    ): (number | ErrorValue)[] => {
        const entityNames = columnStore[entitySlug] as string[]
        const columnValues = columnStore[columnSlug] as number[]

        // If windowSize is 0 then there is zero change for every valid value
        if (!windowSize)
            return columnValues.map((val) => (isNotErrorValue(val) ? 0 : val))

        let currentEntity: string
        return columnValues.map((value: any, index) => {
            const entity = entityNames[index]
            const previousEntity = entityNames[index - windowSize] as any
            const previousValue = columnValues[index - windowSize] as any
            if (
                !currentEntity ||
                currentEntity !== entity ||
                previousEntity !== entity
            ) {
                currentEntity = entity
                return ErrorValueTypes.NoValueToCompareAgainst
            }
            if (previousValue instanceof ErrorValue) return previousValue
            if (value instanceof ErrorValue) return value

            if (previousValue === 0) return ErrorValueTypes.DivideByZeroError
            if (previousValue === undefined)
                return ErrorValueTypes.NoValueToCompareAgainst

            return (100 * (value - previousValue)) / previousValue
        })
    },
}

// Todo: remove?
const asPercentageOf: Transform = {
    params: [
        { type: TransformParamType.DataSlug },
        { type: TransformParamType.DataSlug },
    ],
    fn: (
        columnStore: CoreColumnStore,
        numeratorSlug: ColumnSlug,
        denominatorSlug: ColumnSlug
    ): (number | DivideByZeroError)[] =>
        divideBy
            .fn(columnStore, numeratorSlug, denominatorSlug)
            .map((num: any) => (typeof num === "number" ? 100 * num : num)),
}

const duplicate: Transform = {
    params: [{ type: TransformParamType.DataSlug }],
    fn: (
        columnStore: CoreColumnStore,
        columnSlug: ColumnSlug
    ): CoreValueType[] => _.cloneDeep(columnStore[columnSlug]),
}

const availableTransforms = {
    asPercentageOf,
    timeSinceEntityExceededThreshold,
    divideBy,
    rollingAverage,
    percentChange,
    multiplyBy,
    subtract,
    duplicate,
} as const

type TransformName = keyof typeof availableTransforms
export const availableTransformNames = Object.keys(
    availableTransforms
) as TransformName[]

const isTransformName = (word: string): word is TransformName =>
    availableTransformNames.includes(word as any)

/**
 * Extracts the transform name and params from a transform string.
 *
 * For example, 'rollingAverage time entity population 5' is parsed as
 * {
 *     transformName: 'rollingAverage',
 *     params: [
 *        { type: TransformParamType.TimeSlug, value: 'time' },
 *        { type: TransformParamType.EntitySlug, value: 'entity' },
 *        { type: TransformParamType.DataSlug, value: 'population' },
 *        { type: TransformParamType.Number, value: '5' },
 *    ]
 * }
 */
export const parseTransformString = (
    transform: string
):
    | {
          transformName: TransformName
          params: { type: TransformParamType; value: string }[]
      }
    | undefined => {
    const words = transform.split(" ")

    const transformName = words.find((word) => isTransformName(word))

    if (!transformName) {
        console.warn(`Warning: transform '${transformName}' not found`)
        return
    }

    const values = words.filter((word) => word !== transformName)

    // Extract data slugs from transforms (i.e. columns with data, not time or entity)
    const paramDefs = availableTransforms[transformName].params
    const params = R.zip(paramDefs, values).map(([paramDef, value]) => {
        return { type: paramDef.type, value }
    })

    return { transformName, params }
}

export const applyTransforms = (
    columnStore: CoreColumnStore,
    defs: CoreColumnDef[]
): CoreColumnStore => {
    for (const def of defs) {
        if (!def.transform || def.transformHasRun) continue
        const { transformName, params = [] } =
            parseTransformString(def.transform!) ?? {}
        const paramValues = params.map(({ value }) => value)
        if (!transformName) continue
        const { fn } = availableTransforms[transformName]
        try {
            columnStore[def.slug] = fn(columnStore, ...paramValues)
            def.transformHasRun = true
        } catch (err) {
            console.error(
                `Error performing transform '${def.transform}' for column '${
                    def.slug
                }'. Expected args: ${fn.length}. Provided args: ${
                    1 + paramValues.length
                }. Ran as ${transformName}(columnStore, ${paramValues
                    .map((param) => `"${param}"`)
                    .join(",")}).`
            )
            console.error(err)
        }
    }
    return columnStore
}
