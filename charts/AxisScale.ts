/* AxisScale.ts
 * ================
 *
 * @project Our World In Data
 * @author  Jaiden Mispy
 * @created 2017-02-11
 */

import { scaleLog, scaleLinear, ScaleLinear, ScaleLogarithmic } from "d3-scale"
import { observable, computed, toJS } from "mobx"

import { extend, rollingMap, min, isMobile, uniq } from "./Util"
import { TickFormattingOptions } from "./TickFormattingOptions"

export type ScaleType = "linear" | "log"

export interface Tickmark {
    value: number
    priority: number
    gridLineOnly?: boolean
    isFirstOrLastTick?: boolean
}

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

    // When this is a log axis, only show so many grid lines because otherwise
    // the chart would get too overwhelming. Different for mobile because screens
    // are usually smaller.
    @computed get maxLogLines() {
        return isMobile() ? 9 : 11
    }

    getTickValues(): Tickmark[] {
        const { scaleType, d3_scale, maxLogLines } = this

        let ticks: Tickmark[]
        if (scaleType === "log") {
            const tickCandidates = d3_scale.ticks(maxLogLines)
            ticks = tickCandidates.map(tickValue => {
                // 10^x
                if (Math.fround(Math.log10(tickValue)) % 1 === 0)
                    return { value: tickValue, priority: 1 }
                // 5 * 10^x
                else if (Math.fround(Math.log10(tickValue * 2)) % 1 === 0)
                    return { value: tickValue, priority: 2 }
                // 2 * 10^x
                else if (Math.fround(Math.log10(tickValue / 2)) % 1 === 0)
                    return { value: tickValue, priority: 2 }
                else
                    return {
                        value: tickValue,
                        priority: 4
                    }
            })

            // Remove some tickmarks again because the chart would get too
            // overwhelming otherwise
            for (let prio = 4; prio > 1; prio--) {
                if (ticks.length > maxLogLines) {
                    ticks = ticks.filter(tick => tick.priority < prio)
                }
            }
        } else {
            // Only use priority 2 here because we want the start / end ticks
            // to be priority 1
            ticks = d3_scale
                .ticks(6)
                .map(tickValue => ({ value: tickValue, priority: 2 }))
        }

        if (this.hideFractionalTicks)
            ticks = ticks.filter(t => t.value % 1 === 0)

        return uniq(ticks)
    }

    getTickFormattingOptions(): TickFormattingOptions {
        // The chart's tick formatting function is used by default to format axis ticks. This means
        // that the chart's `numDecimalPlaces` is also used by default to format the axis ticks.
        //
        // However, the author-specified decimal places are not always appropriate for rendering
        // ticks, because:
        // 1. Subsets of the data may require higher fidelity, e.g. users can use the timeline to
        //    end up in a subset of the dataset where values happen to be much lower than usual.
        // 2. Ticks may be rendered at granularities that may not exist in the data, e.g. the data
        //    may only contain 0 and 1, but we may show ticks in between those values.
        //
        // Therefore, when formatting ticks, we determine the `numDecimalPlaces` automatically, by
        // finding the smallest difference between any pair of ticks and making sure that we have
        // sufficient decimal places to express the difference to the first significant figure (the
        // first non-zero digit).
        //
        // One significant figure is sufficient because we use D3's ticks() and that creates
        // "uniformly-spaced, nicely-rounded values [...] where each value is a power of ten
        // multiplied by 1, 2 or 5"
        // See: https://github.com/d3/d3-array/blob/master/README.md#ticks
        //
        // -@danielgavrilov, 2020-05-27
        const tickValues = this.getTickValues()
        const minDist = min(
            rollingMap(tickValues, (a, b) => Math.abs(a.value - b.value))
        )
        if (minDist !== undefined) {
            // Find the decimal places required to reach the first non-zero digit
            const dp = Math.ceil(-Math.log10(minDist))
            if (isFinite(dp) && dp >= 0) return { numDecimalPlaces: dp }
        }
        return {}
    }

    getFormattedTicks(): string[] {
        const options = this.getTickFormattingOptions()
        return this.getTickValues().map(tickmark =>
            this.tickFormat(tickmark.value, options)
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
