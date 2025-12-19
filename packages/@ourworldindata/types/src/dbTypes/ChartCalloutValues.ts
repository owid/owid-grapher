import { GrapherValuesJson } from "../endpointTypes/GrapherValuesJson.js"

export const ChartCalloutValuesTableName = "chart_callout_values"

export interface DbInsertChartCalloutValue {
    id: string
    value: GrapherValuesJson
    createdAt?: Date
    updatedAt?: Date
}

export type DbPlainChartCalloutValue = Required<DbInsertChartCalloutValue>
