import {
    ColumnSlug,
    CoreColumnDef,
    CoreColumnStore,
} from "./CoreTableConstants"
import { InvalidCellTypes, isValid } from "./InvalidCells"

const asPercentageOf = (
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
        return (100 * numerator) / denominator
    })
}

const availableTransforms: any = {
    asPercentageOf: asPercentageOf,
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
