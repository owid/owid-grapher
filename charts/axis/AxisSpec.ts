/* AxisSpec.ts
 * ================
 *
 * This represents a finalized version of the axis configuration
 * that is ready to go into rendering-- no unfilled nulls.
 */

import { ScaleType, TickFormattingOptions } from "charts/core/ChartConstants"
import { observable, computed } from "mobx"
import { defaultTo } from "charts/utils/Util"

export interface AxisSpec {
    label: string
    tickFormat: (d: number, options?: TickFormattingOptions) => string
    domain: [number, number]
    scaleType: ScaleType
    scaleTypeOptions: ScaleType[]
    hideFractionalTicks?: boolean
    hideGridlines?: boolean
}

// Represents the actual entered configuration state in the editor
export class AxisConfigProps {
    @observable.ref min?: number = undefined
    @observable.ref max?: number = undefined
    @observable.ref scaleType: ScaleType = ScaleType.linear
    @observable.ref canChangeScaleType?: true = undefined
    @observable label?: string = undefined
    @observable.ref removePointsOutsideDomain?: true = undefined
}

// Interface used to access configuration by charts
export class AxisConfig {
    props: AxisConfigProps

    constructor(props: AxisConfigProps) {
        this.props = props
    }

    // A log scale domain cannot have values <= 0, so we
    // double check here
    @computed get min(): number | undefined {
        if (this.scaleType === ScaleType.log && (this.props.min || 0) <= 0) {
            return undefined
        } else {
            return this.props.min
        }
    }

    @computed get max(): number | undefined {
        if (this.scaleType === ScaleType.log && (this.props.max || 0) <= 0)
            return undefined
        else return this.props.max
    }

    @computed get scaleType(): ScaleType {
        return this.props.scaleType
    }
    set scaleType(scaleType: ScaleType) {
        this.props.scaleType = scaleType
    }
    @computed get canChangeScaleType(): boolean {
        return defaultTo(this.props.canChangeScaleType, false)
    }

    @computed get removePointsOutsideDomain(): boolean {
        return defaultTo(this.props.removePointsOutsideDomain, false)
    }

    @computed get domain(): [number | undefined, number | undefined] {
        return [this.min, this.max]
    }

    @computed get scaleTypeOptions(): ScaleType[] {
        if (this.canChangeScaleType) {
            return [ScaleType.linear, ScaleType.log]
        } else {
            return [this.scaleType]
        }
    }

    @computed get label() {
        return this.props.label
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toSpec({ defaultDomain }: { defaultDomain: [number, number] }): AxisSpec {
        return {
            label: this.label || "",
            tickFormat: d => `${d}`,
            domain: [
                Math.min(defaultTo(this.domain[0], Infinity), defaultDomain[0]),
                Math.max(defaultTo(this.domain[1], -Infinity), defaultDomain[1])
            ],
            scaleType: this.scaleType,
            scaleTypeOptions: this.scaleTypeOptions
        }
    }
}
