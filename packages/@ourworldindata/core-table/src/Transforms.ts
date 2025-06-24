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

enum TransformParamType {
    TimeSlug = "TimeSlug", // column with time
    EntitySlug = "EntitySlug", // column with entity
    DataSlug = "DataSlug", // column with data
    ColumnSlug = "ColumnSlug", // any column
    Number = "Number",
    String = "String",
}

interface TransformParam {
    type: TransformParamType
    spread?: boolean
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

enum WhereOperators {
    is = "is",
    isNot = "isNot",
    isGreaterThan = "isGreaterThan",
    isGreaterThanOrEqual = "isGreaterThanOrEqual",
    isLessThan = "isLessThan",
    isLessThanOrEqual = "isLessThanOrEqual",
}
// Todo: add tests/expand capabilities/remove?
// Currently this just supports `columnSlug where someColumnSlug (isNot|is) this or that or this`
const where: Transform = {
    params: [
        { type: TransformParamType.DataSlug },
        {
            type: TransformParamType.ColumnSlug,
        },
        {
            type: TransformParamType.String,
            spread: true,
        },
    ],
    fn: (
        columnStore: CoreColumnStore,
        columnSlug: ColumnSlug,
        conditionSlug: ColumnSlug,
        ...condition: string[]
    ): CoreValueType[] => {
        const values = columnStore[columnSlug]
        const conditionValues = columnStore[conditionSlug]
        const operator = condition.shift()
        let passes: (value: any) => boolean = () => true
        if (
            operator === WhereOperators.isNot ||
            operator === WhereOperators.is
        ) {
            const result = operator === "isNot" ? false : true
            const list = condition.join(" ").split(" or ")
            const set = new Set(list)
            passes = (value: any): boolean =>
                set.has(value) ? result : !result
        } else if (operator === WhereOperators.isGreaterThan)
            passes = (value: any): boolean =>
                value > parseFloat(condition.join(""))
        else if (operator === WhereOperators.isGreaterThanOrEqual)
            passes = (value: any): boolean =>
                value >= parseFloat(condition.join(""))
        else if (operator === WhereOperators.isLessThan)
            passes = (value: any): boolean =>
                value < parseFloat(condition.join(""))
        else if (operator === WhereOperators.isLessThanOrEqual)
            passes = (value: any): boolean =>
                value <= parseFloat(condition.join(""))

        return values.map((value, index) =>
            passes(conditionValues[index])
                ? value
                : ErrorValueTypes.FilteredValue
        )
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
        timeSlug: ColumnSlug,
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

const availableTransforms: Record<string, Transform> = {
    asPercentageOf,
    timeSinceEntityExceededThreshold,
    divideBy,
    rollingAverage,
    percentChange,
    multiplyBy,
    subtract,
    where,
    duplicate,
} as const

export const AvailableTransforms = Object.keys(availableTransforms)

export const extractTransformNameAndParams = (
    transform: string
): { transformName: string; params: string[] } | undefined => {
    const words = transform.split(" ")
    const transformName = words.find(
        (word) => availableTransforms[word] !== undefined
    )
    if (!transformName) {
        console.warn(`Warning: transform '${transformName}' not found`)
        return
    }
    const params = words.filter((word) => word !== transformName)
    return { transformName, params }
}

export const applyTransforms = (
    columnStore: CoreColumnStore,
    defs: CoreColumnDef[]
): CoreColumnStore => {
    for (const def of defs) {
        if (!def.transform || def.transformHasRun) continue
        const { transformName, params = [] } =
            extractTransformNameAndParams(def.transform!) ?? {}
        if (!transformName) continue
        const { fn } = availableTransforms[transformName]
        try {
            columnStore[def.slug] = fn(columnStore, ...params)
            def.transformHasRun = true
        } catch (err) {
            console.error(
                `Error performing transform '${def.transform}' for column '${
                    def.slug
                }'. Expected args: ${fn.length}. Provided args: ${
                    1 + params.length
                }. Ran as ${transformName}(columnStore, ${params
                    .map((param) => `"${param}"`)
                    .join(",")}).`
            )
            console.error(err)
        }
    }
    return columnStore
}

const isMaybeDataSlugParam = (paramDef: TransformParam): boolean =>
    paramDef.type === TransformParamType.DataSlug ||
    paramDef.type === TransformParamType.ColumnSlug // might be a data slug

export const extractPotentialDataSlugsFromTransform = (
    transform: string
): ColumnSlug[] | undefined => {
    const { transformName, params = [] } =
        extractTransformNameAndParams(transform) ?? {}
    if (!transformName) return
    const paramDefs = availableTransforms[transformName].params
    const dataSlugs = R.zip(paramDefs, params)
        .filter(
            ([paramDef, param]) =>
                param && paramDef && isMaybeDataSlugParam(paramDef)
        )
        .map(([_, param]) => param as string)
    const lastParam = paramDefs[paramDefs.length - 1]
    if (lastParam && isMaybeDataSlugParam(lastParam) && lastParam.spread) {
        dataSlugs.push(...params.slice(paramDefs.length))
    }
    return _.uniq(dataSlugs)
}
