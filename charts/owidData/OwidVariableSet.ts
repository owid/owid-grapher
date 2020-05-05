import { OwidVariable } from "./OwidVariable"

export declare interface OwidEntityKey {
    [id: string]: EntityMeta
}

export interface OwidVariableSet {
    variables: {
        [id: string]: OwidVariable
    }
    entityKey: OwidEntityKey
}

export interface EntityMeta {
    id: number
    name: string
    code: string
}
