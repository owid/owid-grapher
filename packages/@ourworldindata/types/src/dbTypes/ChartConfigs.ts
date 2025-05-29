import { Base64String, JsonString } from "../domainTypes/Various.js"
import {
    GrapherChartType,
    GrapherInterface,
} from "../grapherTypes/GrapherTypes.js"

export const ChartConfigsTableName = "chart_configs"
export interface DbInsertChartConfig {
    id: string
    patch: JsonString
    full: JsonString
    fullMd5?: Base64String
    slug?: string | null
    chartType?: GrapherChartType | null
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

export function parseChartConfigsRow<
    T extends Pick<DbRawChartConfig, "patch" | "full">,
>(
    row: T
): Omit<T, "patch" | "full"> & {
    patch: GrapherInterface
    full: GrapherInterface
} {
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
