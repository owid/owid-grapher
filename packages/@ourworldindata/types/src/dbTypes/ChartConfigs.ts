import { JsonString } from "../domainTypes/Various.js"
import { GrapherInterface } from "../grapherTypes/GrapherTypes.js"

export const ChartConfigsTableName = "chart_configs"
export interface DbInsertChartConfig {
    id: string
    uuid?: string
    patchConfig: JsonString
    config: JsonString
    createdAt?: Date
    updatedAt?: Date | null
}
export type DbRawChartConfig = Required<DbInsertChartConfig>

export type DbEnrichedChartConfig = Omit<
    DbRawChartConfig,
    "patchConfig" | "config"
> & {
    patchConfig: GrapherInterface
    config: GrapherInterface
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
        patchConfig: parseChartConfig(row.patchConfig),
        config: parseChartConfig(row.config),
    }
}

export function serializeChartsRow(
    row: DbEnrichedChartConfig
): DbRawChartConfig {
    return {
        ...row,
        patchConfig: serializeChartConfig(row.patchConfig),
        config: serializeChartConfig(row.config),
    }
}
