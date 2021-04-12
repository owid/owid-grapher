// todo: remove file

import { observable } from "mobx"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
} from "../persistable/Persistable"
import { ColumnSlug, Time } from "../../coreTable/CoreTableConstants"
import { DimensionProperty } from "../core/GrapherConstants"
import { OwidSource } from "../../coreTable/OwidSource"
import {
    LegacyVariableDataTableConfigInteface,
    LegacyVariableDisplayConfigInterface,
} from "../../clientUtils/LegacyVariableDisplayConfigInterface"
import { LegacyVariableId } from "../../clientUtils/owidTypes"

export interface LegacyChartDimensionInterface {
    readonly property: DimensionProperty
    readonly targetYear?: Time
    readonly display?: LegacyVariableDisplayConfigInterface
    readonly variableId: LegacyVariableId
    readonly slug?: ColumnSlug
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
    @observable includeInTable? = true
    @observable tableDisplay?: LegacyVariableDataTableConfigInteface
    @observable color?: string = undefined
}

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
    readonly id: number
    readonly name?: string
    readonly description?: string
    readonly unit?: string
    readonly display?: LegacyVariableDisplayConfigInterface
    readonly shortUnit?: string
    readonly datasetName?: string
    readonly datasetId?: string
    readonly coverage?: string
    readonly source?: OwidSource
    readonly years?: readonly number[]
    readonly entities?: readonly number[]
    readonly values?: readonly (string | number)[]
}

export interface LegacyEntityMeta {
    readonly id: number
    readonly name: string
    readonly code: string
}

declare interface LegacyEntityKey {
    [id: string]: LegacyEntityMeta
}

export interface LegacyVariablesAndEntityKey {
    readonly variables: {
        [id: string]: LegacyVariableConfig
    }
    readonly entityKey: LegacyEntityKey
}
