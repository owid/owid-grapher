import { GrapherValuesJson } from "../endpointTypes/GrapherValuesJson.js"

export const ChartCalloutValuesTableName = "chart_callout_values"

export interface DbInsertChartCalloutValue {
    id: string // normalized callout URL path + query, e.g. "/grapher/life-expectancy?country=ESP"
    value: GrapherValuesJson
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainChartCalloutValue = Required<DbInsertChartCalloutValue>
