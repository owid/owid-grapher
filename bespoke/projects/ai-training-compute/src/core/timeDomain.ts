import { AiModel } from "./constants.js"

/** The years of the earliest and latest model */
export function getYearExtent(models: AiModel[]): [number, number] {
    const years = models.map((m) => m.year)
    return [Math.floor(Math.min(...years)), Math.floor(Math.max(...years))]
}

/**
 * A range of whole years, `startYear` and `endYear` each defaulting to the
 * data's extent and clamped to it
 */
export function getInitialYearRange(
    extent: [number, number],
    { startYear, endYear }: { startYear?: number; endYear?: number }
): [number, number] {
    const clamp = (year: number): number =>
        Math.min(extent[1], Math.max(extent[0], year))
    const start = clamp(startYear ?? extent[0])
    const end = clamp(endYear ?? extent[1])
    return [Math.min(start, end), Math.max(start, end)]
}

/**
 * The time axis's ends, as fractional years: from the start of the first
 * year to the end of the last, both included in full
 */
export function getTimeDomain([start, end]: [number, number]): [
    number,
    number,
] {
    return [start, end + 1]
}
