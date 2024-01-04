import { KeyChartLevel } from "../grapherTypes/GrapherTypes.js"
import { Tag } from "./Tags.js"

export const ChartTagsRowTableName = "chart_tags"
export interface ChartTagsRowForInsert {
    chartId: number
    createdAt?: Date
    isApproved?: boolean
    keyChartLevel?: KeyChartLevel
    tagId: number
    updatedAt?: Date | null
}
export type ChartTagsRow = Required<ChartTagsRowForInsert>

/**
 * A common minimal union of the tags and chart_tags entities.
 * Used anywhere we're using the TagBadge component.
 */
export type ChartTagJoin = Pick<Tag, "id" | "name"> &
    Partial<Pick<ChartTagsRow, "isApproved" | "keyChartLevel">>
