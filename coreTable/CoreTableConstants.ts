import { LegacyVariableDisplayConfigInterface } from "./LegacyVariableCode"

export declare type Integer = number
export declare type ColumnSlug = string // let's be very restrictive on valid column names to start.

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
    Date = "Date",
    Color = "Color",
}

export interface CoreColumnSpec {
    slug: ColumnSlug
    name?: string
    description?: string
    unit?: string
    shortUnit?: string
    fn?: ComputedColumnFn
    type?: ColumnTypeNames
    generator?: () => number // A function for generating synthetic data for testing
    growthRateGenerator?: () => number // A function for generating synthetic data for testing. Can probably combine with the above.
    display?: LegacyVariableDisplayConfigInterface // todo: move to OwidTable
}

// todo: move below to GrapherConstants or OwidTable?
export declare type Year = Integer
export declare type EntityName = string
export declare type EntityCode = string
export declare type EntityId = number
export declare type Time = Integer

export interface CoreRow {
    [columnName: string]: any
}

// todo: remove index param?
export declare type ComputedColumnFn = (row: CoreRow, index?: Integer) => any

export interface HasComputedColumn {
    fn: ComputedColumnFn
}
