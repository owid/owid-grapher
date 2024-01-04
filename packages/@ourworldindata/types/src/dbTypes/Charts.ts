import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export const ChartsRowTableName = "charts"
export interface ChartsRowForInsert {
    config: JsonString
    createdAt?: Date
    id?: number
    is_indexable?: number
    isExplorable?: number
    lastEditedAt: Date
    lastEditedByUserId: number
    publishedAt?: Date | null
    publishedByUserId?: number | null
    slug?: string | null
    type?: string | null
    updatedAt?: Date | null
}
export type ChartsRowRaw = Required<ChartsRowForInsert>

export type ChartsRowEnriched = Omit<ChartsRowRaw, "config"> & {
    config: GrapherInterface
}

export function parseChartConfig(config: JsonString): GrapherInterface {
    return JSON.parse(config)
}

export function serializeChartConfig(config: GrapherInterface): JsonString {
    return JSON.stringify(config)
}

export function parseChartRevisionsRow(row: ChartsRowRaw): ChartsRowEnriched {
    return { ...row, config: parseChartConfig(row.config) }
}

export function serializeChartRevisionsRow(
    row: ChartsRowEnriched
): ChartsRowRaw {
    return {
        ...row,
        config: serializeChartConfig(row.config),
    }
}
