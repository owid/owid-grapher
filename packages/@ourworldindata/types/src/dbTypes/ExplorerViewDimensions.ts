import { JsonString } from "../domainTypes/Various"

export const ExplorerViewDimensionsTableName = "explorer_view_dimensions"

export interface DbInsertExplorerViewDimensions {
    id?: number
    chartConfigId: string
    dimensions: JsonString
}
