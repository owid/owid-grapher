import { roundSigFig } from "@ourworldindata/utils"
import * as fastKde from "fast-kde"

export function formatCurrency(num: number) {
    if (num > 10) return "$" + roundSigFig(num, 2)
    if (num > 1) return "$" + (Math.round(num * 10) / 10).toFixed(2)
    else return "$" + num.toFixed(2)
}

const BANDWIDTH = 0.15
const EXTENT = [0.25, 1000].map(Math.log2)

export function kdeLog(pointsLog2: number[]) {
    const k = fastKde.density1d(pointsLog2, {
        bandwidth: BANDWIDTH,
        extent: EXTENT,
    })
    return [...k.points()].map((p) => ({ ...p, x: Math.pow(2, p.x) }))
}
