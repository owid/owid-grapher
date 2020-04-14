import { OwidVariable } from "./OwidVariable"

export interface OwidVariableSet {
    variables: {
        [id: string]: OwidVariable
    }
    entityKey: { [id: string]: EntityMeta }
}

export interface EntityMeta {
    id: number
    name: string
    code: string
}
