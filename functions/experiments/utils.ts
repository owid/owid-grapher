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
