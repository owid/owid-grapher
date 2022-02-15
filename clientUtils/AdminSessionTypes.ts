export interface GrapherConfigPatch {
    id: number // This can be either a variableId or a chartId depending on the context
    oldValue: any
    newValue: any
    jsonPointer: string
}

export interface BulkGrapherConfigResponseRow {
    id: number
    config: Record<string, any>
    createdAt: string
    updatedAt: string
}

export interface VariableAnnotationsResponseRow
    extends BulkGrapherConfigResponseRow {
    name: string
    datasetname: string
    namespacename: string
    description: string
}

export interface BulkChartEditResponseRow extends BulkGrapherConfigResponseRow {
    lastEditedAt: string
    publishedAt: string
    lastEditedByUser: string
    publishedByUser: string
}

export interface BulkGrapherConfigResponse<
    T extends BulkGrapherConfigResponseRow
> {
    numTotalRows: number
    rows: T[]
}
