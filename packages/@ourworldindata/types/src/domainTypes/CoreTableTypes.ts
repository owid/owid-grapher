import { OwidOrigin } from "../OwidOrigin.js"
import {
    OwidProcessingLevel,
    OwidVariablePresentation,
} from "../OwidVariable.js"
import { OwidVariableDisplayConfigInterface } from "../OwidVariableDisplayConfigInterface.js"
import {
    Color,
    ColumnSlug,
    PrimitiveType,
    Time,
    ToleranceStrategy,
    Year,
} from "../grapherTypes/GrapherTypes.js"
import { Integer } from "./Various.js"

export type TableSlug = string // a url friendly name for a table
export type ColumnSlugs = string // slugs cannot have spaces, so this is a space delimited array of ColumnSlugs

export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

/**
 * A concrete point in time (year or date). It's always supposed to be a finite number, but we
 * cannot enforce this in TypeScript.
 */
export type TimeRange = [Time, Time]

export type ValueRange = [number, number]

export type TimeTolerance = Integer

export interface CoreRow {
    [columnSlug: string]: any
}

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
    Concat = "Concat",
    Noop = "Noop", // for when we notice that we can skip a transform

    // Row ops
    FilterRows = "FilterRows",
    SortRows = "SortRows",
    UpdateRows = "UpdateRows", // replace values in a row. For example: to prep columns for log scale, or testing messy runtime data scenarios.

    // Column ops
    FilterColumns = "FilterColumns",
    AppendColumns = "AppendColumns", // This will run column transform fns.
    UpdateColumnDefs = "UpdateColumnDefs", // do not use for updates that add a column transform fn.
    UpdateColumnDefsAndApply = "UpdateColumnDefsAndApply", // use this for updates that add a column transform fn.
    RenameColumns = "RenameColumns",
    CombineColumns = "CombineColumns",
}

export enum JsTypes {
    string = "string",
    boolean = "boolean",
    number = "number",
}

export abstract class ErrorValue {
    toString(): string {
        return ""
    }
    toErrorString(): string {
        return this.constructor.name
    }
}

export type CsvString = string

export type CoreValueType = PrimitiveType | ErrorValue

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

export enum OwidTableSlugs {
    entityName = "entityName",
    entityColor = "entityColor",
    entityId = "entityId",
    entityCode = "entityCode",
    time = "time",
    day = "day",
    year = "year",
    date = "date",
}

enum OwidTableNames {
    Entity = "Entity",
    Code = "Code",
}

export type EntityName = string
export type EntityCode = string
export type EntityId = number

export interface Entity {
    entityName: EntityName
    entityId?: EntityId
    entityCode?: EntityCode
}

export enum ColumnTypeNames {
    NumberOrString = "NumberOrString",
    Numeric = "Numeric",
    String = "String",
    Region = "Region",
    SeriesAnnotation = "SeriesAnnotation",
    Categorical = "Categorical",
    Ordinal = "Ordinal",
    Continent = "Continent",
    EntityName = "EntityName",
    EntityId = "EntityId",
    EntityCode = "EntityCode",
    Boolean = "Boolean",
    Currency = "Currency",
    Percentage = "Percentage",
    RelativePercentage = "RelativePercentage",
    DecimalPercentage = "DecimalPercentage",
    Integer = "Integer",
    PercentChangeOverTime = "PercentChangeOverTime",
    Ratio = "Ratio",
    Year = "Year",
    Day = "Day",
    Date = "Date",
    Color = "Color",
    Population = "Population",
    PopulationDensity = "PopulationDensity",
    Age = "Age",
    Quarter = "Quarter",
}

export interface ColumnColorScale {
    // Color scales
    colorScaleScheme?: string
    colorScaleInvert?: boolean
    colorScaleBinningStrategy?: string
    colorScaleNumericMinValue?: number
    colorScaleNumericBins?: string
    colorScaleCategoricalBins?: string
    colorScaleNoDataLabel?: string
    colorScaleLegendDescription?: string
}

export interface CoreColumnDef extends ColumnColorScale {
    // Core
    slug: ColumnSlug
    type?: ColumnTypeNames

    // Computational
    transform?: string // Code that maps to a CoreTable transform
    transformHasRun?: boolean // If true, the transform has been applied
    tolerance?: number // If set, some charts can use this for an interpolation strategy.
    toleranceStrategy?: ToleranceStrategy // Tolerance strategy to use for interpolation
    skipParsing?: boolean // If set, the values will never run through the type parser

    // Column information used for display only
    name?: string // The display name for the column
    description?: string
    descriptionShort?: string
    descriptionProcessing?: string
    descriptionKey?: string[]
    descriptionFromProducer?: string
    note?: string // Any internal notes the author wants to record for display in admin interfaces

    // Sorted values (in case of ordinal data)
    sort?: string[]

    // Color
    color?: Color // A column can have a fixed color for use in charts where the columns are series

    // Source information used for display only
    sourceName?: string
    sourceLink?: string
    dataPublishedBy?: string
    dataPublisherSource?: string
    retrievedDate?: string
    additionalInfo?: string
    timespan?: string

    // Metadata v2
    origins?: OwidOrigin[]
    presentation?: OwidVariablePresentation
    updatePeriodDays?: number

    // Dataset information
    datasetId?: number
    datasetName?: string

    // Informational only
    targetTime?: number

    // For developer internal use only.
    values?: CoreValueType[]
    generator?: () => number // A function for generating synthetic data for testing
    growthRateGenerator?: () => number // A function for generating synthetic data for testing. Can probably combine with the above.

    // DEPRECATED
    unit?: string // DEPRECATED: use an existing column type or create a new one instead.
    shortUnit?: string // DEPRECATED: use an existing column type or create a new one instead.
    display?: OwidVariableDisplayConfigInterface // DEPRECATED: use an existing column type or create a new one instead, or migrate any properties you need onto this interface.
}

// Todo: coverage, datasetId, and datasetName can just be on source, right? or should we flatten source onto this?
export interface OwidColumnDef extends CoreColumnDef {
    owidVariableId?: number
    coverage?: string
    datasetId?: number
    datasetName?: string
    isDailyMeasurement?: boolean // todo: remove after mysql time refactor
    annotationsColumnSlug?: ColumnSlug
    nonRedistributable?: boolean
    skipParsing?: boolean
    catalogPath?: string
    owidProcessingLevel?: OwidProcessingLevel
    owidSchemaVersion?: number
    shortName?: string
}

export const OwidEntityNameColumnDef = {
    name: OwidTableNames.Entity,
    slug: OwidTableSlugs.entityName,
    type: ColumnTypeNames.EntityName,
}

export const OwidEntityIdColumnDef = {
    slug: OwidTableSlugs.entityId,
    type: ColumnTypeNames.EntityId,
}

export const OwidEntityCodeColumnDef = {
    name: OwidTableNames.Code,
    slug: OwidTableSlugs.entityCode,
    type: ColumnTypeNames.EntityCode,
}

export const StandardOwidColumnDefs: OwidColumnDef[] = [
    OwidEntityNameColumnDef,
    OwidEntityIdColumnDef,
    OwidEntityCodeColumnDef,
]

// This is a row with the additional columns specific to our OWID data model
export interface OwidRow extends CoreRow {
    entityName: EntityName
    time: Time
    entityCode?: EntityCode
    entityId?: EntityId
    year?: Year
    day?: Integer
    date?: string
}

export interface OwidVariableRow<ValueType extends PrimitiveType> {
    entityName: EntityName
    time: Time
    value: ValueType
    originalTime: Time
    originalValue?: ValueType
}
