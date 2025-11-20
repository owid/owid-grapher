import { atom } from "jotai"
import {
    DEFAULT_YEAR,
    TIME_INTERVAL_FACTORS,
    TIME_INTERVALS,
} from "./utils/incomePlotConstants.ts"

export const atomCustomPovertyLine = atom(3)

export const atomShowCustomPovertyLine = atom(false)

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
