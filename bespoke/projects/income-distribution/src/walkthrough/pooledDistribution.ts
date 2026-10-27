import type { CountryDistribution } from "../core/types.js"

/**
 * The bins of several countries pooled into one population, weighted by
 * population. Read off the bins rather than the smoothed curves, so the
 * numbers the walkthrough quotes are the data's own.
 */
export interface PooledDistribution {
    /** Number of people */
    population: number
    /** Number of people living on less than `income` (int-$/day) */
    below(income: number): number
    /** Number of people living on `lo` (int-$/day) or more, but less than `hi` */
    between(lo: number, hi: number): number
    /** The income (int-$/day) below which the share `p` (0–1) of people live */
    quantile(p: number): number
}

export function poolDistributions(
    countries: CountryDistribution[]
): PooledDistribution {
    const rows: [income: number, people: number][] = []
    for (const country of countries) {
        const people = country.population / country.avgs.length
        for (const avg of country.avgs) rows.push([avg, people])
    }
    rows.sort((a, b) => a[0] - b[0])

    const incomes = new Float64Array(rows.length)
    // Number of people in this bin and every poorer one
    const cumulative = new Float64Array(rows.length)
    let total = 0
    rows.forEach(([income, people], i) => {
        total += people
        incomes[i] = income
        cumulative[i] = total
    })

    const below = (income: number): number => {
        // The first bin at or above the income
        let lo = 0
        let hi = incomes.length
        while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (incomes[mid] < income) lo = mid + 1
            else hi = mid
        }
        return lo > 0 ? cumulative[lo - 1] : 0
    }

    const quantile = (p: number): number => {
        if (incomes.length === 0) return NaN
        let lo = 0
        let hi = cumulative.length - 1
        while (lo < hi) {
            const mid = (lo + hi) >> 1
            if (cumulative[mid] < p * total) lo = mid + 1
            else hi = mid
        }
        return incomes[lo]
    }

    return {
        population: total,
        below,
        between: (lo, hi) => below(hi) - below(lo),
        quantile,
    }
}
