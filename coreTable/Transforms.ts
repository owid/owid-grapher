import {
    ColumnSlug,
    CoreColumnDef,
    CoreColumnStore,
} from "./CoreTableConstants"
import { InvalidCellTypes, isValid } from "./InvalidCells"

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
    // NB: This assumes rows sorted by country then time. Would be better to do that more explicitly.
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
} as const

export const AvailableTransforms = Object.keys(availableTransforms)

export const applyTransforms = (
    columnStore: CoreColumnStore,
    defs: CoreColumnDef[]
) => {
    const orderedDefs = defs.filter((def) => def.transform) // todo: sort by graph dependency order
    orderedDefs.forEach((def) => {
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
