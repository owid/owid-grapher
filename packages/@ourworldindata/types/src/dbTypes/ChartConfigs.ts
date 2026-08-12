import { Base64String, JsonString } from "../domainTypes/Various.js"
import {
    GrapherChartType,
    GrapherInterface,
} from "../grapherTypes/GrapherTypes.js"

export const ChartConfigsTableName = "chart_configs"
export interface DbInsertChartConfig {
    id: string
    config: JsonString
    createdAt?: Date
    updatedAt?: Date
}

export type DbRawChartConfig = Required<DbInsertChartConfig> & {
    slug: string | null
    chartType: GrapherChartType | null
    configMd5: Base64String
}

export type DbEnrichedChartConfig = Omit<DbRawChartConfig, "config"> & {
    config: GrapherInterface
}

export function parseChartConfig(config: JsonString): GrapherInterface {
    return JSON.parse(config)
}

export function serializeChartConfig(config: GrapherInterface): JsonString {
    return JSON.stringify(config)
}
