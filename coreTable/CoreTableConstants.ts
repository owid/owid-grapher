import { InvalidCell } from "./InvalidCells"

export type Integer = number
export type TableSlug = string // a url friendly name for a table
export type ColumnSlug = string // a url friendly name for a column in a table. cannot have spaces
export type ColumnSlugs = string // slugs cannot have spaces, so this is a space delimited array of ColumnSlugs

export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export type ValueRange = [number, number]

export enum InputType {
    Delimited = "Delimited",
    RowStore = "RowStore",
    ColumnStore = "ColumnStore",
    Matrix = "Matrix",
}

export enum TransformType {
    // Table level ops
    LoadFromDelimited = "LoadFromDelimited",
    LoadFromRowStore = "LoadFromRowStore",
    LoadFromColumnStore = "LoadFromColumnStore",
    LoadFromMatrix = "LoadFromMatrix",
    Transpose = "Transpose",
    Concat = "Concat",
    Reduce = "Reduce",

    // Row ops
    FilterRows = "FilterRows",
    SortRows = "SortRows",
    AppendRows = "AppendRows", // todo: should this will also rerun any column transforms on the new rows?
    UpdateRows = "UpdateRows", // replace values in a row. For example: to prep columns for log scale, or testing messy runtime data scenarios.
    InverseFilterRows = "InverseFilterRows",

    // Column ops
    FilterColumns = "FilterColumns",
    SortColumns = "SortColumns",
    AppendColumns = "AppendColumns", // This will run column transform fns.
    UpdateColumnDefs = "UpdateColumnDefs", // do not use for updates that add a column transform fn.
    RenameColumns = "RenameColumns",
    InverseFilterColumns = "InverseFilterColumns",
}

export type Year = Integer
export type Color = string

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type Time = Integer
export type TimeRange = [Time, Time]
export type TimeTolerance = Integer

export interface CoreRow {
    [columnSlug: string]: any
}

export type PrimitiveType = number | string | boolean

export enum JsTypes {
    string = "string",
    boolean = "boolean",
    number = "number",
}

export type CsvString = string

export type CoreValueType = PrimitiveType | InvalidCell

/**
 * An Object Literal of Column Slugs and Primitives of the same type:
 * {
 *  score: [1, 2, 3],
 *  year: [2000, 2001]
 * }
 */
export type CoreColumnStore = {
    [columnSlug: string]: CoreValueType[]
}

export type CoreTableInputOption =
    | CoreRow[]
    | CoreColumnStore
    | CsvString
    | CoreMatrix

// Every row will be checked against each column/value(s) pair.
export interface CoreQuery {
    [columnSlug: string]: PrimitiveType | PrimitiveType[]
}

type CoreVector = any[]

/**
 * This is just an array of arrays where the first array is the header and the rest are rows. An example is:
 * [["country", "gdp"],
 * ["usa", 123],
 * ["can", 456]]
 * Having this type is just to provide a common unique name for the basic structure used by HandsOnTable
 * and some other popular JS data libraries.
 */
export type CoreMatrix = CoreVector[]
