import {observable, computed, toJS} from 'mobx'
import {unitFormat} from './Util'

export type ScaleType = 'linear' | 'log';

// Represents the actual entered configuration state in the editor
export class AxisConfigProps {
    label: string = ""
    prefix: string = ""
    suffix: string = ""
    min: number|null = null
    max: number|null = null
    scaleType: ScaleType = "linear"
    numDecimalPlaces: number|null = null
    canChangeScaleType: boolean = false
}

// Interface used to access configuration by charts
export default class AxisConfig {    
    @observable props: AxisConfigProps

    @computed get label() { return this.props.label }
    @computed get prefix() { return this.props.prefix }
    @computed get suffix() { return this.props.suffix }    

    // A log scale domain cannot have values <= 0, so we
    // double check here
    @computed get min(): number|null {
        if (this.scaleType == 'log' && this.props.min||0 <= 0)
            return null
        else
            return this.props.min
    }

    @computed get max(): number|null {
        if (this.scaleType == 'log' && this.props.max||0 <= 0)
            return null
        else
            return this.props.max
    }

    @computed get numDecimalPlaces() { return this.props.numDecimalPlaces }
    @computed get scaleType() { return this.props.scaleType }
    @computed get canChangeScaleType() { return this.props.canChangeScaleType }

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