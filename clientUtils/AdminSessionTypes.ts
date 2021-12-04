export interface VariableAnnotationPatch {
    variableId: number
    oldValue: any
    newValue: any
    jsonPointer: string
}
export interface VariableAnnotationsResponseRow {
    id: number
    name: string
    grapherConfig: string
    datasetname: string
    namespacename: string
}

export interface VariableAnnotationsResponse {
    numTotalRows: number
    variables: VariableAnnotationsResponseRow[]
}
