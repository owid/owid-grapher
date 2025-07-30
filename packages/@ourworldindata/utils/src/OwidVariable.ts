// todo: remove file

import { observable, makeObservable } from "mobx"
import { enumerable } from "@ourworldindata/types"
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
    @observable @enumerable accessor name: string | undefined = undefined
    @observable @enumerable accessor unit: string | undefined = undefined
    @observable @enumerable accessor shortUnit: string | undefined = undefined
    @observable @enumerable accessor isProjection: boolean | undefined =
        undefined
    @observable @enumerable accessor conversionFactor: number | undefined =
        undefined
    @observable @enumerable accessor roundingMode:
        | OwidVariableRoundingMode
        | undefined = undefined
    @observable @enumerable accessor numDecimalPlaces: number | undefined =
        undefined
    @observable @enumerable accessor numSignificantFigures: number | undefined =
        undefined
    @observable @enumerable accessor tolerance: number | undefined = undefined
    @observable @enumerable accessor yearIsDay: boolean | undefined = undefined
    @observable @enumerable accessor zeroDay: string | undefined = undefined
    @observable @enumerable accessor entityAnnotationsMap: string | undefined =
        undefined
    @observable @enumerable accessor includeInTable: boolean | undefined = true
    @observable @enumerable accessor tableDisplay:
        | OwidVariableDataTableConfigInterface
        | undefined = undefined
    @observable @enumerable accessor color: string | undefined = undefined
    @observable @enumerable accessor plotMarkersOnlyInLineChart:
        | boolean
        | undefined = undefined

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
