import {
    computeRollingAverage,
    insertMissingValuePlaceholders,
} from "explorer/covidExplorer/CovidExplorerUtils"
import { flatten } from "grapher/utils/Util"
import { ColumnSlug, CoreColumnStore, Time } from "./CoreTableConstants"
import { CoreColumnDef } from "./CoreColumnDef"
import { InvalidCell, InvalidCellTypes, isValid } from "./InvalidCells"

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
        if (group !== currentGroup) {
            if (!isValid(value)) return value
            if (value < threshold) return InvalidCellTypes.ValueTooLow

            currentGroup = group
            groupExceededThresholdAtTime = timeValues[index]
        }
        return groupExceededThresholdAtTime
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

    const groups: (number | InvalidCell)[][] = []
    for (let rowIndex = 0; rowIndex <= len; rowIndex++) {
        const entityName = entityNames[rowIndex]
        const value = columnValues[rowIndex]
        const time = timeValues[rowIndex]
        if (currentEntity !== entityName) {
            const averages = computeRollingAverage(
                insertMissingValuePlaceholders(currentValues, currentTimes),
                windowSize
            ).filter(
                (value) => !(value === InvalidCellTypes.MissingValuePlaceholder)
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
        if (denominator === 0) return InvalidCellTypes.DivideByZeroError
        const numerator = numeratorValues[index]
        if (!isValid(numerator)) return numerator
        if (!isValid(denominator)) return denominator
        return numerator / denominator
    })
}

const multiplyBy = (
    columnStore: CoreColumnStore,
    columnSlug: ColumnSlug,
    factor: number
) =>
    columnStore[columnSlug].map((value) =>
        isValid(value) ? (value as number) * factor : value
    )

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
        passes(conditionValues[index]) ? value : InvalidCellTypes.FilteredValue
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
    if (!windowSize) return columnValues.map((val) => (isValid(val) ? 0 : val))

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
            return InvalidCellTypes.NoValueToCompareAgainst
        }
        if (previousValue instanceof InvalidCell) return previousValue
        if (value instanceof InvalidCell) return value

        if (previousValue === 0) return InvalidCellTypes.DivideByZeroError
        if (previousValue === undefined)
            return InvalidCellTypes.NoValueToCompareAgainst

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
        try {
            columnStore[def.slug] = availableTransforms[transformName](
                columnStore,
                ...params
            )
        } catch (err) {
            console.log(err)
            console.log(`Error performing transform ${def.transform}`)
        }
    })
    return columnStore
}
