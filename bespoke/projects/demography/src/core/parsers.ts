import { CONTROL_YEARS } from "./constants.js"

/** Parse a comma-separated string of numbers into a Record keyed by CONTROL_YEARS.
 *  Empty entries (e.g. ",,1.5") are skipped so they fall back to UN WPP defaults. */
export function parseControlPoints(
    csv: string
): Record<number, number> | undefined {
    const parts = csv.split(",")
    const result: Record<number, number> = {}
    for (let i = 0; i < CONTROL_YEARS.length; i++) {
        const raw = parts[i]?.trim()
        if (raw !== undefined && raw !== "") {
            const v = Number(raw)
            if (!isNaN(v)) {
                result[CONTROL_YEARS[i]] = v
            }
        }
    }
    return Object.keys(result).length > 0 ? result : undefined
}
