import { EntityName } from "../domainTypes/CoreTableTypes"
import { PrimitiveType, ColumnSlug, Time } from "../grapherTypes/GrapherTypes"

/** Type definition for data retrieved from the `/grapher/slug.values.json` endpoint */
export interface GrapherValuesJson {
    entityName?: EntityName
    startTime?: Time
    endTime?: Time
    columns?: Record<ColumnSlug, GrapherValuesJsonDimension>
    values?: {
        endTime?: GrapherValuesJsonDataPoints
        startTime?: GrapherValuesJsonDataPoints
    }
    source: string
}

interface GrapherValuesJsonDimension {
    name: string
    unit?: string
    shortUnit?: string
    isProjection?: boolean
    yearIsDay?: boolean
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
