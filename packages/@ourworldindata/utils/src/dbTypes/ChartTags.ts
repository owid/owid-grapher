import { KeyChartLevel } from "../domainTypes/Charts.js"

/** the entity in the `chart_tags` table */
export interface ChartTag {
    id: number
    tagId: string
    keyChartLevel?: KeyChartLevel
    createdAt: Date
    updatedAt: Date | null
    isApproved?: boolean
}

/**
 * A common minimal union of the tags and chart_tags entities.
 * Used anywhere we're using the TagBadge component.
 */
export type ChartTagJoin = Pick<Tag, "id" | "name"> &
    Pick<ChartTag, "isApproved" | "keyChartLevel">
