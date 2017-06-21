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
}

// Interface used to access configuration by charts
export default class AxisConfig {
    @observable props: AxisConfigProps

    @computed get label(): string { return defaultTo(this.props.label, "") }
    @computed get prefix(): string { return defaultTo(this.props.prefix, "") }
    @computed get suffix(): string { return defaultTo(this.props.suffix, "") }

    // A log scale domain cannot have values <= 0, so we
    // double check here
    @computed get min(): number|null {
        if (this.scaleType == 'log' && (this.props.min||0) <= 0) {
            return null
        } else {
            return defaultTo(this.props.min, null)
        }
    }

    @computed get max(): number|null {
        if (this.scaleType == 'log' && (this.props.max||0) <= 0)
            return null
        else
            return defaultTo(this.props.max, null)
    }

    @computed get numDecimalPlaces(): number { return defaultTo(this.props.numDecimalPlaces, 0) }
    @computed get scaleType(): ScaleType { return this.props.scaleType }
    @computed get canChangeScaleType(): boolean { return defaultTo(this.props.canChangeScaleType, false) }

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
        return (d) => prefix + unitFormat({ format: numDecimalPlaces }, d) + suffix;
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toSpec({ domain } : { domain: [number, number] }) {
        return {
            label: this.label,
            tickFormat: this.tickFormat,
            domain: domain,
            scaleType: this.scaleType,
            scaleTypeOptions: this.scaleTypeOptions
        }
    }
}