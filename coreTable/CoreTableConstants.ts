import { LegacyVariableDisplayConfigInterface } from "./LegacyVariableCode"

export type Integer = number
export type ColumnSlug = string // let's be very restrictive on valid column names to start.

export enum SortOrder {
    asc = "asc",
    desc = "desc",
}

export type ValueRange = [number, number]

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

export interface CoreColumnDef {
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

// todo: remove index param?
export type ComputedColumnFn = (row: CoreRow, index?: Integer) => any

export interface HasComputedColumn {
    fn: ComputedColumnFn
}
