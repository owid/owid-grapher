import { atom } from "jotai"
import {
    DEFAULT_YEAR,
    TIME_INTERVAL_FACTORS,
    TIME_INTERVALS,
} from "./utils/incomePlotConstants.ts"
import data from "./data/incomeBins.json"
import { sleep } from "@ourworldindata/utils"
import { kdeLog, REGION_COLORS } from "./utils/incomePlotUtils.ts"
import * as R from "remeda"
import * as Plot from "@observablehq/plot"

export const atomCustomPovertyLine = atom(3)

export const atomShowCustomPovertyLine = atom(false)

// Basic atoms related to data-display controls
export const atomCurrentYear = atom<number>(DEFAULT_YEAR)

const atomTimeIntervalIdx = atom(0)
export const atomTimeInterval = atom(
    (get) => {
        const idx = get(atomTimeIntervalIdx)
        return TIME_INTERVALS[idx]
    },
    // Advance to the next time interval
    (get, set) => {
        const idx = get(atomTimeIntervalIdx)
        const nextIdx = (idx + 1) % TIME_INTERVALS.length
        set(atomTimeIntervalIdx, nextIdx)
    }
)

export const atomTimeIntervalFactor = atom((get) => {
    const idx = get(atomTimeIntervalIdx)
    return TIME_INTERVAL_FACTORS[idx]
})

// Data
export const atomRawDataForYear = atom(async (get, { signal }) => {
    const year = get(atomCurrentYear)

    // TODO pull this into a shared type definition
    const rawData = data as Array<{
        country: string
        region: string
        year: number
        pop: number
        avgsLog2Times100: number[]
    }>

    await sleep(500)
    if (signal.aborted) return []

    const dataForYear = rawData
        .filter((d) => d.year === year)
        .map((d) => ({
            ...d,
            avgsLog2: d.avgsLog2Times100.map((v) => v / 100),
        }))
    const sortedDataForYear = R.sortBy(
        dataForYear,
        [R.prop("region"), "desc"],
        [R.prop("pop"), "desc"]
    )
    return sortedDataForYear
})

export const atomKdeDataForYear = atom(async (get) => {
    const rawData = await get(atomRawDataForYear)
    const kdeData = rawData.flatMap((record) => {
        const common = {
            country: record.country,
            region: record.region,
            year: record.year,
            pop: record.pop,
        }
        const kdeRes = kdeLog(record.avgsLog2)
        return kdeRes.map((kde) => ({
            ...common,
            ...kde,
            y: kde.y * common.pop,
        }))
    })
    return kdeData
})

// Legend
const atomEntityColors = atom(() =>
    Object.values(REGION_COLORS).map((color, idx) => ({
        name: Object.keys(REGION_COLORS)[idx],
        color: color,
    }))
)

export const atomLegendEntries = atomEntityColors

export const atomPlotColorScale = atom<Plot.ScaleOptions>((get) => {
    const legendEntries = get(atomLegendEntries)

    return {
        domain: legendEntries.map((entry) => entry.name),
        range: legendEntries.map((entry) => entry.color),
    }
})

export const atomHoveredEntity = atom<string | null>(null)
