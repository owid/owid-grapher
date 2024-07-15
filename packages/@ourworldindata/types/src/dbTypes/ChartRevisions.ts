import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"
import { parseChartConfig, serializeChartConfig } from "./ChartConfigs.js"

export const ChartRevisionsTableName = "chart_revisions"
export interface DbInsertChartRevision {
    chartId?: number | null
    config?: JsonString | null
    createdAt?: Date
    id?: string
    updatedAt?: Date | null
    userId?: number | null
}
export type DbRawChartRevision = Required<DbInsertChartRevision>
export type DbEnrichedChartRevision = Omit<DbRawChartRevision, "config"> & {
    config: GrapherInterface | null
}

export function parseChartRevisionsRow(
    row: DbRawChartRevision
): DbEnrichedChartRevision {
    return { ...row, config: row.config ? parseChartConfig(row.config) : null }
}

export function serializeChartRevisionsRow(
    row: DbEnrichedChartRevision
): DbRawChartRevision {
    return {
        ...row,
        config: row.config ? serializeChartConfig(row.config) : null,
    }
}
