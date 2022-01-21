export interface VariableAnnotationPatch {
    variableId: number
    oldValue: any
    newValue: any
    jsonPointer: string
}
export interface VariableAnnotationsResponseRow {
    id: number
    name: string
    grapherConfig: Record<string, any> // TODO: when we have GrapherInterface or better GrapherConfig as a type available in clientUtils, use it here
    datasetname: string
    namespacename: string
}

export interface VariableAnnotationsResponse {
    numTotalRows: number
    variables: VariableAnnotationsResponseRow[]
}
