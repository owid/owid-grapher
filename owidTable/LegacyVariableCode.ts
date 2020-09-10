// todo: remove file

import { observable } from "mobx"
import { OwidSource } from "./OwidTableConstants"

export class LegacyVariableTableDisplaySettings {
    @observable hideAbsoluteChange: boolean = false
    @observable hideRelativeChange: boolean = false
}

export class LegacyVariableDisplaySettings {
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
    @observable tableDisplay?: LegacyVariableTableDisplaySettings
}

export interface LegacyVariableConfig {
    id: number
    name?: string
    description?: string
    unit?: string
    display?: LegacyVariableDisplaySettings
    shortUnit?: string
    datasetName?: string
    datasetId?: string
    coverage?: string
    source?: OwidSource
    years?: number[]
    entities?: number[]
    values?: (string | number)[]
}

export interface LegacyEntityMeta {
    id: number
    name: string
    code: string
}

declare interface LegacyEntityKey {
    [id: string]: LegacyEntityMeta
}

export interface LegacyVariablesAndEntityKey {
    variables: {
        [id: string]: LegacyVariableConfig
    }
    entityKey: LegacyEntityKey
}
