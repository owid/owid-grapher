import { EntityName } from "../domainTypes/CoreTableTypes"
import { PrimitiveType, ColumnSlug } from "../grapherTypes/GrapherTypes"

/** Type definition for data retrieved from the `/grapher/slug.values.json` endpoint */
export interface GrapherValuesJson {
    entityName?: EntityName
    columns?: Record<ColumnSlug, GrapherValuesJsonDimension>
    endTime?: {
        y: GrapherValuesJsonDataPoint[]
        x?: GrapherValuesJsonDataPoint
    }
    startTime?: {
        y: GrapherValuesJsonDataPoint[]
        x?: GrapherValuesJsonDataPoint
    }
    source: string
}

interface GrapherValuesJsonDimension {
    name: string
    unit?: string
    shortUnit?: string
    isProjection?: boolean
}

export interface GrapherValuesJsonDataPoints {
    y: GrapherValuesJsonDataPoint[]
    x?: GrapherValuesJsonDataPoint
}

export interface GrapherValuesJsonDataPoint {
    columnSlug: string
    value?: PrimitiveType
    formattedValue?: string
    formattedValueShort?: string
    formattedValueShortWithAbbreviations?: string
    valueLabel?: string
    time?: number
    formattedTime?: string
}
