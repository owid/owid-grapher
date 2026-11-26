import { roundSigFig } from "@ourworldindata/utils"

import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import type { TimeInterval } from "./types.js"

const TIME_INTERVAL_NOUNS: Record<TimeInterval, string> = {
    daily: "day",
    monthly: "month",
    yearly: "year",
}

/** "day" | "month" | "year", for sentences like "less than $3 a day" */
export function timeIntervalNoun(interval: TimeInterval): string {
    return TIME_INTERVAL_NOUNS[interval]
}

/**
 * "12%", "<1%", ">99%" from a 0–1 share. Never "0%" or "100%": the
 * estimates come from smoothed distributions, so neither nobody nor everyone
 * is a claim worth making.
 */
export function formatShare(share: number): string {
    const rounded = Math.round(share * 100)
    if (rounded < 1) return "<1%"
    if (rounded > 99) return ">99%"
    return `${rounded}%`
}

/**
 * A number of people to two significant figures: "3.7 billion",
 * "570 million", "4.9 million", "850,000"
 */
export function formatPeople(count: number): string {
    const rounded = roundSigFig(count, 2)
    if (rounded >= 1e9) return `${roundSigFig(rounded / 1e9, 2)} billion`
    if (rounded >= 1e6) return `${roundSigFig(rounded / 1e6, 2)} million`
    return Math.round(rounded).toLocaleString("en-US")
}

/** "A", "A and B", "A, B, and C" (Oxford comma from three on), with names as they read mid-sentence ("the United States") */
export function formatCountryList(countries: string[]): string {
    const names = countries.map((name) => formatEntityNameForSentence(name))
    if (names.length <= 1) return names.join("")
    const comma = names.length > 2 ? "," : ""
    return `${names.slice(0, -1).join(", ")}${comma} and ${names[names.length - 1]}`
}
