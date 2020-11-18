import { LegacyVariableDisplayConfigInterface } from "./LegacyVariableCode"
import {
    ColumnSlug,
    CoreValueType,
    Color,
    CoreRow,
    Integer,
} from "./CoreTableConstants"

export enum ColumnTypeNames {
    Numeric = "Numeric",
    String = "String",
    Region = "Region",
    SeriesAnnotation = "SeriesAnnotation",
    Categorical = "Categorical",
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
    Population = "Population",
    PopulationDensity = "PopulationDensity",
    PercentChangeOverTime = "PercentChangeOverTime",
    Age = "Age",
    Ratio = "Ratio",
    Year = "Year",
    Day = "Day",
    Date = "Date",
    Color = "Color",
}

export interface CoreColumnDef {
    slug: ColumnSlug
    name?: string
    description?: string
    unit?: string
    shortUnit?: string
    transform?: string // Code that maps to a CoreTable transform
    values?: CoreValueType[] // Similar to Fn, but the already computed values.
    type?: ColumnTypeNames
    generator?: () => number // A function for generating synthetic data for testing
    growthRateGenerator?: () => number // A function for generating synthetic data for testing. Can probably combine with the above.
    display?: LegacyVariableDisplayConfigInterface // todo: move to OwidTable
    color?: Color // A column can have a color for use in charts.
    note?: string // Any internal notes

    tolerance?: number // If set, some charts can use this for an interpolation strategy.

    // Source information:
    sourceName?: string
    sourceLink?: string
    dataPublishedBy?: string
    dataPublisherSource?: string
    retrievedDate?: string
    additionalInfo?: string
}

// todo: remove index param?
// todo: improve typings on this
export type ColumnFn = (row: CoreRow, index?: Integer) => any
