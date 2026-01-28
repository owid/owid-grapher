import { JsonString } from "../domainTypes/Various"

export const MultiDimViewDimensionsTableName = "multi_dim_view_dimensions"

export interface DbInsertMultiDimViewDimensions {
    id?: number
    chartConfigId: string
    dimensions: JsonString
}
