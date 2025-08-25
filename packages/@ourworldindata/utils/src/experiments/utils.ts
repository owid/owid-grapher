import { EXPERIMENT_PREFIX } from "./constants.js"
import Cookies from "js-cookie"

/**
 * Gets the assigned experiments for the current user session.
 *
 * Only works on client, i.e. when cookies are available.
 *
 * @returns {Record<string, string>} A mapping of experiment IDs to their assigned arm IDs.
 */
export function getAssignedExperiments(): Record<string, string> | undefined {
    if (typeof window === "undefined") return undefined

    const allCookies = Cookies.get()

    // filter cookies that have cookieName starting with "experiment_"
    const filteredCookies = Object.fromEntries(
        Object.entries(allCookies).filter(([cookieName]) =>
            cookieName.startsWith(`${EXPERIMENT_PREFIX}-`)
        )
    )

    return filteredCookies
}

/*
 * Checks whether all strings in an array are unique.
 *
 * Iterates through the provided array and returns `false` if any duplicate strings are found.
 * Returns `true` if all values are distinct.
 *
 * @param values - An array of strings to check for uniqueness.
 * @returns `true` if all strings are unique, `false` otherwise.
 *
 * @example
 * validateUniqueStrings(["a", "b", "c"]) // true
 * validateUniqueStrings(["a", "b", "a"]) // false
 */
export function validateUniqueStrings(values: string[]): boolean {
    const seen = new Set<string>()
    for (const value of values) {
        if (seen.has(value)) return false
        seen.add(value)
    }
    return true
}
