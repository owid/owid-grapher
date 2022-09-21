import {
    BASE_FONT_SIZE,
    FacetAxisDomain,
    ScaleType,
} from "../core/GrapherConstants.js"
import { extend, trimObject } from "../../clientUtils/Util.js"
import { observable, computed, makeObservable } from "mobx"
import { HorizontalAxis, VerticalAxis } from "./Axis.js"
import {
    deleteRuntimeAndUnchangedProps,
    Persistable,
} from "../../clientUtils/persistable/Persistable.js"
import { AxisConfigInterface, Tickmark } from "./AxisConfigInterface.js"
import { ScaleSelectorManager } from "../controls/ScaleSelector.js"
import { AxisAlign, Position } from "../../clientUtils/owidTypes.js"
import { TickFormattingOptions } from "../../clientUtils/formatValue.js"

export interface FontSizeManager {
    fontSize: number
}

class AxisConfigDefaults implements AxisConfigInterface {
    orient?: Position = undefined
    min?: number = undefined
    max?: number = undefined
    canChangeScaleType?: boolean = undefined
    removePointsOutsideDomain?: boolean = undefined
    minSize?: number = undefined
    hideAxis?: boolean = undefined
    hideGridlines?: boolean = undefined
    labelPadding?: number = undefined
    nice?: boolean = undefined
    maxTicks?: number = undefined
    tickFormattingOptions?: TickFormattingOptions = undefined
    scaleType?: ScaleType = ScaleType.linear
    facetDomain?: FacetAxisDomain = undefined
    ticks?: Tickmark[] = undefined
    singleValueAxisPointAlign?: AxisAlign = undefined
    label: string = ""

    constructor() {
        makeObservable(this, {
            orient: observable.ref,
            min: observable.ref,
            max: observable.ref,
            canChangeScaleType: observable.ref,
            removePointsOutsideDomain: observable.ref,
            minSize: observable.ref,
            hideAxis: observable.ref,
            hideGridlines: observable.ref,
            labelPadding: observable.ref,
            nice: observable.ref,
            maxTicks: observable.ref,
            tickFormattingOptions: observable.ref,
            scaleType: observable.ref,
            facetDomain: observable.ref,
            ticks: observable.ref,
            singleValueAxisPointAlign: observable.ref,
            label: observable.ref,
        })
    }
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

        makeObservable<AxisConfig, "constrainedMin" | "constrainedMax">(this, {
            fontSize: computed,
            constrainedMin: computed,
            constrainedMax: computed,
            domain: computed,
        })

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
            tickFormattingOptions: this.tickFormattingOptions,
            scaleType: this.scaleType,
            label: this.label ? this.label : undefined,
            facetDomain: this.facetDomain,
            ticks: this.ticks,
            singleValueAxisPointAlign: this.singleValueAxisPointAlign,
        })

        deleteRuntimeAndUnchangedProps(obj, new AxisConfigDefaults())

        return obj
    }

    get fontSize(): number {
        return this.fontSizeManager?.fontSize || BASE_FONT_SIZE
    }

    // A log scale domain cannot have values <= 0, so we double check here
    private get constrainedMin(): number {
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

    private get constrainedMax(): number {
        if (this.scaleType === ScaleType.log && (this.max || 0) <= 0)
            return -Infinity
        return this.max ?? -Infinity
    }

    get domain(): [number, number] {
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
