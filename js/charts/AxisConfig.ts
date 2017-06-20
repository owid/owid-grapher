import {observable, computed, toJS} from 'mobx'
import * as owid from '../owid'

export type ScaleType = 'linear' | 'log';

export default class AxisConfig {
    @observable.ref label: string = ""
    @observable.struct domain: [number|null, number|null] = [null, null]
    @observable.ref prefix: string = ""
    @observable.ref suffix: string = ""
    @observable.ref scaleType: ScaleType = "linear"
    @observable.struct scaleTypeOptions: ScaleType[] = ["linear"]
    @observable.ref numDecimalPlaces: number|null = null

    @computed get tickFormat(): (d: number) => string {
        const { prefix, numDecimalPlaces, suffix } = this
        return (d) => prefix + owid.unitFormat({ format: numDecimalPlaces||5 }, d) + suffix;
    }

}