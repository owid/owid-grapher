import {observable, computed, toJS} from 'mobx'
import {unitFormat} from './Util'

export type ScaleType = 'linear' | 'log';

export default class AxisConfig {
    @observable.ref label: string = ""
    @observable.ref min: number|null = null
    @observable.ref max: number|null = null
    @observable.ref prefix: string = ""
    @observable.ref suffix: string = ""
    @observable.ref scaleType: ScaleType = "linear"
    @observable.ref numDecimalPlaces: number|null = null
    @observable.ref canChangeScaleType: boolean = false

    @computed get domain(): [number|null, number|null] {
        return [this.min, this.max]
    }

    @computed get scaleTypeOptions(): ScaleType[] {
        if (this.canChangeScaleType) {
            return ['linear', 'log']
        } else {
            return [this.scaleType]
        }
    }

    @computed get tickFormat(): (d: number) => string {
        const { prefix, numDecimalPlaces, suffix } = this
        return (d) => prefix + unitFormat({ format: numDecimalPlaces||5 }, d) + suffix;
    }
}