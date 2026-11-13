import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import { WELFARE_TYPES, type WelfareType } from "./types.js"

/** "A", "A and B", "A, B and C", with names as they read mid-sentence ("the United States") */
export function formatCountryList(countries: string[]): string {
    const names = countries.map((name) => formatEntityNameForSentence(name))
    if (names.length <= 1) return names.join("")
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

/**
 * Which of `countries` report income and which consumption, as one sentence
 * for the chart's note: "Germany and the United States report income; China
 * and India report consumption." Countries keep their order within each
 * group. Undefined for no countries.
 */
export function welfareTypeSentence(
    countries: string[],
    welfareTypeOf: (name: string) => WelfareType
): string | undefined {
    if (countries.length === 0) return undefined
    const groups = WELFARE_TYPES.map((type) => ({
        type,
        countries: countries.filter((name) => welfareTypeOf(name) === type),
    })).filter((group) => group.countries.length > 0)

    if (groups.length === 1 && countries.length > 1) {
        const subject = countries.length === 2 ? "Both" : "All"
        return `${subject} of these countries report ${groups[0].type}.`
    }

    const clauses = groups.map(
        (group) =>
            `${formatCountryList(group.countries)} ${group.countries.length === 1 ? "reports" : "report"} ${group.type}`
    )
    return `${capitalize(clauses.join("; "))}.`
}

function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1)
}
