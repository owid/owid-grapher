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
    @observable name: string | undefined = undefined
    @observable unit: string | undefined = undefined
    @observable shortUnit: string | undefined = undefined
    @observable isProjection: boolean | undefined = undefined
    @observable conversionFactor: number | undefined = undefined
    @observable roundingMode: OwidVariableRoundingMode | undefined = undefined
    @observable numDecimalPlaces: number | undefined = undefined
    @observable numSignificantFigures: number | undefined = undefined
    @observable tolerance: number | undefined = undefined
    @observable yearIsDay: boolean | undefined = undefined
    @observable zeroDay: string | undefined = undefined
    @observable entityAnnotationsMap: string | undefined = undefined
    @observable includeInTable: boolean | undefined = true
    @observable tableDisplay: OwidVariableDataTableConfigInterface | undefined =
        undefined
    @observable color: string | undefined = undefined
    @observable plotMarkersOnlyInLineChart: boolean | undefined = undefined

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
