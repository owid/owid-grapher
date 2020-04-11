// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data

import { observable } from "mobx"
import { extend } from "./Util"
import { VariableDisplaySettings } from "./Variable"
import { Time } from "./TimeBounds"

export class ChartDimension {
    @observable property!: string
    @observable variableId!: number
    @observable display: VariableDisplaySettings = {
        name: undefined,
        unit: undefined,
        shortUnit: undefined,
        isProjection: undefined,
        conversionFactor: undefined,
        numDecimalPlaces: undefined,
        tolerance: undefined
    }

    // XXX move this somewhere else, it's only used for scatter x override
    @observable targetYear?: Time = undefined

    // If enabled, dimension settings will be saved onto variable as defaults
    // for future charts
    @observable saveToVariable?: true = undefined

    constructor(json: any) {
        for (const key in this) {
            if (key === "display") {
                extend(this.display, json.display)
                continue
            }

            if (key in json) {
                ;(this as any)[key] = (json as any)[key]
            }

            // XXX migrate this away (remember targetYear)
            if ((json as any)[key] === "" || (json as any)[key] === null)
                (this as any)[key] = undefined
        }
    }
}
