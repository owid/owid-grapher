// todo: remove file

import { observable, makeObservable } from "mobx";
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

class OwidVariableDisplayConfigDefaults {
    name?: string = undefined;
    unit?: string = undefined;
    shortUnit?: string = undefined;
    isProjection?: boolean = undefined;
    conversionFactor?: number = undefined;
    numDecimalPlaces?: number = undefined;
    tolerance?: number = undefined;
    yearIsDay?: boolean = undefined;
    zeroDay?: string = undefined;
    entityAnnotationsMap?: string = undefined;
    includeInTable? = true;
    tableDisplay?: OwidVariableDataTableConfigInteface;
    color?: string = undefined;

    constructor() {
        makeObservable(this, {
            name: observable,
            unit: observable,
            shortUnit: observable,
            isProjection: observable,
            conversionFactor: observable,
            numDecimalPlaces: observable,
            tolerance: observable,
            yearIsDay: observable,
            zeroDay: observable,
            entityAnnotationsMap: observable,
            includeInTable: observable,
            tableDisplay: observable,
            color: observable
        });
    }
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

export type OwidVariableWithSourceAndDimensionWithoutId = Omit<
    OwidVariableWithSourceAndDimension,
    "id"
>

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

// export interface OwidVariablesAndEntityKey {
//     variables: {
//         [id: string]: OwidVariableWithDataAndSource
//     }
//     entityKey: OwidEntityKey
// }
