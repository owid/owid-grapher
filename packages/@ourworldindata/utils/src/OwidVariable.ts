// todo: remove file

import { observable, makeObservable } from "mobx"
import {
    Persistable,
    updatePersistables,
    objectWithPersistablesToObject,
    deleteRuntimeAndUnchangedProps,
} from "./persistable/Persistable.js"
import {
    OwidVariableDataTableConfigInterface,
    OwidVariableDisplayConfigInterface,
    OwidVariableRoundingMode,
} from "@ourworldindata/types"

class OwidVariableDisplayConfigDefaults {
    @observable name?: string = undefined
    @observable unit?: string = undefined
    @observable shortUnit?: string = undefined
    @observable isProjection?: boolean = undefined
    @observable conversionFactor?: number = undefined
    @observable roundingMode?: OwidVariableRoundingMode = undefined
    @observable numDecimalPlaces?: number = undefined
    @observable numSignificantFigures?: number = undefined
    @observable tolerance?: number = undefined
    @observable yearIsDay?: boolean = undefined
    @observable zeroDay?: string = undefined
    @observable entityAnnotationsMap?: string = undefined
    @observable includeInTable? = true
    @observable tableDisplay?: OwidVariableDataTableConfigInterface
    @observable color?: string = undefined
    @observable plotMarkersOnlyInLineChart?: boolean = undefined

    constructor() {
        makeObservable(this)
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

// export interface OwidVariablesAndEntityKey {
//     variables: {
//         [id: string]: OwidVariableWithDataAndSource
//     }
//     entityKey: OwidEntityKey
// }
