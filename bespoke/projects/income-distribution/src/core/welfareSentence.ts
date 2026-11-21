import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import { WELFARE_TYPES, type WelfareType } from "./types.js"
import { WELFARE_TYPE_DETAILS } from "./welfareType.js"

/** "A", "A and B", "A, B and C", with names as they read mid-sentence ("the United States") */
export function formatCountryList(countries: string[]): string {
    const names = countries.map((name) => formatEntityNameForSentence(name))
    if (names.length <= 1) return names.join("")
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/**
 * A piece of a sentence: plain text, or a welfare type's term
 * (WELFARE_TYPE_DETAILS), which the UI renders as a details-on-demand span
 */
export type WelfareSentenceSegment = string | { welfareType: WelfareType }

/**
 * Which of `countries` report income and which consumption, as one sentence
 * for the chart's note: "Germany and the United States report [income after
 * taxes and benefits]; China and India report [consumption]." Countries keep
 * their order within each group. Undefined for no countries.
 */
export function welfareTypeSentence(
    countries: string[],
    welfareTypeOf: (name: string) => WelfareType
): WelfareSentenceSegment[] | undefined {
    if (countries.length === 0) return undefined
    const groups = WELFARE_TYPES.map((type) => ({
        type,
        countries: countries.filter((name) => welfareTypeOf(name) === type),
    })).filter((group) => group.countries.length > 0)

    if (groups.length === 1 && countries.length > 1) {
        const subject = countries.length === 2 ? "Both" : "All"
        return [
            `${subject} of these countries report `,
            { welfareType: groups[0].type },
            ".",
        ]
    }

    const segments: WelfareSentenceSegment[] = []
    groups.forEach((group, i) => {
        const verb = group.countries.length === 1 ? "reports" : "report"
        const subject = formatCountryList(group.countries)
        segments.push(
            `${i > 0 ? "; " : ""}${i === 0 ? capitalize(subject) : subject} ${verb} `,
            { welfareType: group.type }
        )
    })
    segments.push(".")
    return segments
}

/** The sentence as plain text */
export function welfareSentenceText(
    segments: WelfareSentenceSegment[]
): string {
    return segments
        .map((segment) =>
            typeof segment === "string"
                ? segment
                : WELFARE_TYPE_DETAILS[segment.welfareType].term
        )
        .join("")
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}
