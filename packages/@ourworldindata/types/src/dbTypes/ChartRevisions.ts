import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export const ChartRevisionsTableName = "chart_revisions"
export interface DbInsertChartRevision {
    chartId?: number | null
    config?: JsonString | null
    createdAt?: Date
    id?: string
    updatedAt?: Date
    userId?: number | null
}
export type DbRawChartRevision = Required<DbInsertChartRevision>
export type DbEnrichedChartRevision = Omit<DbRawChartRevision, "config"> & {
    config: GrapherInterface | null
}
