import type { WelfareType } from "./types.js"
import { WELFARE_TYPE_DETAILS } from "./welfareType.js"

/** A term the note explains on demand: how it reads in a sentence, and its card */
export interface DodDetails {
    term: string
    title: string
    description: string[]
}

/**
 * The note's details on demand: the two welfare types, and "nowcasts". The
 * nowcast text is the site's `nowcast` DoD (managed in the admin) as of
 * November 2026, kept here as a constant like the rest of this project's
 * copy rather than fetched.
 */
export const DODS: Record<WelfareType | "nowcast", DodDetails> = {
    ...WELFARE_TYPE_DETAILS,
    nowcast: {
        term: "nowcasts",
        title: "Nowcast",
        description: [
            "A nowcast is an estimate of the current state of something, worked out before the official data is in. It fills the gap between what has already been measured and what will only be confirmed later.",
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
