import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export const ChartsTableName = "charts"
export interface DbInsertChart {
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
export type DbRawChart = Required<DbInsertChart>

export type DbEnrichedChart = Omit<DbRawChart, "config"> & {
    config: GrapherInterface
}

export function parseChartConfig(config: JsonString): GrapherInterface {
    return JSON.parse(config)
}

export function serializeChartConfig(config: GrapherInterface): JsonString {
    return JSON.stringify(config)
}

export function parseChartsRow(row: DbRawChart): DbEnrichedChart {
    return { ...row, config: parseChartConfig(row.config) }
}

export function serializeChartsRow(row: DbEnrichedChart): DbRawChart {
    return {
        ...row,
        config: serializeChartConfig(row.config),
    }
}
