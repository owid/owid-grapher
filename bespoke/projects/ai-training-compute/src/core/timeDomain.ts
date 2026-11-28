import { AiModel } from "./constants.js"

/**
 * The time axis's ends, as fractional years: from the start of `startYear`
 * to the end of `endYear` (both included), each defaulting to the year of
 * the earliest or latest model
 */
export function getTimeDomain(
    models: AiModel[],
    { startYear, endYear }: { startYear?: number; endYear?: number }
): [number, number] {
    const years = models.map((m) => m.year)
    const first = startYear ?? Math.floor(Math.min(...years))
    const last = endYear ?? Math.floor(Math.max(...years))
    return [first, Math.max(first, last) + 1]
}
