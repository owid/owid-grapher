import {
    findIndex,
    range,
    sampleFrom,
    slugifySameCase,
} from "grapher/utils/Util"
import {
    CoreColumnStore,
    ColumnTypeNames,
    CoreColumnDef,
    CoreRow,
    ColumnSlug,
} from "./CoreTableConstants"
import { InvalidCell, InvalidCellTypes } from "./InvalidCells"
import {
    OwidEntityCodeColumnDef,
    OwidEntityIdColumnDef,
    OwidEntityNameColumnDef,
    OwidTableSlugs,
} from "./OwidTableConstants"

export const columnStoreToRows = (columnStore: CoreColumnStore) => {
    const firstCol = Object.values(columnStore)[0]
    if (!firstCol) return []
    const slugs = Object.keys(columnStore)
    return firstCol.map((val, index) => {
        const newRow: any = {}
        slugs.forEach((slug) => {
            newRow[slug] = columnStore[slug][index]
        })
        return newRow
    })
}

// Picks a type for each column from the first row then autotypes all rows after that so all values in
// a column will have the same type. Only chooses between strings and numbers.
export const makeAutoTypeFn = (numericSlugs?: ColumnSlug[]) => {
    const slugToType: any = {}
    numericSlugs?.forEach((slug) => {
        slugToType[slug] = "number"
    })
    return (object: any) => {
        for (const columnSlug in object) {
            const value = object[columnSlug]
            const type = slugToType[columnSlug]
            if (type === "string") {
                object[columnSlug] = value
                continue
            }

            const number = parseFloat(value) // The "+" type casting that d3 does for perf converts "" to 0, so use parseFloat.
            if (type === "number") {
                object[columnSlug] = isNaN(number)
                    ? InvalidCellTypes.NaNButShouldBeNumber
                    : number
                continue
            }

            if (isNaN(number)) {
                object[columnSlug] = value
                slugToType[columnSlug] = "string"
                continue
            }

            object[columnSlug] = number
            slugToType[columnSlug] = "number"
        }
        return object
    }
}

// Removes whitespace and non-word characters from column slugs if any exist.
// The original names are moved to the name property on the column def.
export const standardizeSlugs = (rows: CoreRow[]) => {
    const colsToRename = Object.keys(rows[0])
        .map((name) => {
            return {
                name,
                slug: slugifySameCase(name),
            }
        })
        .filter((col) => col.name !== col.slug)
    if (!colsToRename.length) return undefined

    rows.forEach((row: CoreRow) => {
        colsToRename.forEach((col) => {
            row[col.slug] = row[col.name]
            delete row[col.name]
        })
    })

    return { rows, defs: colsToRename }
}

export const guessColumnDefFromSlugAndRow = (
    slug: string,
    sampleValue: any
): CoreColumnDef => {
    const valueType = typeof sampleValue

    if (slug === "day")
        return {
            slug: "day",
            type: ColumnTypeNames.Date,
            name: "Date",
        }

    if (slug === "year")
        return {
            slug: "year",
            type: ColumnTypeNames.Year,
            name: "Year",
        }

    if (slug === OwidTableSlugs.entityName) return OwidEntityNameColumnDef
    if (slug === OwidTableSlugs.entityCode) return OwidEntityCodeColumnDef
    if (slug === OwidTableSlugs.entityId) return OwidEntityIdColumnDef

    if (valueType === "number")
        return {
            slug,
            type: ColumnTypeNames.Numeric,
        }

    if (valueType === "string") {
        if (sampleValue.match(/^\d+$/))
            return {
                slug,
                type: ColumnTypeNames.Numeric,
            }
    }

    return { slug, type: ColumnTypeNames.String }
}

export const makeRowFromColumnStore = (
    rowIndex: number,
    columnStore: CoreColumnStore
) => {
    const row: any = {}
    const columns = Object.values(columnStore)
    Object.keys(columnStore).forEach((slug, colIndex) => {
        row[slug] = columns[colIndex][rowIndex]
    })
    return row
}

function isNotInvalidOrEmptyCell(value: any) {
    return value !== undefined && !(value instanceof InvalidCell)
}

export function interpolateRowValuesWithTolerance<
    ValueSlug extends ColumnSlug,
    TimeSlug extends ColumnSlug,
    Row extends { [key in TimeSlug]?: number } & { [key in ValueSlug]?: any }
>(
    rowsSortedByTimeAsc: Row[],
    valueSlug: ValueSlug,
    timeSlug: TimeSlug,
    timeTolerance: number
): Row[] {
    if (!rowsSortedByTimeAsc.length) return rowsSortedByTimeAsc

    let prevNonBlankIndex: number | undefined = undefined
    let nextNonBlankIndex: number | undefined = undefined

    for (let index = 0; index < rowsSortedByTimeAsc.length; index++) {
        const currentValue = rowsSortedByTimeAsc[index][valueSlug]
        if (isNotInvalidOrEmptyCell(currentValue)) {
            prevNonBlankIndex = index
            continue
        }

        if (
            nextNonBlankIndex !== -1 &&
            (nextNonBlankIndex === undefined || nextNonBlankIndex <= index)
        ) {
            nextNonBlankIndex = findIndex(
                rowsSortedByTimeAsc,
                (row) => isNotInvalidOrEmptyCell(row[valueSlug]),
                index + 1
            )
        }

        const timeOfCurrent: number = rowsSortedByTimeAsc[index][timeSlug]
        const timeOfPrevIndex: number =
            prevNonBlankIndex !== undefined
                ? rowsSortedByTimeAsc[prevNonBlankIndex][timeSlug]
                : -Infinity
        const timeOfNextIndex: number =
            nextNonBlankIndex !== undefined && nextNonBlankIndex !== -1
                ? rowsSortedByTimeAsc[nextNonBlankIndex][timeSlug]
                : Infinity

        const prevTimeDiff = Math.abs(timeOfPrevIndex - timeOfCurrent)
        const nextTimeDiff = Math.abs(timeOfNextIndex - timeOfCurrent)

        if (
            nextNonBlankIndex !== -1 &&
            nextTimeDiff <= prevTimeDiff &&
            nextTimeDiff <= timeTolerance
        ) {
            rowsSortedByTimeAsc[index] = {
                ...rowsSortedByTimeAsc[index],
                [valueSlug]: rowsSortedByTimeAsc[nextNonBlankIndex!][valueSlug],
                [timeSlug]: rowsSortedByTimeAsc[nextNonBlankIndex!][timeSlug],
            }
        } else if (prevTimeDiff <= timeTolerance) {
            rowsSortedByTimeAsc[index] = {
                ...rowsSortedByTimeAsc[index],
                [valueSlug]: rowsSortedByTimeAsc[prevNonBlankIndex!][valueSlug],
                [timeSlug]: rowsSortedByTimeAsc[prevNonBlankIndex!][timeSlug],
            }
        } else {
            rowsSortedByTimeAsc[index] = {
                ...rowsSortedByTimeAsc[index],
                [valueSlug]: InvalidCellTypes.NoValueWithinTolerance,
            }
        }
    }

    return rowsSortedByTimeAsc
}

// A dumb function for making a function that makes a key for a row given certain columns.
export const makeKeyFn = (
    columnStore: CoreColumnStore,
    columnSlugs: ColumnSlug[]
) => (rowIndex: number) =>
    columnSlugs.map((slug) => columnStore[slug][rowIndex].toString()).join(" ")

// Memoization for immutable getters. Run the function once for this instance and cache the result.
export const imemo = (
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<any>
) => {
    const originalFn = descriptor.get!
    descriptor.get = function (this: any) {
        const propName = `${propertyName}_memoized`
        if (this[propName] === undefined) {
            // Define the prop the long way so we don't enumerate over it
            Object.defineProperty(this, propName, {
                configurable: false,
                enumerable: false,
                writable: false,
                value: originalFn.apply(this),
            })
        }
        return this[propName]
    }
}

export const appendRowsToColumnStore = (
    columnStore: CoreColumnStore,
    rows: CoreRow[]
) => {
    const slugs = Object.keys(columnStore)
    const newColumnStore = columnStore
    slugs.forEach((slug) => {
        newColumnStore[slug] = columnStore[slug].concat(
            rows.map((row) => row[slug])
        )
    })
    return newColumnStore
}

export const concatColumnStores = (
    target: CoreColumnStore,
    source: CoreColumnStore
) => {
    const slugs = Object.keys(target)
    const newColumnStore: CoreColumnStore = {}
    slugs.forEach((slug) => {
        newColumnStore[slug] = target[slug].concat(source[slug])
    })
    return newColumnStore
}

export const rowsToColumnStore = (rows: CoreRow[]) => {
    const columnsObject: CoreColumnStore = {}
    if (!rows.length) return columnsObject

    Object.keys(rows[0]).forEach((slug) => {
        columnsObject[slug] = rows.map((row) => row[slug])
    })
    return columnsObject
}

const guessColumnDefsFromRows = (
    rows: CoreRow[],
    definedSlugs: Map<ColumnSlug, any>
) => {
    if (!rows[0]) return []
    return Object.keys(rows[0])
        .filter((slug) => !definedSlugs.has(slug))
        .map((slug) => {
            const firstRowWithValue = rows.find(
                (row) =>
                    row[slug] !== undefined &&
                    row[slug] !== null &&
                    row[slug] !== ""
            )
            const firstValue = firstRowWithValue
                ? firstRowWithValue[slug]
                : undefined

            return guessColumnDefFromSlugAndRow(slug, firstValue)
        })
}

export const autodetectColumnDefs = (
    rowsOrColumnStore: CoreColumnStore | CoreRow[],
    definedSlugs: Map<ColumnSlug, any>
) => {
    if (!Array.isArray(rowsOrColumnStore)) {
        const columnStore = rowsOrColumnStore as CoreColumnStore
        return Object.keys(columnStore)
            .filter((slug) => !definedSlugs.has(slug))
            .map((slug) => {
                return guessColumnDefFromSlugAndRow(
                    slug,
                    columnStore[slug].find(
                        (val) => val !== undefined && val !== null
                    )
                )
            })
    }
    return guessColumnDefsFromRows(rowsOrColumnStore, definedSlugs)
}

export const applyFilterMask = (
    columnStore: CoreColumnStore,
    filterMask: boolean[]
) => {
    const columnsObject: CoreColumnStore = {}
    Object.keys(columnStore).forEach((slug) => {
        columnsObject[slug] = columnStore[slug].filter(
            (slug, index) => filterMask[index]
        )
    })
    return columnsObject
}

// Convenience method when you are replacing columns
export const replaceDef = (defs: CoreColumnDef[], newDefs: CoreColumnDef[]) =>
    defs.map((def) => {
        const newDef = newDefs.find((newDef) => newDef.slug === def.slug)
        return newDef ?? def
    })

export const reverseColumnStore = (columnStore: CoreColumnStore) => {
    const newStore: CoreColumnStore = {}
    Object.keys(columnStore).forEach((slug) => {
        newStore[slug] = columnStore[slug].slice().reverse()
    })
    return newStore
}

export const renameColumnStore = (
    columnStore: CoreColumnStore,
    columnRenameMap: { [columnSlug: string]: ColumnSlug }
) => {
    const newStore: CoreColumnStore = {}
    Object.keys(columnStore).forEach((slug) => {
        if (columnRenameMap[slug])
            newStore[columnRenameMap[slug]] = columnStore[slug]
        else newStore[slug] = columnStore[slug]
    })
    return newStore
}

export const replaceNonPositives = (
    columnStore: CoreColumnStore,
    slugs: ColumnSlug[]
) => {
    const newStore: CoreColumnStore = Object.assign({}, columnStore)
    slugs.forEach((slug) => {
        newStore[slug] = newStore[slug].map((val) =>
            val <= 0 ? InvalidCellTypes.InvalidOnALogScale : val
        )
    })
    return newStore
}

// Returns a Set of random indexes to drop in an array, preserving the order of the array
export const getDropIndexes = (
    arrayLength: number,
    howMany: number,
    seed = Date.now()
) => new Set(sampleFrom(range(0, arrayLength), howMany, seed))

export const replaceRandomCellsInColumnStore = (
    columnStore: CoreColumnStore,
    howMany = 1,
    columnSlugs: ColumnSlug[] = [],
    seed = Date.now(),
    replacementGenerator: () => any = () => InvalidCellTypes.DroppedForTesting
) => {
    const newStore: CoreColumnStore = Object.assign({}, columnStore)
    columnSlugs.forEach((slug) => {
        const values = newStore[slug]
        const indexesToDrop = getDropIndexes(values.length, howMany, seed)
        newStore[slug] = values.map((value, index) =>
            indexesToDrop.has(index) ? replacementGenerator() : value
        )
    })
    return newStore
}
