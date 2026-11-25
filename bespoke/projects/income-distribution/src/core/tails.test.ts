import { describe, expect, it } from "vitest"

import { tailFades } from "./tails.js"

/** 1000 ascending bin means of a log-normal-ish spread: no long tails */
function regularAvgs(): number[] {
    return Array.from({ length: 1000 }, (_, i) =>
        Math.exp(Math.log(5) + 0.7 * inverseNormal((i + 0.5) / 1000))
    )
}

/** Acklam's rational approximation, plenty for test data */
function inverseNormal(p: number): number {
    const a = [
        -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
        1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
    ]
    const b = [
        -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
        6.680131188771972e1, -1.328068155288572e1,
    ]
    const c = [
        -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
        -2.549732539343734, 4.374664141464968, 2.938163982698783,
    ]
    const d = [
        7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
        3.754408661907416,
    ]
    if (p < 0.02425) {
        const q = Math.sqrt(-2 * Math.log(p))
        return (
            (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
                c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
        )
    }
    if (p > 1 - 0.02425) return -inverseNormal(1 - p)
    const q = p - 0.5
    const r = q * q
    return (
        ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
            q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    )
}

describe(tailFades, () => {
    it("finds no long tails in a regular distribution", () => {
        expect(tailFades(regularAvgs())).toEqual({})
    })

    it("fades a left tail of bottom-coded incomes, from the 0.5th to the 2nd percentile", () => {
        // As in an income survey: the poorest half-percent at $0.28 a day
        const avgs = regularAvgs()
        for (let i = 0; i < 5; i++) avgs[i] = 0.28
        const fades = tailFades(avgs)
        expect(fades.right).toBeUndefined()
        expect(fades.left).toEqual({ from: 0.28, to: avgs[19] })
    })

    it("fades a long right tail the same way", () => {
        const avgs = regularAvgs()
        for (let i = 995; i < 1000; i++) avgs[i] = avgs[994] * 5
        const fades = tailFades(avgs)
        expect(fades.left).toBeUndefined()
        expect(fades.right).toEqual({ from: avgs[995], to: avgs[980] })
    })

    it("ignores distributions too coarse to have tails", () => {
        expect(tailFades([1, 2, 3])).toEqual({})
    })
})
