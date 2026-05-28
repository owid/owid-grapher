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
    etlConfig?: JsonString | null
    fullMd5?: Base64String
    slug?: string | null
    chartType?: GrapherChartType | null
    createdAt?: Date
    updatedAt?: Date
}
export type DbRawChartConfig = Omit<
    Required<DbInsertChartConfig>,
    "etlConfig"
> & {
    etlConfig: JsonString | null
}

export type DbEnrichedChartConfig = Omit<
    DbRawChartConfig,
    "patch" | "full" | "etlConfig"
> & {
    patch: GrapherInterface
    full: GrapherInterface
    etlConfig: GrapherInterface | null
}

export function parseChartConfig(config: JsonString): GrapherInterface {
    return JSON.parse(config)
}

export function serializeChartConfig(config: GrapherInterface): JsonString {
    return JSON.stringify(config)
}

export function parseChartConfigsRow<
    T extends Pick<DbRawChartConfig, "patch" | "full"> & {
        etlConfig?: JsonString | null
    },
>(
    row: T
): Omit<T, "patch" | "full" | "etlConfig"> & {
    patch: GrapherInterface
    full: GrapherInterface
    etlConfig: GrapherInterface | null
} {
    return {
        ...row,
        patch: parseChartConfig(row.patch),
        full: parseChartConfig(row.full),
        etlConfig: row.etlConfig ? parseChartConfig(row.etlConfig) : null,
    }
}

export function serializeChartsRow(
    row: DbEnrichedChartConfig
): DbRawChartConfig {
    return {
        ...row,
        patch: serializeChartConfig(row.patch),
        full: serializeChartConfig(row.full),
        etlConfig: row.etlConfig ? serializeChartConfig(row.etlConfig) : null,
    }
}
