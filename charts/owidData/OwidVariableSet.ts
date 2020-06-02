import { OwidVariable } from "./OwidVariable"

export declare interface OwidEntityKey {
    [id: string]: EntityMeta
}

export interface OwidVariablesAndEntityKey {
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
