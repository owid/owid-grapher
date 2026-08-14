import { ExpressionType } from "./SqlFilterSExpression.js"

export interface GrapherConfigPatch {
    id: number // This can be either a variableId or a chartId depending on the context
    oldValue: any
    oldValueIsEquivalentToNullOrUndefined: boolean
    newValue: any
    jsonPointer: string
}

export interface BulkGrapherConfigResponseRow {
    id: number
    config: Record<string, any>
    createdAt: string
    updatedAt: string
}

export interface BulkChartEditResponseRow extends BulkGrapherConfigResponseRow {
    lastEditedAt: string
    publishedAt: string
    lastEditedByUser: string
    publishedByUser: string
}

export interface BulkGrapherConfigResponse<
    T extends BulkGrapherConfigResponseRow,
> {
    numTotalRows: number
    rows: T[]
}

export enum WHITELISTED_SQL_COLUMN_NAMES {
    SQL_COLUMN_NAME_CHART_ID = "charts.id",
    SQL_COLUMN_NAME_CHART_CREATED_AT = "charts.createdAt",
    SQL_COLUMN_NAME_CHART_UPDATED_AT = "charts.updatedAt",
    SQL_COLUMN_NAME_CHART_LAST_EDITED_AT = "charts.lastEditedAt",
    SQL_COLUMN_NAME_CHART_PUBLISHED_AT = "charts.publishedAt",
    SQL_COLUMN_NAME_CHART_LAST_EDITED_BY_USER = "editedByUser.fullName",
    SQL_COLUMN_NAME_CHART_PUBLISHED_BY_USER = "publishedByUser.fullName",
}

export const chartBulkUpdateAllowedColumnNamesAndTypes: Map<
    string,
    ExpressionType
> = new Map([
    [
        WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_ID,
        ExpressionType.numeric,
    ],
    [
        WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_CREATED_AT,
        ExpressionType.numeric,
    ],
    [
        WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_UPDATED_AT,
        ExpressionType.numeric,
    ],
    [
        WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_LAST_EDITED_AT,
        ExpressionType.numeric,
    ],
    [
        WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_PUBLISHED_AT,
        ExpressionType.numeric,
    ],
    [
        WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_LAST_EDITED_BY_USER,
        ExpressionType.string,
    ],
    [
        WHITELISTED_SQL_COLUMN_NAMES.SQL_COLUMN_NAME_CHART_PUBLISHED_BY_USER,
        ExpressionType.string,
    ],
])
