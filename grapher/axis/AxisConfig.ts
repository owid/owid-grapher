import {
    BASE_FONT_SIZE,
    FacetAxisDomain,
    ScaleType,
} from "../core/GrapherConstants.js"
import { extend, trimObject } from "../../clientUtils/Util.js"
import { observable, computed } from "mobx"
import { HorizontalAxis, VerticalAxis } from "./Axis.js"
import {
    deleteRuntimeAndUnchangedProps,
    Persistable,
} from "../../clientUtils/persistable/Persistable.js"
import { AxisConfigInterface, Tickmark } from "./AxisConfigInterface.js"
import { ScaleSelectorManager } from "../controls/ScaleSelector.js"
import { AxisAlign, Position } from "../../clientUtils/owidTypes.js"

export interface FontSizeManager {
    fontSize: number
}

class AxisConfigDefaults implements AxisConfigInterface {
    @observable.ref orient?: Position = undefined
    @observable.ref min?: number = undefined
    @observable.ref max?: number = undefined
    @observable.ref canChangeScaleType?: boolean = undefined
    @observable.ref removePointsOutsideDomain?: boolean = undefined
    @observable.ref minSize?: number = undefined
    @observable.ref hideAxis?: boolean = undefined
    @observable.ref hideGridlines?: boolean = undefined
    @observable.ref labelPadding?: number = undefined
    @observable.ref nice?: boolean = undefined
    @observable.ref maxTicks?: number = undefined
    @observable.ref compactLabels?: boolean = undefined
    @observable.ref scaleType?: ScaleType = ScaleType.linear
    @observable.ref facetDomain?: FacetAxisDomain = undefined
    @observable.ref ticks?: Tickmark[] = undefined
    @observable.ref singleValueAxisPointAlign?: AxisAlign = undefined
    @observable.ref label: string = ""
}

export class AxisConfig
    extends AxisConfigDefaults
    implements AxisConfigInterface, Persistable, ScaleSelectorManager
{
    constructor(
        props?: AxisConfigInterface,
        fontSizeManager?: FontSizeManager
    ) {
        super()
        this.updateFromObject(props)
        this.fontSizeManager = fontSizeManager
    }

    fontSizeManager?: FontSizeManager

    // todo: test/refactor
    updateFromObject(props?: AxisConfigInterface): void {
        if (props) extend(this, props)
    }

    toObject(): AxisConfigInterface {
        const obj = trimObject({
            orient: this.orient,
            min: this.min,
            max: this.max,
            canChangeScaleType: this.canChangeScaleType,
            removePointsOutsideDomain: this.removePointsOutsideDomain,
            minSize: this.minSize,
            hideAxis: this.hideAxis,
            hideGridlines: this.hideGridlines,
            labelPadding: this.labelPadding,
            nice: this.nice,
            maxTicks: this.maxTicks,
            compactLabels: this.compactLabels,
            scaleType: this.scaleType,
            label: this.label ? this.label : undefined,
            facetDomain: this.facetDomain,
            ticks: this.ticks,
            singleValueAxisPointAlign: this.singleValueAxisPointAlign,
        })

        deleteRuntimeAndUnchangedProps(obj, new AxisConfigDefaults())

        return obj
    }

    @computed get fontSize(): number {
        return this.fontSizeManager?.fontSize || BASE_FONT_SIZE
    }

    // A log scale domain cannot have values <= 0, so we double check here
    @computed private get constrainedMin(): number {
        if (this.scaleType === ScaleType.log && (this.min ?? 0) <= 0)
            return Infinity
        return this.min ?? Infinity
    }

    // If the author has specified a min/max AND to remove points outside the domain, this should return true
    shouldRemovePoint(value: number): boolean {
        if (!this.removePointsOutsideDomain) return false
        if (this.min !== undefined && value < this.min) return true
        if (this.max !== undefined && value > this.max) return true
        return false
    }

    @computed private get constrainedMax(): number {
        if (this.scaleType === ScaleType.log && (this.max || 0) <= 0)
            return -Infinity
        return this.max ?? -Infinity
    }

    @computed get domain(): [number, number] {
        return [this.constrainedMin, this.constrainedMax]
    }

    // Convert axis configuration to a finalized axis spec by supplying
    // any needed information calculated from the data
    toHorizontalAxis(): HorizontalAxis {
        return new HorizontalAxis(this)
    }

    toVerticalAxis(): VerticalAxis {
        return new VerticalAxis(this)
    }
}
