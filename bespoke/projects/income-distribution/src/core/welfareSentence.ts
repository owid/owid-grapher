import type { NoteSegment } from "./dods.js"
import { formatCountryList } from "./format.js"
import { WELFARE_TYPES, type WelfareType } from "./types.js"

/**
 * Which of `countries` report income and which consumption, as one sentence
 * for the chart's note: "Germany and the United States report [income after
 * taxes and benefits]; China and India report [consumption]." Countries keep
 * their order within each group. Undefined for no countries.
 */
export function welfareTypeSentence(
    countries: string[],
    welfareTypeOf: (name: string) => WelfareType
): NoteSegment[] | undefined {
    if (countries.length === 0) return undefined
    const groups = WELFARE_TYPES.map((type) => ({
        type,
        countries: countries.filter((name) => welfareTypeOf(name) === type),
    })).filter((group) => group.countries.length > 0)

    if (groups.length === 1 && countries.length > 1) {
        const subject = countries.length === 2 ? "Both" : "All"
        return [
            `${subject} of these countries report `,
            { dod: groups[0].type },
            ".",
        ]
    }

    const segments: NoteSegment[] = []
    groups.forEach((group, i) => {
        const verb = group.countries.length === 1 ? "reports" : "report"
        const subject = formatCountryList(group.countries)
        segments.push(
            `${i > 0 ? "; " : ""}${i === 0 ? capitalize(subject) : subject} ${verb} `,
            { dod: group.type }
        )
    })
    segments.push(".")
    return segments
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}
