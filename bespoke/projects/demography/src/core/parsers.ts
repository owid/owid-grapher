import { CONTROL_YEARS } from "./constants.js"

export function parseControlPoints(
    csv: string
): Record<number, number> | undefined {
    const parts = csv.split(",")
    const result: Record<number, number> = {}
    for (let i = 0; i < CONTROL_YEARS.length; i++) {
        const raw = parts[i]?.trim()
        if (raw === undefined || raw === "") continue
        const v = Number(raw)
        if (!Number.isFinite(v)) throw new Error(`Not a number: "${raw}"`)
        result[CONTROL_YEARS[i]] = v
    }
    return Object.keys(result).length > 0 ? result : undefined
}
