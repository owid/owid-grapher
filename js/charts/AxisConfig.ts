import {observable, computed, toJS} from 'mobx'
import {unitFormat} from './Util'
import AxisSpec from './AxisSpec'
import ScaleType from './ScaleType'
import {defaultTo} from './Util'

// Represents the actual entered configuration state in the editor
export class AxisConfigProps {
    label?: string
    prefix?: string
    suffix?: string
    min?: number
    max?: number
    numDecimalPlaces?: number
    scaleType: ScaleType = "linear"
    canChangeScaleType?: true
    labelDistance?: number // DEPRECATED - remove when nvd3 is gone
}

// Interface used to access configuration by charts
export default class AxisConfig {
    @observable props: AxisConfigProps

    @computed get label(): string { return defaultTo(this.props.label, "") }
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

    @computed get numDecimalPlaces(): number { return defaultTo(this.props.numDecimalPlaces, 0) }
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
        const { prefix, numDecimalPlaces, suffix } = this
        return (d) => prefix + unitFormat({ format: numDecimalPlaces }, d) + suffix;
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toSpec({ defaultDomain } : { defaultDomain: [number, number] }): AxisSpec {
        return {
            label: this.label,
            tickFormat: this.tickFormat,
            domain: [defaultTo(this.domain[0], defaultDomain[0]), defaultTo(this.domain[1], defaultDomain[1])],
            scaleType: this.scaleType,
            scaleTypeOptions: this.scaleTypeOptions
        }
    }
}