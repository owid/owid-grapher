export declare type Integer = number
export declare type ColumnSlug = string // let's be very restrictive on valid column names to start.

export enum ColumnTypeNames {
    Numeric = "Numeric",
    String = "String",
    Categorical = "Categorical",
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
}

// todo: move below to GrapherConstants or OwidTable?
export declare type Year = Integer
export declare type EntityName = string
export declare type EntityCode = string
export declare type EntityId = number
