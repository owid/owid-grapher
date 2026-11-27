import type { WelfareType } from "./types.js"
import { WELFARE_TYPE_DETAILS } from "./welfareType.js"

/** A term the note explains on demand: how it reads in a sentence, and its card */
export interface DodDetails {
    term: string
    title: string
    description: string[]
}

/**
 * The note's details on demand: the two welfare types, and "World Bank
 * nowcasts". Kept here as constants like the rest of this project's copy,
 * rather than fetched from the site's DoD dictionary.
 */
export const DODS: Record<WelfareType | "nowcast", DodDetails> = {
    ...WELFARE_TYPE_DETAILS,
    nowcast: {
        term: "World\u00a0Bank nowcasts",
        title: "World Bank nowcasts",
        description: [
            "Household surveys take a lot of time to process, and in many countries they aren't run every year.",
            "Also, they don't run in every country at the same time — the latest survey in France might've been in 2023 and in Guinea in 2018.",
            "For this reason, the World Bank extrapolates its poverty statistics up to the current year based on economic growth estimates and forecasts. They are updated once a newer survey is available.",
        ],
    },
}

export type DodId = keyof typeof DODS

/**
 * A piece of the note: plain text, or a term (DODS) that the UI renders as a
 * details-on-demand span
 */
export type NoteSegment = string | { dod: DodId }

/** The segments as plain text */
export function noteText(segments: NoteSegment[]): string {
    return segments
        .map((segment) =>
            typeof segment === "string" ? segment : DODS[segment.dod].term
        )
        .join("")
}
