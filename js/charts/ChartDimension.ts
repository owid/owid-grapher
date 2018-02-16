// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data

import {observable} from 'mobx'

interface VariableDisplaySettings {
    name?: string
    unit?: string
    shortUnit?: string
    isProjection?: true
    conversionFactor?: number
    numDecimalPlaces?: number
    tolerance?: number
}

export default class ChartDimension {
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
    @observable targetYear?: number = undefined

    // If enabled, dimension settings will be saved onto variable as defaults
    // for future charts
    @observable saveToVariable?: true = undefined

    constructor(json: { property: string, variableId: number }) {
        for (const key in this) {
            if (key in json) {
                (this as any)[key] = (json as any)[key]
            }

            // XXX migrate this away (remember targetYear)
            if ((json as any)[key] === "" || (json as any)[key] === null)
                (this as any)[key] = undefined
            }
    }
}
