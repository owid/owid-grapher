// A chart "dimension" represents a binding between a chart
// and a particular variable that it requests as data

import {observable} from 'mobx'

export default class ChartDimension {
    @observable property: string
    @observable variableId: number
    @observable displayName?: string = undefined
    @observable unit?: string = undefined
    @observable shortUnit?: string = undefined
    @observable isProjection?: true = undefined
    @observable conversionFactor?: number = undefined
    @observable tolerance?: number = undefined

    // XXX move this somewhere else, it's only used for scatter x override
    @observable targetYear?: number = undefined
    
    // If enabled, dimension settings will be saved onto variable as defaults
    // for future charts
    @observable saveToVariable?: true = undefined

    constructor(json: { property: string, variableId: number }) {
        for (let key in this) {
            if (key in json) {
                (this as any)[key] = (json as any)[key]

                // XXX migrate this away
                if ((json as any)[key] === "")
                    (this as any)[key] = undefined
            }
        }        
    }
}