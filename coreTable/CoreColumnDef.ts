import { OwidVariableDisplayConfigInterface } from "../clientUtils/OwidVariableDisplayConfigInterface.js"
import { ColumnSlug } from "../clientUtils/owidTypes.js"
import { CoreValueType, Color } from "./CoreTableConstants.js"

export enum ColumnTypeNames {
    NumberOrString = "NumberOrString",
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
    colorScaleEqualSizeBins?: boolean
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
    tolerance?: number // If set, some charts can use this for an interpolation strategy.
    skipParsing?: boolean // If set, the values will never run through the type parser

    // Column information used for display only
    name?: string // The display name for the column
    description?: string
    note?: string // Any internal notes the author wants to record for display in admin interfaces

    // Color
    color?: Color // A column can have a fixed color for use in charts where the columns are series

    // Source information used for display only
    sourceName?: string
    sourceLink?: string
    dataPublishedBy?: string
    dataPublisherSource?: string
    retrievedDate?: string
    additionalInfo?: string

    // For developer internal use only.
    values?: CoreValueType[]
    generator?: () => number // A function for generating synthetic data for testing
    growthRateGenerator?: () => number // A function for generating synthetic data for testing. Can probably combine with the above.

    // DEPRECATED
    unit?: string // DEPRECATED: use an existing column type or create a new one instead.
    shortUnit?: string // DEPRECATED: use an existing column type or create a new one instead.
    display?: OwidVariableDisplayConfigInterface // DEPRECATED: use an existing column type or create a new one instead, or migrate any properties you need onto this interface.
}
