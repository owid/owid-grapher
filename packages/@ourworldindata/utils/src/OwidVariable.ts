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
    @observable accessor name?: string = undefined
    @observable accessor unit?: string = undefined
    @observable accessor shortUnit?: string = undefined
    @observable accessor isProjection?: boolean = undefined
    @observable accessor conversionFactor?: number = undefined
    @observable accessor roundingMode?: OwidVariableRoundingMode = undefined
    @observable accessor numDecimalPlaces?: number = undefined
    @observable accessor numSignificantFigures?: number = undefined
    @observable accessor tolerance?: number = undefined
    @observable accessor yearIsDay?: boolean = undefined
    @observable accessor zeroDay?: string = undefined
    @observable accessor entityAnnotationsMap?: string = undefined
    @observable accessor includeInTable? = true
    @observable accessor tableDisplay?: OwidVariableDataTableConfigInterface
    @observable accessor color?: string = undefined
    @observable accessor plotMarkersOnlyInLineChart?: boolean = undefined

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
