import type { ScaleLogarithmic } from "d3-scale"

import { Bounds } from "@ourworldindata/utils"

import {
    combinedFactor,
    formatIncome,
    isCurrencyWrittenAsCode,
} from "./currency.js"
import type { Currency, TimeInterval } from "./types.js"

export interface AxisTick {
    /** Int-$/day, for positioning */
    value: number
    label?: string
}

/** Multiples of each power of ten that get a tick */
const TICK_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
// In order of priority: when neighbouring labels would overlap, the later
// ones give way (the 2s go before the 3s and 5s, as they're the tightest)
export const LABELLED_MULTIPLIERS = [1, 3, 5, 2]
export const LABELLED_MULTIPLIERS_NARROW = [1, 3]
/** Between neighbouring tick labels */
const TICK_LABEL_GAP = 6

/**
 * Ticks at round amounts in the displayed currency and interval (1, 2, 3, 5
 * × 10^k by default), positioned in int-$/day. The other multiples get
 * unlabelled minor ticks, as does a labelled multiple whose label would
 * overlap a higher-priority neighbour's (`labelledMultipliers` is in order
 * of priority). A currency written as its code (CHF) is named on the first
 * label only; the rest are bare numbers.
 */
export function computeAxisTicks(
    xScale: ScaleLogarithmic<number, number>,
    currency: Currency,
    timeInterval: TimeInterval,
    labelledMultipliers: number[],
    fontSize: number
): AxisTick[] {
    const factor = combinedFactor(currency, timeInterval)
    if (!(factor > 0)) return []
    const [min, max] = xScale.domain()
    const codeOnFirstLabelOnly = isCurrencyWrittenAsCode(currency)
    const ticks: (AxisTick & { multiplier: number })[] = []
    for (
        let power = Math.floor(Math.log10(min * factor));
        Math.pow(10, power) <= max * factor;
        power++
    ) {
        for (const multiplier of TICK_MULTIPLIERS) {
            // Round away float noise like 3 × 0.1 = 0.30000000000000004
            const displayed = Number(
                (multiplier * Math.pow(10, power)).toPrecision(12)
            )
            const value = displayed / factor
            if (value < min || value > max) continue
            ticks.push({
                value,
                multiplier,
                label: labelledMultipliers.includes(multiplier)
                    ? formatIncome(value, currency, timeInterval, {
                          short: true,
                          dropCode: codeOnFirstLabelOnly,
                      })
                    : undefined,
            })
        }
    }
    const firstLabelled = ticks.find((tick) => tick.label !== undefined)
    if (codeOnFirstLabelOnly && firstLabelled)
        firstLabelled.label = formatIncome(
            firstLabelled.value,
            currency,
            timeInterval,
            { short: true }
        )

    // Place the labels by priority, dropping any that would overlap one
    // already placed
    const placed: { left: number; right: number }[] = []
    const keep = new Set<AxisTick>()
    // The label naming the currency goes first, so it's always there
    const namesCurrency = codeOnFirstLabelOnly ? firstLabelled : undefined
    const byPriority = [
        ...(namesCurrency ? [namesCurrency] : []),
        ...labelledMultipliers.flatMap((multiplier) =>
            ticks.filter(
                (tick) =>
                    tick.multiplier === multiplier &&
                    tick.label !== undefined &&
                    tick !== namesCurrency
            )
        ),
    ]
    for (const tick of byPriority) {
        if (tick.label === undefined) continue
        const halfWidth =
            Bounds.forText(tick.label, { fontSize }).width / 2 +
            TICK_LABEL_GAP / 2
        const x = xScale(tick.value)
        const box = { left: x - halfWidth, right: x + halfWidth }
        const overlaps = placed.some(
            (other) => box.left < other.right && box.right > other.left
        )
        if (overlaps) continue
        placed.push(box)
        keep.add(tick)
    }
    return ticks.map((tick) => {
        const { multiplier: _multiplier, ...rest } = tick
        return keep.has(tick) ? rest : { ...rest, label: undefined }
    })
}
