import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export const ChartConfigsTableName = "chart_configs"
export interface DbInsertChartConfig {
    id: string
    patch: JsonString
    full: JsonString
    slug?: string | null
    createdAt?: Date
    updatedAt?: Date | null
}
export type DbRawChartConfig = Required<DbInsertChartConfig>

export type DbEnrichedChartConfig = Omit<DbRawChartConfig, "patch" | "full"> & {
    patch: GrapherInterface
    full: GrapherInterface
}

export function parseChartConfig(config: JsonString): GrapherInterface {
    return JSON.parse(config)
}

export function serializeChartConfig(config: GrapherInterface): JsonString {
    return JSON.stringify(config)
}

export function parseChartConfigsRow(
    row: DbRawChartConfig
): DbEnrichedChartConfig {
    return {
        ...row,
        patch: parseChartConfig(row.patch),
        full: parseChartConfig(row.full),
    }
}

export function serializeChartsRow(
    row: DbEnrichedChartConfig
): DbRawChartConfig {
    return {
        ...row,
        patch: serializeChartConfig(row.patch),
        full: serializeChartConfig(row.full),
    }
}
