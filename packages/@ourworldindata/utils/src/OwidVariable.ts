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
    name: string | undefined = undefined
    unit: string | undefined = undefined
    shortUnit: string | undefined = undefined
    isProjection: boolean | undefined = undefined
    conversionFactor: number | undefined = undefined
    roundingMode: OwidVariableRoundingMode | undefined = undefined
    numDecimalPlaces: number | undefined = undefined
    numSignificantFigures: number | undefined = undefined
    tolerance: number | undefined = undefined
    yearIsDay: boolean | undefined = undefined
    zeroDay: string | undefined = undefined
    entityAnnotationsMap: string | undefined = undefined
    includeInTable: boolean | undefined = true
    tableDisplay: OwidVariableDataTableConfigInterface | undefined = undefined
    color: string | undefined = undefined
    plotMarkersOnlyInLineChart: boolean | undefined = undefined

    constructor() {
        makeObservable(this, {
            name: observable,
            unit: observable,
            shortUnit: observable,
            isProjection: observable,
            conversionFactor: observable,
            roundingMode: observable,
            numDecimalPlaces: observable,
            numSignificantFigures: observable,
            tolerance: observable,
            yearIsDay: observable,
            zeroDay: observable,
            entityAnnotationsMap: observable,
            includeInTable: observable,
            tableDisplay: observable,
            color: observable,
            plotMarkersOnlyInLineChart: observable,
        })
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
