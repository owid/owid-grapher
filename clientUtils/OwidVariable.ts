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

export type OwidVariableWithSourceAndDimension = OwidVariableWithSource & {
    dimensions: OwidVariableDimensions
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
    values: OwidVariableDimensionValuePartial[]
}

export interface OwidVariableDimensions {
    years: OwidVariableDimension
    entities: OwidVariableDimension
}

export type OwidVariableDataMetadataDimensions = {
    data: OwidVariableMixedData
    metadata: OwidVariableWithSourceAndDimension
}
export type MultipleOwidVariableDataDimensionsMap = Map<
    number,
    OwidVariableDataMetadataDimensions
>

export interface OwidVariableDimensionValuePartial {
    id: number
    name?: string
    code?: string
}
export type OwidVariableDimensionValueFull =
    Required<OwidVariableDimensionValuePartial>

export interface OwidEntityKey {
    [id: string]: OwidVariableDimensionValuePartial
}

export interface OwidVariablesAndEntityKey {
    variables: {
        [id: string]: OwidVariableWithDataAndSource
    }
    entityKey: OwidEntityKey
}
