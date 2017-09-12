import {observable, computed} from 'mobx'
import {unitFormat} from './Util'
import AxisSpec from './AxisSpec'
import ScaleType from './ScaleType'
import {defaultTo} from './Util'

// Represents the actual entered configuration state in the editor
export class AxisConfigProps {
    @observable.ref label?: string = undefined
    @observable.ref prefix?: string = undefined
    @observable.ref suffix?: string = undefined
    @observable.ref min?: number = undefined
    @observable.ref max?: number = undefined
    @observable.ref numDecimalPlaces?: number = undefined
    @observable.ref scaleType: ScaleType = 'linear'
    @observable.ref canChangeScaleType?: true = undefined
    @observable.ref labelDistance?: number // DEPRECATED - remove when nvd3 is gone
}

// Interface used to access configuration by charts
export default class AxisConfig {
    props: AxisConfigProps

    constructor(props: AxisConfigProps) {
        this.props = props
    }

    @computed get label(): string|undefined { return this.props.label }
    @computed get prefix(): string { return defaultTo(this.props.prefix, "") }
    @computed get suffix(): string { return defaultTo(this.props.suffix, "") }

    // A log scale domain cannot have values <= 0, so we
    // double check here
    @computed get min(): number|undefined {
        if (this.scaleType == 'log' && (this.props.min||0) <= 0) {
            return undefined
        } else {
            return defaultTo(this.props.min, undefined)
        }
    }

    @computed get max(): number|undefined {
        if (this.scaleType == 'log' && (this.props.max||0) <= 0)
            return undefined
        else
            return defaultTo(this.props.max, undefined)
    }

    @computed get maxDecimalPlaces(): number|undefined { return defaultTo(this.props.numDecimalPlaces, 2) }
    @computed get scaleType(): ScaleType { return this.props.scaleType }
    set scaleType(scaleType: ScaleType) { this.props.scaleType = scaleType }
    @computed get canChangeScaleType(): boolean { return defaultTo(this.props.canChangeScaleType, false) }

    @computed get domain(): [number|undefined, number|undefined] {
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
        const { prefix, maxDecimalPlaces, suffix } = this
        return (d) => prefix + unitFormat({ format: maxDecimalPlaces }, d) + suffix;
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toSpec({ defaultDomain } : { defaultDomain: [number, number] }): AxisSpec {
        return {
            label: this.label||"",
            tickFormat: this.tickFormat,
            domain: [Math.min(defaultTo(this.domain[0], Infinity), defaultDomain[0]), Math.max(defaultTo(this.domain[1], -Infinity), defaultDomain[1])],
            scaleType: this.scaleType,
            scaleTypeOptions: this.scaleTypeOptions
        }
    }
}