import { flatten } from "../clientUtils/Util"
import { ColumnSlug, CoreColumnStore, Time } from "./CoreTableConstants"
import { CoreColumnDef } from "./CoreColumnDef"
import { ErrorValue, ErrorValueTypes, isNotErrorValue } from "./ErrorValues"

// In Grapher we return just the years for which we have values for. This puts MissingValuePlaceholder
// in the spots where we are missing values (added to make computing rolling windows easier).
// Takes an array of value/year pairs and expands it so that there is an undefined
// for each missing value from the first year to the last year, preserving the position of
// the existing values.
export const insertMissingValuePlaceholders = (
    values: number[],
    times: number[]
) => {
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
) {
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
const timeSinceEntityExceededThreshold = (
    columnStore: CoreColumnStore,
    timeSlug: ColumnSlug,
    entitySlug: ColumnSlug,
    columnSlug: ColumnSlug,
    thresholdAsString: string
) => {
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
}

// Assumptions: data is sorted by entity, then time
// todo: move tests over from CE
const rollingAverage = (
    columnStore: CoreColumnStore,
    timeSlug: ColumnSlug,
    entitySlug: ColumnSlug,
    columnSlug: ColumnSlug,
    windowSize: number
) => {
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
                (value) => !(value === ErrorValueTypes.MissingValuePlaceholder)
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
    return flatten(groups)
}

const divideBy = (
    columnStore: CoreColumnStore,
    numeratorSlug: ColumnSlug,
    denominatorSlug: ColumnSlug
) => {
    const numeratorValues = columnStore[numeratorSlug] as number[]
    const denominatorValues = columnStore[denominatorSlug] as number[]
    return denominatorValues.map((denominator, index) => {
        if (denominator === 0) return ErrorValueTypes.DivideByZeroError
        const numerator = numeratorValues[index]
        if (!isNotErrorValue(numerator)) return numerator
        if (!isNotErrorValue(denominator)) return denominator
        return numerator / denominator
    })
}

const multiplyBy = (
    columnStore: CoreColumnStore,
    columnSlug: ColumnSlug,
    factor: number
) =>
    columnStore[columnSlug].map((value) =>
        isNotErrorValue(value) ? (value as number) * factor : value
    )

const subtract = (
    columnStore: CoreColumnStore,
    columnSlugA: ColumnSlug,
    columnSlugB: ColumnSlug
) => {
    const values = columnStore[columnSlugA] as number[]
    const subValues = columnStore[columnSlugB] as number[]
    return subValues.map((subValue, index) => {
        const value = values[index]
        if (!isNotErrorValue(value)) return value
        if (!isNotErrorValue(subValue)) return subValue
        return value - subValue
    })
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
const where = (
    columnStore: CoreColumnStore,
    columnSlug: ColumnSlug,
    conditionSlug: ColumnSlug,
    ...condition: string[]
) => {
    const values = columnStore[columnSlug]
    const conditionValues = columnStore[conditionSlug]
    const operator = condition.shift()
    let passes = (value: any) => true
    if (operator === WhereOperators.isNot || operator === WhereOperators.is) {
        const result = operator === "isNot" ? false : true
        const list = condition.join(" ").split(" or ")
        const set = new Set(list)
        passes = (value: any) => (set.has(value) ? result : !result)
    } else if (operator === WhereOperators.isGreaterThan)
        passes = (value: any) => value > parseFloat(condition.join(""))
    else if (operator === WhereOperators.isGreaterThanOrEqual)
        passes = (value: any) => value >= parseFloat(condition.join(""))
    else if (operator === WhereOperators.isLessThan)
        passes = (value: any) => value < parseFloat(condition.join(""))
    else if (operator === WhereOperators.isLessThanOrEqual)
        passes = (value: any) => value <= parseFloat(condition.join(""))

    return values.map((value, index) =>
        passes(conditionValues[index]) ? value : ErrorValueTypes.FilteredValue
    )
}

// Assumptions: data is sorted by entity, then time, and time is a continous integer with a row for each time step.
// todo: move tests over from CE
const percentChange = (
    columnStore: CoreColumnStore,
    timeSlug: ColumnSlug,
    entitySlug: ColumnSlug,
    columnSlug: ColumnSlug,
    windowSize: number
) => {
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
}

// Todo: remove?
const asPercentageOf = (
    columnStore: CoreColumnStore,
    numeratorSlug: ColumnSlug,
    denominatorSlug: ColumnSlug
) =>
    divideBy(columnStore, numeratorSlug, denominatorSlug).map((num) =>
        typeof num === "number" ? 100 * num : num
    )

const availableTransforms: any = {
    asPercentageOf: asPercentageOf,
    timeSinceEntityExceededThreshold: timeSinceEntityExceededThreshold,
    divideBy: divideBy,
    rollingAverage: rollingAverage,
    percentChange: percentChange,
    multiplyBy: multiplyBy,
    subtract: subtract,
    where: where,
} as const

export const AvailableTransforms = Object.keys(availableTransforms)

export const applyTransforms = (
    columnStore: CoreColumnStore,
    defs: CoreColumnDef[]
) => {
    defs.forEach((def) => {
        const words = def.transform!.split(" ")
        const transformName = words.find(
            (word) => availableTransforms[word] !== undefined
        )
        if (!transformName) {
            console.log(`Warning: transform '${transformName}' not found`)
            return
        }
        const params = words.filter((word) => word !== transformName)
        const fn = availableTransforms[transformName]
        try {
            columnStore[def.slug] = fn(columnStore, ...params)
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
    })
    return columnStore
}
