import { ScaleType } from "grapher/core/GrapherConstants"
import { extend, trimObject } from "grapher/utils/Util"
import { observable, computed } from "mobx"
import { HorizontalAxis, VerticalAxis } from "./Axis"
import { Persistable } from "grapher/persistable/Persistable"
import { AxisConfigInterface } from "./AxisConfigInterface"

// Todo: remove
interface AxisContainerInterface {
    fontSize: number
}

class AxisConfigDefaults {
    @observable.ref min?: number = undefined
    @observable.ref max?: number = undefined
    @observable.ref scaleType?: ScaleType = undefined
    @observable.ref canChangeScaleType?: true = undefined
    @observable label: string = ""
    @observable.ref removePointsOutsideDomain?: true = undefined
}

export class AxisConfig
    extends AxisConfigDefaults
    implements AxisConfigInterface, Persistable {
    // todo: test/refactor
    constructor(props?: AxisConfigInterface) {
        super()
        this.updateFromObject(props)
    }

    // todo: test/refactor
    updateFromObject(props?: AxisConfigInterface) {
        if (props) extend(this, props)
    }

    toObject(): AxisConfigInterface {
        return trimObject({
            scaleType: this.scaleType,
            label: this.label ? this.label : undefined,
            min: this.min,
            max: this.max,
            canChangeScaleType: this.canChangeScaleType,
            removePointsOutsideDomain: this.removePointsOutsideDomain,
        })
    }

    set container(containerOptions: AxisContainerInterface) {
        this.containerOptions = containerOptions
    }

    @observable.ref private containerOptions: AxisContainerInterface = {
        fontSize: 16,
    }

    @computed get fontSize() {
        return this.containerOptions.fontSize
    }

    // A log scale domain cannot have values <= 0, so we
    // double check here
    @computed private get constrainedMin() {
        if (this.scaleType === ScaleType.log && (this.min || 0) <= 0)
            return Infinity
        return this.min ?? Infinity
    }

    // If the author has specified a min/max AND to remove points outside the domain, this should return true
    shouldRemovePoint(value: number) {
        if (!this.removePointsOutsideDomain) return false
        if (this.min !== undefined && value < this.min) return true
        if (this.max !== undefined && value > this.max) return true
        return false
    }

    @computed private get constrainedMax() {
        if (this.scaleType === ScaleType.log && (this.max || 0) <= 0)
            return -Infinity
        return this.max ?? -Infinity
    }

    @computed get domain(): [number, number] {
        return [this.constrainedMin, this.constrainedMax]
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toHorizontalAxis() {
        return new HorizontalAxis(this)
    }

    toVerticalAxis() {
        return new VerticalAxis(this)
    }
}
