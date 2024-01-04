import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"
import { parseChartConfig, serializeChartConfig } from "./Charts.js"

export const ChartRevisionsRowTableName = "chart_revisions"
export interface ChartRevisionsRowForInsert {
    chartId?: number | null
    config?: JsonString | null
    createdAt?: Date
    id?: string
    updatedAt?: Date | null
    userId?: number | null
}
export type ChartRevisionsRowRaw = Required<ChartRevisionsRowForInsert>
export type ChartRevisionsRowEnriched = Omit<ChartRevisionsRowRaw, "config"> & {
    config: GrapherInterface | null
}

export function parseChartRevisionsRow(
    row: ChartRevisionsRowRaw
): ChartRevisionsRowEnriched {
    return { ...row, config: row.config ? parseChartConfig(row.config) : null }
}

export function serializeChartRevisionsRow(
    row: ChartRevisionsRowEnriched
): ChartRevisionsRowRaw {
    return {
        ...row,
        config: row.config ? serializeChartConfig(row.config) : null,
    }
}
