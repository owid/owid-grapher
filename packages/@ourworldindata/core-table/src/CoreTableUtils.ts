import * as _ from "lodash-es"
import * as Papa from "papaparse"
import * as R from "remeda"
import {
    findIndexFast,
    sampleFrom,
    slugifySameCase,
    ColumnSlug,
} from "@ourworldindata/utils"
import {
    CoreColumnStore,
    CoreRow,
    CoreMatrix,
    Time,
    CoreValueType,
    ColumnTypeNames,
    CoreColumnDef,
    ErrorValue,
    OwidEntityCodeColumnDef,
    OwidEntityIdColumnDef,
    OwidEntityNameColumnDef,
    OwidTableSlugs,
} from "@ourworldindata/types"
import {
    ErrorValueTypes,
    isNotErrorValueOrEmptyCell,
    DroppedForTesting,
} from "./ErrorValues.js"

export const columnStoreToRows = (
    columnStore: CoreColumnStore
): Record<string, CoreValueType>[] => {
    const firstCol = Object.values(columnStore)[0]
    if (!firstCol) return []
    const slugs = Object.keys(columnStore)
    return firstCol.map((val, index) => {
        const newRow: Record<string, CoreValueType> = {}
        slugs.forEach((slug) => {
            newRow[slug] = columnStore[slug][index]
        })
        return newRow
    })
}

// If string exceeds maxLength, will replace the end char with a ... and drop the rest
export const truncate = (str: string, maxLength: number): string =>
    str.length > maxLength ? `${str.substr(0, maxLength - 3)}...` : str

// Picks a type for each column from the first row then autotypes all rows after that so all values in
// a column will have the same type. Only chooses between strings and numbers.
const numberOnly = /^-?\d+\.?\d*$/
type RawRow = Record<string, unknown> | undefined
type ParsedRow = Record<string, string | number | ErrorValue> | undefined | null
export const makeAutoTypeFn = (
    numericSlugs?: ColumnSlug[]
): ((object?: RawRow) => ParsedRow) => {
    const slugToType: any = {}
    numericSlugs?.forEach((slug) => {
        slugToType[slug] = "number"
    })
    return (object: RawRow): ParsedRow => {
        for (const columnSlug in object) {
            const value = object[columnSlug]
            const type = slugToType[columnSlug]
            if (type === "string") {
                object[columnSlug] = value
                continue
            }

            const number = parseFloat(value as string) // The "+" type casting that d3 does for perf converts "" to 0, so use parseFloat.
            if (type === "number") {
                object[columnSlug] = isNaN(number)
                    ? ErrorValueTypes.NaNButShouldBeNumber
                    : number
                continue
            }

            if (isNaN(number) || !numberOnly.test(value as string)) {
                object[columnSlug] = value
                slugToType[columnSlug] = "string"
                continue
            }

            object[columnSlug] = number
            slugToType[columnSlug] = "number"
        }
        return object as ParsedRow
    }
}

// Removes whitespace and non-word characters from column slugs if any exist.
// The original names are moved to the name property on the column def.
export const standardizeSlugs = (
    rows: CoreRow[]
): { rows: CoreRow[]; defs: { name: string; slug: string }[] } | undefined => {
    const firstRow = rows[0] ?? {}
    const colsToRename = Object.keys(firstRow)
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
    sampleValue: unknown
): CoreColumnDef => {
    const valueType = typeof sampleValue

    const name = slug

    if (slug === "Entity")
        return {
            slug,
            type: ColumnTypeNames.EntityName,
            name,
        }

    if (slug === "day")
        return {
            slug,
            type: ColumnTypeNames.Day,
            name: "Day",
        }

    if (slug === "year" || slug === "Year")
        return {
            slug,
            type: ColumnTypeNames.Year,
            name: "Year",
        }

    if (slug === OwidTableSlugs.entityName) return OwidEntityNameColumnDef
    if (slug === OwidTableSlugs.entityCode) return OwidEntityCodeColumnDef
    if (slug === OwidTableSlugs.entityId) return OwidEntityIdColumnDef

    if (slug === "date")
        return {
            slug,
            type: ColumnTypeNames.Date,
            name: "Date",
        }

    if (valueType === "number")
        return {
            slug,
            type: ColumnTypeNames.Numeric,
            name,
        }

    if (valueType === "string") {
        if (String(sampleValue).match(/^\d+$/))
            return {
                slug,
                type: ColumnTypeNames.Numeric,
                name,
            }
    }

    return { slug, type: ColumnTypeNames.String, name }
}

export const makeRowFromColumnStore = (
    rowIndex: number,
    columnStore: CoreColumnStore
): CoreRow => {
    const row: CoreRow = {}
    Object.entries(columnStore).forEach(([slug, col]) => {
        if (col.length <= rowIndex) row[slug] = undefined
        else row[slug] = col[rowIndex]
    })
    return row
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface InterpolationContext {}

export interface LinearInterpolationContext extends InterpolationContext {
    // whether to extrapolate a variable at the start or end, where we cannot do linear interpolation
    // but need to just copy over the first/last value present over to empty fields.
    // e.g. [Error, Error, 2, 3, 4] would become [2, 2, 2, 3, 4] with extrapolateAtStart=true.
    extrapolateAtStart?: boolean
    extrapolateAtEnd?: boolean
}

export interface ToleranceInterpolationContext extends InterpolationContext {
    timeToleranceForwards: number
    timeToleranceBackwards: number
}

export type InterpolationProvider<C extends InterpolationContext> = (
    valuesSortedByTimeAsc: (number | ErrorValue)[],
    timesAsc: Time[],
    context: C,
    start: number,
    end: number
) => void

export function linearInterpolation(
    valuesSortedByTimeAsc: (number | ErrorValue)[],
    timesAsc: Time[],
    context: LinearInterpolationContext,
    start: number = 0,
    end: number = valuesSortedByTimeAsc.length
): void {
    if (!valuesSortedByTimeAsc.length) return

    let prevNonBlankIndex = -1
    let nextNonBlankIndex = -1

    for (let index = start; index < end; index++) {
        const currentValue = valuesSortedByTimeAsc[index]
        if (isNotErrorValueOrEmptyCell(currentValue)) {
            prevNonBlankIndex = index
            continue
        }

        if (nextNonBlankIndex === -1 || nextNonBlankIndex <= index) {
            nextNonBlankIndex = findIndexFast(
                valuesSortedByTimeAsc,
                (val) => isNotErrorValueOrEmptyCell(val),
                index + 1,
                end
            )
        }

        const prevValue = valuesSortedByTimeAsc[prevNonBlankIndex]
        const nextValue = valuesSortedByTimeAsc[nextNonBlankIndex]

        let value
        if (
            isNotErrorValueOrEmptyCell(prevValue) &&
            isNotErrorValueOrEmptyCell(nextValue)
        ) {
            const distLeft = index - prevNonBlankIndex
            const distRight = nextNonBlankIndex - index
            value =
                (prevValue * distRight + nextValue * distLeft) /
                (distLeft + distRight)
        } else if (
            isNotErrorValueOrEmptyCell(prevValue) &&
            context.extrapolateAtEnd
        )
            value = prevValue
        else if (
            isNotErrorValueOrEmptyCell(nextValue) &&
            context.extrapolateAtStart
        )
            value = nextValue
        else value = ErrorValueTypes.NoValueForInterpolation

        prevNonBlankIndex = index

        valuesSortedByTimeAsc[index] = value
    }
}

export function toleranceInterpolation(
    valuesSortedByTimeAsc: (number | ErrorValue)[],
    timesAsc: Time[],
    context: ToleranceInterpolationContext,
    start: number = 0,
    end: number = valuesSortedByTimeAsc.length
): void {
    if (!valuesSortedByTimeAsc.length) return

    let prevNonBlankIndex: number | undefined = undefined
    let nextNonBlankIndex: number | undefined = undefined

    for (let index = start; index < end; index++) {
        const currentValue = valuesSortedByTimeAsc[index]
        if (isNotErrorValueOrEmptyCell(currentValue)) {
            prevNonBlankIndex = index
            continue
        }

        if (
            context.timeToleranceForwards > 0 &&
            nextNonBlankIndex !== -1 &&
            (nextNonBlankIndex === undefined || nextNonBlankIndex <= index)
        ) {
            nextNonBlankIndex = findIndexFast(
                valuesSortedByTimeAsc,
                isNotErrorValueOrEmptyCell,
                index + 1,
                end
            )
        }

        const timeOfCurrent = timesAsc[index]
        const timeOfPrevIndex =
            prevNonBlankIndex !== undefined
                ? timesAsc[prevNonBlankIndex]
                : -Infinity
        const timeOfNextIndex =
            nextNonBlankIndex !== undefined && nextNonBlankIndex !== -1
                ? timesAsc[nextNonBlankIndex]
                : Infinity

        const prevTimeDiff = Math.abs(timeOfPrevIndex - timeOfCurrent)
        const nextTimeDiff = Math.abs(timeOfNextIndex - timeOfCurrent)

        if (
            nextNonBlankIndex !== -1 &&
            nextTimeDiff <= prevTimeDiff &&
            nextTimeDiff <= context.timeToleranceForwards
        ) {
            valuesSortedByTimeAsc[index] =
                valuesSortedByTimeAsc[nextNonBlankIndex!]
            timesAsc[index] = timesAsc[nextNonBlankIndex!]
        } else if (
            prevNonBlankIndex !== undefined &&
            prevTimeDiff <= context.timeToleranceBackwards
        ) {
            valuesSortedByTimeAsc[index] =
                valuesSortedByTimeAsc[prevNonBlankIndex!]
            timesAsc[index] = timesAsc[prevNonBlankIndex!]
        } else
            valuesSortedByTimeAsc[index] =
                ErrorValueTypes.NoValueWithinTolerance
    }
}

// A dumb function for making a function that makes a key for a row given certain columns.
export const makeKeyFn = (
    columnStore: CoreColumnStore,
    columnSlugs: ColumnSlug[]
): ((rowIndex: number) => string) => {
    const cols = columnSlugs.map((slug) => columnStore[slug])

    const toStr = (val: CoreValueType): string =>
        val === null || val === undefined
            ? ""
            : typeof val === "string"
              ? val
              : (val as any) + ""

    // perf: this function is performance-critical, and so for the common cases of 1, 2, or 3 columns, we can provide a
    // faster implementation.
    if (cols.length === 0) return () => ""
    if (cols.length === 1) {
        const col = cols[0]
        return (rowIndex: number): string => toStr(col[rowIndex])
    }
    if (cols.length === 2) {
        const col0 = cols[0],
            col1 = cols[1]
        return (rowIndex: number): string =>
            `${toStr(col0[rowIndex])} ${toStr(col1[rowIndex])}`
    }
    if (cols.length === 3) {
        const col0 = cols[0],
            col1 = cols[1],
            col2 = cols[2]
        return (rowIndex: number): string =>
            `${toStr(col0[rowIndex])} ${toStr(col1[rowIndex])} ${toStr(
                col2[rowIndex]
            )}`
    }

    return (rowIndex: number): string =>
        // toString() handles `undefined` and `null` values, which can be in the table.
        cols.map((col) => toStr(col[rowIndex])).join(" ")
}

const getColumnStoreLength = (store: CoreColumnStore): number => {
    return _.max(Object.values(store).map((v) => v.length)) ?? 0
}

export const concatColumnStores = (
    stores: CoreColumnStore[],
    slugsToKeep?: ColumnSlug[]
): CoreColumnStore => {
    if (!stores.length) return {}

    const lengths = stores.map(getColumnStoreLength)
    const slugs = slugsToKeep ?? Object.keys(R.first(stores)!)

    const newColumnStore: CoreColumnStore = {}

    // The below code is performance-critical.
    // That's why it's written using for loops and mutable arrays rather than using map or flatMap:
    // To this day, that's still faster in JS.
    slugs.forEach((slug) => {
        let newColumnValues: CoreValueType[] = []
        for (const [i, store] of stores.entries()) {
            const values = store[slug] ?? []
            const toFill = Math.max(0, lengths[i] - values.length)

            newColumnValues = newColumnValues.concat(values)
            if (toFill > 0) {
                newColumnValues = newColumnValues.concat(
                    new Array(toFill).fill(
                        ErrorValueTypes.MissingValuePlaceholder
                    )
                )
            }
        }
        newColumnStore[slug] = newColumnValues
    })
    return newColumnStore
}

export const rowsToColumnStore = (rows: CoreRow[]): CoreColumnStore => {
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
): CoreColumnDef[] => {
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
): CoreColumnDef[] => {
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

// Convenience method when you are replacing columns
export const replaceDef = <ColumnDef extends CoreColumnDef>(
    defs: ColumnDef[],
    newDefs: ColumnDef[]
): ColumnDef[] =>
    defs.map((def) => {
        const newDef = newDefs.find((newDef) => newDef.slug === def.slug)
        return newDef ?? def
    })

export const renameColumnStore = (
    columnStore: CoreColumnStore,
    columnRenameMap: { [columnSlug: string]: ColumnSlug }
): CoreColumnStore => {
    const newStore: CoreColumnStore = {}
    Object.keys(columnStore).forEach((slug) => {
        if (columnRenameMap[slug])
            newStore[columnRenameMap[slug]] = columnStore[slug]
        else newStore[slug] = columnStore[slug]
    })
    return newStore
}

// Returns a Set of random indexes to drop in an array, preserving the order of the array
export const getDropIndexes = (
    arrayLength: number,
    howMany: number,
    seed = Date.now()
): Set<number> => new Set(sampleFrom(_.range(0, arrayLength), howMany, seed))

export const replaceRandomCellsInColumnStore = (
    columnStore: CoreColumnStore,
    howMany = 1,
    columnSlugs: ColumnSlug[] = [],
    seed = Date.now(),
    replacementGenerator: () => any = (): DroppedForTesting =>
        ErrorValueTypes.DroppedForTesting
): CoreColumnStore => {
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

export class Timer {
    constructor() {
        this._tickTime = Date.now()
        this._firstTickTime = this._tickTime
    }

    private _tickTime: number
    private _firstTickTime: number

    tick(msg?: string): number {
        const elapsed = Date.now() - this._tickTime
        // eslint-disable-next-line no-console
        if (msg) console.log(`${elapsed}ms ${msg}`)
        this._tickTime = Date.now()
        return elapsed
    }

    getTotalElapsedTime(): number {
        return Date.now() - this._firstTickTime
    }
}

export const rowsFromMatrix = (matrix: CoreMatrix): any[] => {
    const table = trimMatrix(matrix)
    const header = table[0]
    return table.slice(1).map((row) => {
        const newRow: any = {}
        header.forEach((col, index) => {
            newRow[col] = row[index]
        })
        return newRow
    })
}

const trimEmptyColumns = (matrix: CoreMatrix): CoreMatrix =>
    matrix.map(trimArray)
export const trimMatrix = (matrix: CoreMatrix): CoreMatrix =>
    trimEmptyColumns(trimEmptyRows(matrix))

export const matrixToDelimited = (
    table: CoreMatrix,
    delimiter = "\t"
): string => {
    return table
        .map((row: any) =>
            row
                .map((cell: any) =>
                    cell === null || cell === undefined ? "" : cell
                )
                .join(delimiter)
        )
        .join("\n")
}

/**
 * An array object representing all parsed rows. The array is enhanced with a property listing
 * the names of the parsed columns.
 */
export interface DSVParsedArray<T> extends Array<T> {
    /**
     * List of column names.
     */
    columns: Array<keyof T>
}

export const parseDelimited = (
    str: string,
    delimiter?: string,
    parseFn?: (rawRow: RawRow) => ParsedRow
): DSVParsedArray<Record<string, any>> => {
    // Convert PapaParse result to D3 format for backwards compatibility
    const papaParseToD3 = ({
        data,
        meta,
    }: Papa.ParseResult<any>): DSVParsedArray<Record<string, any>> => {
        const dsvParsed = data as DSVParsedArray<Record<string, any>>
        dsvParsed.columns = meta.fields || []

        // Some downstream methods expect all rows to have fields for all columns,
        // even if they are missing in that row. This loop ensures that.
        for (const row of dsvParsed) {
            for (const col of dsvParsed.columns) {
                if (!(col in row)) row[col] = ""
            }
        }

        return dsvParsed
    }

    const result = Papa.parse(str, {
        delimiter: delimiter ?? detectDelimiter(str),
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        transform: (value: string) => value.trim(),
    })

    if (parseFn) {
        result.data = result.data.map((rawRow) => parseFn(rawRow as RawRow))
    }

    return papaParseToD3(result)
}

export const detectDelimiter = (str: string): "\t" | "," | " " =>
    str.includes("\t") ? "\t" : str.includes(",") ? "," : " "

export const rowsToMatrix = (rows: any[]): CoreMatrix | undefined =>
    rows.length
        ? [Object.keys(rows[0]), ...rows.map((row) => Object.values(row))]
        : undefined

const isRowEmpty = (row: any[]): boolean => row.every(isCellEmpty)

export const isCellEmpty = (cell: unknown): boolean =>
    cell === null || cell === undefined || cell === ""

export const trimEmptyRows = (matrix: CoreMatrix): CoreMatrix => {
    let trimAt = undefined
    for (let rowIndex = matrix.length - 1; rowIndex >= 0; rowIndex--) {
        if (!isRowEmpty(matrix[rowIndex])) break
        trimAt = rowIndex
    }
    return trimAt === undefined ? matrix : matrix.slice(0, trimAt)
}

export const trimArray = (arr: any[]): any[] => {
    let rightIndex: number
    for (rightIndex = arr.length - 1; rightIndex >= 0; rightIndex--) {
        if (!isCellEmpty(arr[rightIndex])) break
    }
    return arr.slice(0, rightIndex + 1)
}

const applyNewSortOrder = (arr: any[], newOrder: number[]): any[] => {
    const newArr = new Array(arr.length)
    for (let i = 0; i < newOrder.length; i++) {
        const index = newOrder[i]
        newArr[i] = arr[index]
    }
    return newArr
}

export const sortColumnStore = (
    columnStore: CoreColumnStore,
    slugs: ColumnSlug[]
): CoreColumnStore => {
    const firstCol = Object.values(columnStore)[0]
    if (!firstCol) return {}
    const len = firstCol.length
    const sortFn = makeSortByFn(columnStore, slugs)

    // Check if column store is already sorted.
    // If it's not sorted, we will detect that within the first few iterations usually.
    let isSorted = true
    for (let i = 0; i < len - 1; i++) {
        if (sortFn(i, i + 1) > 0) {
            isSorted = false
            break
        }
    }
    // Column store is already sorted; return existing store unchanged
    if (isSorted) return columnStore

    const newStore: CoreColumnStore = {}
    // Compute an array of the new sort order, i.e. [0, 1, 2, ...] -> [2, 0, 1]
    const newOrder = _.range(0, len).sort(sortFn)
    Object.entries(columnStore).forEach(([slug, colValues]) => {
        newStore[slug] = applyNewSortOrder(colValues, newOrder)
    })

    return newStore
}

const makeSortByFn = (
    columnStore: CoreColumnStore,
    columnSlugs: ColumnSlug[]
): ((indexA: number, indexB: number) => 1 | 0 | -1) => {
    const cols = columnSlugs.map((slug) => columnStore[slug])

    return (indexA: number, indexB: number): 1 | 0 | -1 => {
        const nodeAFirst = -1
        const nodeBFirst = 1

        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let colIndex = 0; colIndex < cols.length; colIndex++) {
            const col = cols[colIndex]
            const av = col[indexA]
            const bv = col[indexB]
            if (av < bv) return nodeAFirst
            if (av > bv) return nodeBFirst
            // todo: handle ErrorValues
        }
        return 0
    }
}

export const emptyColumnsInFirstRowInDelimited = (str: string): string[] => {
    // todo: don't split a big string here, just do a faster first line scan
    const shortCsv = parseDelimited(str.split("\n").slice(0, 2).join("\n"))
    const firstRow: any = shortCsv[0] ?? {}
    const emptySlugs: string[] = []
    Object.keys(firstRow).forEach((slug) => {
        if (firstRow[slug] === "") emptySlugs.push(slug)
    })
    return emptySlugs
}
