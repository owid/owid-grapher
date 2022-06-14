// todo: remove file

import { observable } from "mobx"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
} from "./persistable/Persistable.js"
import { OwidSource } from "./OwidSource.js"
import {
    OwidVariableDataTableConfigInteface,
    OwidVariableDisplayConfigInterface,
} from "./OwidVariableDisplayConfigInterface.js"
import { PartialBy } from "./Util.js"

class OwidVariableDisplayConfigDefaults {
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
    @observable tableDisplay?: OwidVariableDataTableConfigInteface
    @observable color?: string = undefined
}

export class OwidVariableDisplayConfig
    extends OwidVariableDisplayConfigDefaults
    implements Persistable
{
    updateFromObject(obj?: Partial<OwidVariableDisplayConfigInterface>): void {
        if (obj) updatePersistables(this, obj)
    }

    toObject(): OwidVariableDisplayConfigDefaults {
        return deleteRuntimeAndUnchangedProps(
            objectWithPersistablesToObject(this),
            new OwidVariableDisplayConfigDefaults()
        )
    }

    constructor(obj?: Partial<OwidVariableDisplayConfigInterface>) {
        super()
        if (obj) this.updateFromObject(obj)
    }
}

export type OwidVariableTypeOptions = "string" | "float" | "int" | "mixed"

export interface OwidVariableWithSource {
    id: number
    name?: string
    description?: string
    unit?: string
    display?: OwidVariableDisplayConfigInterface
    shortUnit?: string
    datasetName?: string
    datasetId?: number
    coverage?: string
    nonRedistributable?: boolean
    source?: OwidSource
}

export interface OwidVariableMixedData {
    years: number[]
    entities: number[]
    values: (string | number)[]
}

export type OwidVariableWithDataAndSource = OwidVariableWithSource &
    OwidVariableMixedData

export type OwidVariableWithSourceAndType = OwidVariableWithSource & {
    type: OwidVariableTypeOptions
}

export interface OwidVariableDimension {
    values: OwidVariableDimensionValue[]
}

export interface OwidVariableDimensions {
    years: OwidVariableDimension
    entities: OwidVariableDimension
}

export interface OwidVariableDataMetadataDimensionsMap {
    data: OwidVariableMixedData
    metadata: OwidVariableWithSourceAndType
    dimensions: OwidVariableDimensions
}

export interface OwidVariableDimensionValue {
    id: number
    name?: string
    code?: string
}

export interface OwidEntityKey {
    [id: string]: PartialBy<OwidVariableDimensionValue, "id">
}

export interface OwidVariablesAndEntityKey {
    variables: {
        [id: string]: OwidVariableWithDataAndSource
    }
    entityKey: OwidEntityKey
}
