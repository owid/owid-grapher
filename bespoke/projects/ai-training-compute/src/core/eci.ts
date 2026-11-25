import * as R from "remeda"

import rawScores from "../data/eciScores.json"

import { ColorScheme } from "./constants.js"
import {
    ComputeStatus,
    getComputeStatus,
    getModelGroups,
} from "./colorSchemes.js"
import { toFractionalYear } from "./data.js"

/** One row of src/data/eciScores.json, as exported by scripts/buildData.sql */
export interface EciScore {
    model: string
    displayName: string
    organization: string | null
    /** YYYY-MM-DD */
    date: string
    eci: number
    /** 90% range; null for the two anchor models, whose scores are fixed */
    eciLow: number | null
    eciHigh: number | null
    trainingComputeFlop: number | null
    computeEstimationMethod: string | null
}

export const ECI_SCORES = rawScores as EciScore[]

export interface LeaderSegment {
    score: EciScore
    /** Start and end of this model's lead, in ms since the epoch */
    start: number
    end: number
    /** The same, as fractional years for the time axis */
    startYear: number
    endYear: number
    /** Days the model led, counted from its release */
    days: number
    /** Still the leader at the end of the range */
    isOngoing: boolean
    computeStatus: ComputeStatus
    /**
     * Color groups, as for the scatter's dots. Every model on the ECI is a
     * language model from a company, so domain and sector are fixed.
     */
    groups: Record<ColorScheme, string>
}

const DAY_MS = 24 * 60 * 60 * 1000

function toTime(date: string): number {
    return Date.parse(`${date}T00:00:00Z`)
}

/**
 * The sequence of models that held the highest ECI score released so far,
 * each from its release until a higher-scoring model came out, clipped to
 * [start, end]. When several models came out on the same day only the
 * highest-scoring one counts, so a same-day pair doesn't produce a
 * zero-length lead.
 */
export function getLeaderSegments(
    scores: EciScore[],
    { start, end }: { start: number; end: number }
): LeaderSegment[] {
    const bestPerDay = R.pipe(
        scores,
        R.groupBy((score) => score.date),
        R.values(),
        R.map((sameDay) => R.firstBy(sameDay, [(s) => s.eci, "desc"])),
        R.sortBy((score) => score.date)
    )

    const leaders: EciScore[] = []
    for (const score of bestPerDay) {
        const current = leaders.at(-1)
        if (!current || score.eci > current.eci) leaders.push(score)
    }

    return leaders.flatMap((score, i) => {
        const released = toTime(score.date)
        const next = leaders[i + 1]
        const until = next ? toTime(next.date) : end
        if (until <= start || released >= end) return []
        return [
            {
                score,
                start: Math.max(released, start),
                end: Math.min(until, end),
                startYear: toFractionalYear(
                    new Date(Math.max(released, start))
                ),
                endYear: toFractionalYear(new Date(Math.min(until, end))),
                days: Math.round((Math.min(until, end) - released) / DAY_MS),
                isOngoing: !next || until > end,
                computeStatus: getComputeStatus(
                    score.trainingComputeFlop,
                    score.computeEstimationMethod
                ),
                groups: getModelGroups({
                    organization: score.organization,
                    organizationCategory: "Industry",
                    domain: "Language",
                    trainingComputeFlop: score.trainingComputeFlop,
                    computeEstimationMethod: score.computeEstimationMethod,
                }),
            },
        ]
    })
}

/**
 * Leaders from `since` to `end`, extended back to the release of whichever
 * model was already leading at `since`, so the first segment shows its full
 * lead rather than starting mid-way.
 */
export function getLeaderSegmentsSince(
    scores: EciScore[],
    { since, end }: { since: number; end: number }
): LeaderSegment[] {
    const first = getLeaderSegments(scores, { start: since, end })[0]
    if (!first) return []
    return getLeaderSegments(scores, {
        start: Math.min(since, toTime(first.score.date)),
        end,
    })
}
