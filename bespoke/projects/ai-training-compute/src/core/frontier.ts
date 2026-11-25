import { LAST_YEAR } from "./constants.js"
import { ECI_SCORES, getLeaderSegmentsSince } from "./eci.js"

export const FRONTIER_START_YEAR = 2024

/**
 * Models that led the Epoch Capabilities Index since 2024, plus the leader
 * at the start (GPT-4, from its release in 2023). Most have no training
 * compute estimate, so they're shown in a row above the plot.
 */
export const FRONTIER_SEGMENTS = getLeaderSegmentsSince(ECI_SCORES, {
    since: Date.UTC(FRONTIER_START_YEAR, 0, 1),
    end: Date.now(),
})

/** A time range of whole years that takes in the first leader's release */
export const FRONTIER_TIME_RANGE: [number, number] = [
    Math.floor(FRONTIER_SEGMENTS[0]?.startYear ?? FRONTIER_START_YEAR),
    LAST_YEAR,
]
