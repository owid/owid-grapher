// todo: remove file

import { extend } from "../Util"
import { observable } from "mobx"
import { OwidSource } from "./OwidSource"

export class OwidVariableTableDisplaySettings {
    @observable showRelativeChange: boolean = true
    @observable showAbsoluteChange: boolean = true
}
export class OwidVariableDisplaySettings {
    @observable name?: string = undefined
    @observable unit?: string = undefined
    @observable shortUnit?: string = undefined
    @observable isProjection?: boolean = undefined
    @observable conversionFactor?: number = undefined
    @observable numDecimalPlaces?: number = undefined
    @observable tolerance?: number = undefined
    @observable yearIsDay?: boolean = undefined
    @observable zeroDay?: string = undefined
    @observable entityAnnotationsMap?: string = undefined
    @observable includeInTable?: boolean = true
    @observable tableDisplay?: OwidVariableTableDisplaySettings
}

export class OwidVariable {
    id!: number
    name!: string
    description!: string
    unit!: string
    shortUnit!: string
    datasetName!: string
    datasetId!: string
    coverage?: string
    display: OwidVariableDisplaySettings = new OwidVariableDisplaySettings()
    source!: OwidSource
    years: number[] = []
    entities: number[] = []
    values: (string | number)[] = []

    constructor(json: any) {
        for (const key in json) {
            if (key === "display") {
                extend(this.display, json.display)
            } else {
                ;(this as any)[key] = json[key]
            }
        }
    }
}

export interface EntityMeta {
    id: number
    name: string
    code: string
}

declare interface OwidEntityKey {
    [id: string]: EntityMeta
}

export interface OwidVariablesAndEntityKey {
    variables: {
        [id: string]: OwidVariable
    }
    entityKey: OwidEntityKey
}
