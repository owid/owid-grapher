// todo: remove file

import { observable } from "mobx"
import { OwidSource } from "./OwidTableConstants"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
} from "grapher/persistable/Persistable"

class LegacyVariableTableDisplayConfig {
    @observable hideAbsoluteChange: boolean = false
    @observable hideRelativeChange: boolean = false
}

class LegacyVariableDisplayConfigDefaults {
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
    @observable tableDisplay?: LegacyVariableTableDisplayConfig
}

export type LegacyVariableDisplayConfigInterface = LegacyVariableDisplayConfigDefaults

export class LegacyVariableDisplayConfig
    extends LegacyVariableDisplayConfigDefaults
    implements Persistable {
    updateFromObject(obj?: Partial<LegacyVariableDisplayConfigInterface>) {
        if (obj) updatePersistables(this, obj)
    }

    toObject() {
        return deleteRuntimeAndUnchangedProps(
            objectWithPersistablesToObject(this),
            new LegacyVariableDisplayConfigDefaults()
        )
    }

    constructor(obj?: Partial<LegacyVariableDisplayConfigInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}

export interface LegacyVariableConfig {
    id: number
    name?: string
    description?: string
    unit?: string
    display?: LegacyVariableDisplayConfigInterface
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
