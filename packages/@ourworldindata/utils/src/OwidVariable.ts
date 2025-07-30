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
    @observable accessor name: string | undefined = undefined
    @observable accessor unit: string | undefined = undefined
    @observable accessor shortUnit: string | undefined = undefined
    @observable accessor isProjection: boolean | undefined = undefined
    @observable accessor conversionFactor: number | undefined = undefined
    @observable accessor roundingMode: OwidVariableRoundingMode | undefined =
        undefined
    @observable accessor numDecimalPlaces: number | undefined = undefined
    @observable accessor numSignificantFigures: number | undefined = undefined
    @observable accessor tolerance: number | undefined = undefined
    @observable accessor yearIsDay: boolean | undefined = undefined
    @observable accessor zeroDay: string | undefined = undefined
    @observable accessor entityAnnotationsMap: string | undefined = undefined
    @observable accessor includeInTable: boolean | undefined = true
    @observable accessor tableDisplay:
        | OwidVariableDataTableConfigInterface
        | undefined = undefined
    @observable accessor color: string | undefined = undefined
    @observable accessor plotMarkersOnlyInLineChart: boolean | undefined =
        undefined

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
