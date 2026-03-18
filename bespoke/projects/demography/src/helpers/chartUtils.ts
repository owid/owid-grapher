import { MAX_AGE } from "./data"
import { PYRAMID_AGE_GROUPS } from "./constants"

export const CHART_MARGIN = { top: 10, right: 16, bottom: 32, left: 52 }

export const TOOLTIP_STYLE: React.CSSProperties = {
    background: "#333",
    color: "white",
    padding: "4px 8px",
    borderRadius: 3,
    fontSize: 11,
    lineHeight: "1.4",
    pointerEvents: "none",
    whiteSpace: "nowrap",
}

export function formatPopulation(n: number): string {
    const v = Math.abs(n)
    if (v >= 1e9) return (v / 1e9).toFixed(2) + "B"
    if (v >= 1e6) return (v / 1e6).toFixed(1) + "M"
    if (v >= 1e3) return (v / 1e3).toFixed(0) + "K"
    return v.toFixed(0)
}

export function parseAgeGroupBounds(ageGroup: string): {
    startAge: number
    endAge: number
} {
    if (ageGroup.endsWith("+")) {
        const start = parseInt(ageGroup, 10)
        return { startAge: start, endAge: MAX_AGE }
    }
    const [startStr, endStr] = ageGroup.split("-")
    return { startAge: parseInt(startStr, 10), endAge: parseInt(endStr, 10) }
}

/**
 * Compute the median age for a single-sex population array (indexed by age).
 * Returns the age at which cumulative population reaches 50% of the total.
 */
export function computeMedianAgeForSex(populationByAge: number[]): number {
    let total = 0
    for (let age = 0; age <= MAX_AGE; age++) {
        total += populationByAge[age] || 0
    }
    const half = total / 2
    let cumulative = 0
    for (let age = 0; age <= MAX_AGE; age++) {
        cumulative += populationByAge[age] || 0
        if (cumulative >= half) return age
    }
    return 0
}

/**
 * Find which pyramid age group bucket a given single-year age falls into.
 */
export function findAgeGroupForAge(age: number): string | undefined {
    for (const ageGroup of PYRAMID_AGE_GROUPS) {
        const { startAge, endAge } = parseAgeGroupBounds(ageGroup)
        if (age >= startAge && age <= endAge) return ageGroup
    }
    return undefined
}

export function aggregateToPyramidAgeGroups(
    singleYearArray: number[]
): Record<string, number> {
    const grouped: Record<string, number> = {}
    for (const ageGroup of PYRAMID_AGE_GROUPS) {
        const { startAge, endAge } = parseAgeGroupBounds(ageGroup)
        let sum = 0
        for (let age = startAge; age <= Math.min(endAge, MAX_AGE); age++) {
            sum += singleYearArray[age] || 0
        }
        grouped[ageGroup] = sum
    }
    return grouped
}
