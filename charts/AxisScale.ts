/* AxisScale.ts
 * ================
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import { scaleLog, scaleLinear, ScaleLinear, ScaleLogarithmic } from "d3-scale"
import { observable, computed, toJS } from "mobx"

import { map, extend, rollingMap, min } from "./Util"
import { TickFormattingOptions } from "./TickFormattingOptions"

export type ScaleType = "linear" | "log"

export class AxisScale {
    @observable scaleType: ScaleType
    @observable.struct scaleTypeOptions: ScaleType[]
    @observable tickFormat: (
        v: number,
        options?: TickFormattingOptions
    ) => string
    @observable.struct domain: [number, number]
    @observable.struct range: [number, number]
    @observable hideFractionalTicks: boolean
    @observable hideGridlines: boolean

    constructor({
        scaleType = "linear",
        scaleTypeOptions = ["linear"],
        tickFormat = d => d.toString(),
        domain = [0, 0],
        range = [0, 0],
        hideFractionalTicks = false,
        hideGridlines = false
    }: {
        scaleType?: ScaleType
        scaleTypeOptions?: ScaleType[]
        tickFormat?: (v: number) => string
        domain: [number, number]
        range?: [number, number]
        hideFractionalTicks?: boolean
        hideGridlines?: boolean
    }) {
        this.scaleType = scaleType
        this.scaleTypeOptions = scaleTypeOptions
        this.tickFormat = tickFormat
        this.domain = domain
        this.range = range
        this.hideFractionalTicks = hideFractionalTicks
        this.hideGridlines = hideGridlines
    }

    @computed private get d3_scaleConstructor(): any {
        return this.scaleType === "log" ? scaleLog : scaleLinear
    }

    @computed private get d3_scale():
        | ScaleLinear<number, number>
        | ScaleLogarithmic<number, number> {
        return this.d3_scaleConstructor()
            .domain(this.domain)
            .range(this.range)
    }

    @computed get rangeSize() {
        return Math.abs(this.range[1] - this.range[0])
    }

    @computed get rangeMax() {
        return Math.max(this.range[1], this.range[0])
    }

    @computed get rangeMin() {
        return Math.min(this.range[1], this.range[0])
    }

    getTickValues(): number[] {
        const { scaleType, domain, d3_scale } = this

        let ticks: number[] = []
        if (scaleType === "log") {
            let minPower10 = Math.ceil(Math.log(domain[0]) / Math.log(10))
            if (!isFinite(minPower10)) minPower10 = 0
            let maxPower10 = Math.floor(Math.log(domain[1]) / Math.log(10))
            if (maxPower10 <= minPower10) maxPower10 += 1

            for (let i = minPower10; i <= maxPower10; i++) {
                ticks.push(Math.pow(10, i))
            }
        } else {
            ticks = d3_scale.ticks(6)
        }

        if (this.hideFractionalTicks) ticks = ticks.filter(t => t % 1 === 0)

        return ticks
    }

    getTickFormattingOptions(): TickFormattingOptions {
        const tickValues = this.getTickValues()
        const minDist = min(rollingMap(tickValues, (a, b) => Math.abs(a - b)))
        if (minDist !== undefined) {
            const dp = Math.ceil(-Math.log10(minDist))
            if (isFinite(dp) && dp >= 0) return { numDecimalPlaces: dp }
        }
        return {}
    }

    getFormattedTicks(): string[] {
        const options = this.getTickFormattingOptions()
        return this.getTickValues().map(value =>
            this.tickFormat(value, options)
        )
    }

    place(value: number) {
        if (!this.range) {
            console.error(
                "Can't place value on scale without a defined output range"
            )
            return value
        } else if (this.scaleType === "log" && value <= 0) {
            console.error("Can't have values <= 0 on a log scale")
            return value
        }
        return parseFloat(this.d3_scale(value).toFixed(1))
    }

    extend(props: any) {
        return new AxisScale(extend(toJS(this), props))
    }
}
