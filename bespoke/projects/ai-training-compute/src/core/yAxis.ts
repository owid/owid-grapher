import * as R from "remeda"
import { scaleLinear } from "d3-scale"

import { YScaleType } from "./constants.js"
import {
    formatFlopInWords,
    formatPowerOfTen,
    formatPowerOfTenTick,
    formatScientific,
} from "./formatFlop.js"
import {
    getLinearYTicks,
    getYExponentDomain,
    getYTickExponents,
} from "./axes.js"

export interface YTick {
    value: number
    lines: string[]
}

/**
 * The y axis's domain, labeled ticks and gridlines. Log: labels read
 * "1 million (10⁶)" at round powers of a thousand, with a gridline at every
 * thousandfold step. Linear: round values from zero, with a gridline per
 * label. Narrow charts label in powers of ten alone ("10⁶", "2 × 10²⁶").
 */
export function getYAxis({
    values,
    yScaleType,
    yBounds,
    isNarrow,
}: {
    values: number[]
    yScaleType: YScaleType
    yBounds: { min?: number; max?: number }
    isNarrow: boolean
}): {
    domain: [number, number]
    ticksFor: (plotHeight: number) => YTick[]
    gridValues: (plotHeight: number) => number[]
    linesFor: (value: number) => string[]
} {
    if (yScaleType === "log") {
        const [autoMin, autoMax] = getYExponentDomain(values)
        const minExp = yBounds.min ? Math.log10(yBounds.min) : autoMin
        const maxExp = yBounds.max ? Math.log10(yBounds.max) : autoMax
        const domain: [number, number] = [10 ** minExp, 10 ** maxExp]
        const linesFor = (value: number): string[] => {
            const exp = Math.round(Math.log10(value))
            return isNarrow
                ? [formatPowerOfTen(exp)]
                : [`${formatPowerOfTenTick(exp)} (${formatPowerOfTen(exp)})`]
        }
        const ticksFor = (plotHeight: number): YTick[] =>
            getYTickExponents([minExp, maxExp], plotHeight).map((exp) => ({
                value: 10 ** exp,
                lines: linesFor(10 ** exp),
            }))
        return {
            domain,
            ticksFor,
            gridValues: () =>
                R.range(Math.ceil(minExp - 1e-9), Math.floor(maxExp + 1e-9) + 1)
                    .filter((exp) => exp % 3 === 0)
                    .map((exp) => 10 ** exp),
            linesFor,
        }
    }

    const min = yBounds.min ?? 0
    const max =
        yBounds.max ??
        scaleLinear()
            .domain([min, Math.max(min, ...values) * 1.05])
            .nice()
            .domain()[1]
    const domain: [number, number] = [min, max]
    const linesFor = (value: number): string[] => {
        if (value === 0) return ["0"]
        if (isNarrow) return [formatScientific(value)]
        const words = formatFlopInWords(value, { significantDigits: 3 })
        return [`${words} (${formatScientific(value)})`]
    }
    const ticksFor = (plotHeight: number): YTick[] =>
        (min === 0
            ? getLinearYTicks(max, plotHeight)
            : scaleLinear()
                  .domain(domain)
                  .ticks(Math.max(2, Math.floor(plotHeight / 50)))
        ).map((value) => ({ value, lines: linesFor(value) }))
    return {
        domain,
        ticksFor,
        gridValues: (plotHeight) => ticksFor(plotHeight).map((t) => t.value),
        linesFor,
    }
}
