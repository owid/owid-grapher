import { KeyChartLevel } from "../grapherTypes/GrapherTypes.js"
import { DbPlainTag } from "./Tags.js"

export const ChartTagsTableName = "chart_tags"
export interface DbInsertChartTag {
    chartId: number
    createdAt?: Date
    isApproved?: boolean
    keyChartLevel?: KeyChartLevel
    tagId: number
    updatedAt?: Date | null
}
export type DbPlainChartTag = Required<DbInsertChartTag>

/**
 * A common minimal union of the tags and chart_tags entities.
 * Used anywhere we're using the TagBadge component.
 */
export type DbChartTagJoin = Pick<DbPlainTag, "id" | "name"> &
    Partial<Pick<DbPlainChartTag, "isApproved" | "keyChartLevel">>
