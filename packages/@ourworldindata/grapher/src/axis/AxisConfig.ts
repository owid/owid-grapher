import * as _ from "lodash-es"
import { BASE_FONT_SIZE } from "../core/GrapherConstants"
import {
    trimObject,
    deleteRuntimeAndUnchangedProps,
    Persistable,
    AxisAlign,
    Position,
    TickFormattingOptions,
    Bounds,
} from "@ourworldindata/utils"
import { observable, computed, makeObservable } from "mobx"
import { HorizontalAxis, VerticalAxis } from "./Axis"
import {
    AxisMinMaxValueStr,
    AxisConfigInterface,
    FacetAxisDomain,
    ScaleType,
    Tickmark,
} from "@ourworldindata/types"

export interface AxisManager {
    fontSize: number
    axisBounds?: Bounds
    detailsOrderedByReference?: string[]
}

class AxisConfigDefaults implements AxisConfigInterface {
    orient: Position | undefined = undefined
    min: number | undefined = undefined
    max: number | undefined = undefined
    canChangeScaleType: boolean | undefined = undefined
    removePointsOutsideDomain: boolean | undefined = undefined
    minSize: number | undefined = undefined
    hideAxis: boolean | undefined = undefined
    hideGridlines: boolean | undefined = undefined
    hideTickLabels: boolean | undefined = undefined
    labelPadding: number | undefined = undefined
    tickPadding: number | undefined = undefined
    nice: boolean | undefined = undefined
    maxTicks: number | undefined = undefined
    tickFormattingOptions: TickFormattingOptions | undefined = undefined
    scaleType: ScaleType | undefined = ScaleType.linear
    facetDomain: FacetAxisDomain | undefined = undefined
    ticks: Tickmark[] | undefined = undefined
    singleValueAxisPointAlign: AxisAlign | undefined = undefined
    label: string | undefined = undefined
    domainValues: number[] | undefined = undefined

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
            hideTickLabels: observable.ref,
            labelPadding: observable.ref,
            tickPadding: observable.ref,
            nice: observable.ref,
            maxTicks: observable.ref,
            tickFormattingOptions: observable.ref,
            scaleType: observable.ref,
            facetDomain: observable.ref,
            ticks: observable.ref,
            singleValueAxisPointAlign: observable.ref,
            label: observable.ref,
            domainValues: observable.ref,
        })
    }
}

function parseMinFromJSON(
    value: AxisMinMaxValueStr.auto | number | undefined
): number | undefined {
    if (value === AxisMinMaxValueStr.auto) return Infinity
    return value
}

function parseMaxFromJSON(
    value: AxisMinMaxValueStr.auto | number | undefined
): number | undefined {
    if (value === AxisMinMaxValueStr.auto) return -Infinity
    return value
}

export class AxisConfig
    extends AxisConfigDefaults
    implements AxisConfigInterface, Persistable
{
    constructor(props?: AxisConfigInterface, axisManager?: AxisManager) {
        super()
        makeObservable(this)
        this.updateFromObject(props)
        this.axisManager = axisManager
    }

    axisManager?: AxisManager

    // todo: test/refactor
    updateFromObject(props?: AxisConfigInterface): void {
        if (props) _.extend(this, props)
        if (props?.min) this.min = parseMinFromJSON(props?.min)
        if (props?.max) this.max = parseMaxFromJSON(props?.max)
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
            hideTickLabels: this.hideTickLabels,
            labelPadding: this.labelPadding,
            nice: this.nice,
            maxTicks: this.maxTicks,
            tickFormattingOptions: this.tickFormattingOptions,
            scaleType: this.scaleType,
            label: this.label ? this.label : undefined,
            facetDomain: this.facetDomain,
            ticks: this.ticks,
            singleValueAxisPointAlign: this.singleValueAxisPointAlign,
            domainValues: this.domainValues,
        }) as AxisConfigInterface

        deleteRuntimeAndUnchangedProps(obj, new AxisConfigDefaults())

        if (obj.min === Infinity) obj.min = AxisMinMaxValueStr.auto
        if (obj.max === -Infinity) obj.max = AxisMinMaxValueStr.auto

        return obj
    }

    @computed get fontSize(): number {
        return this.axisManager?.fontSize || BASE_FONT_SIZE
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
        return new HorizontalAxis(this, this.axisManager)
    }

    toVerticalAxis(): VerticalAxis {
        return new VerticalAxis(this, this.axisManager)
    }
}
