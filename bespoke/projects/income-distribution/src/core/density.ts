import * as R from "remeda"

import {
    DENSITY_BINS,
    DENSITY_MAX_INCOME,
    DENSITY_MIN_INCOME,
    KDE_BANDWIDTH,
    WORLD_ENTITY_NAME,
} from "./constants.js"
import {
    REGIONS,
    type CountryDistribution,
    type IncomeDistributionYear,
    type Region,
} from "./types.js"

/** The shared x-axis every density is evaluated on */
export interface DensityGrid {
    /** Income in international-$ per day at each grid point, log-spaced ascending */
    incomes: number[]
    /** log2 of `incomes` */
    log2Incomes: number[]
    /** Spacing of `log2Incomes` */
    step: number
}

function makeDensityGrid(
    minIncome: number,
    maxIncome: number,
    numPoints: number
): DensityGrid {
    const lo = Math.log2(minIncome)
    const step = (Math.log2(maxIncome) - lo) / (numPoints - 1)
    const log2Incomes = R.range(0, numPoints).map((i) => lo + i * step)
    return { incomes: log2Incomes.map((x) => 2 ** x), log2Incomes, step }
}

/** DENSITY_BINS points from DENSITY_MIN_INCOME to DENSITY_MAX_INCOME */
export const DENSITY_GRID: DensityGrid = makeDensityGrid(
    DENSITY_MIN_INCOME,
    DENSITY_MAX_INCOME,
    DENSITY_BINS
)

/** Gaussian weights at whole-step offsets 0…4 sd; symmetric, so one side is enough */
const kernelCache = new Map<number, number[]>()
function gaussianKernel(step: number): number[] {
    let kernel = kernelCache.get(step)
    if (!kernel) {
        const halfWidth = Math.ceil((4 * KDE_BANDWIDTH) / step)
        kernel = R.range(0, halfWidth + 1).map((j) =>
            Math.exp(-0.5 * ((j * step) / KDE_BANDWIDTH) ** 2)
        )
        kernelCache.set(step, kernel)
    }
    return kernel
}

/**
 * Gaussian kernel density estimate of log2(income) over the grid, from the
 * 1000 bin means, with KDE_BANDWIDTH in log2 units. Returns one value per
 * grid point; the values integrate to ~1 over the log2 axis (so a country's
 * curve has the same area whatever its population).
 *
 * A binned KDE: the points are first spread onto the grid with linear
 * binning (points beyond either end count towards the edge point), then
 * convolved with a discretised kernel truncated at ±4 sd. That's ~15 kernel
 * weights per grid point instead of one per data point.
 */
export function estimateLogDensity(
    avgs: number[],
    grid: DensityGrid = DENSITY_GRID
): number[] {
    const n = grid.log2Incomes.length
    const lo = grid.log2Incomes[0]

    const counts = new Float64Array(n)
    for (const avg of avgs) {
        // log2(0) is -Infinity, which the clamp sends to the first grid point
        const position = R.clamp((Math.log2(avg) - lo) / grid.step, {
            min: 0,
            max: n - 1,
        })
        const i = Math.floor(position)
        const frac = position - i
        counts[i] += 1 - frac
        if (frac > 0) counts[i + 1] += frac
    }

    const kernel = gaussianKernel(grid.step)
    const halfWidth = kernel.length - 1
    const density = new Array<number>(n).fill(0)
    let total = 0
    for (let i = 0; i < n; i++) {
        let sum = 0
        const from = Math.max(0, i - halfWidth)
        const to = Math.min(n - 1, i + halfWidth)
        for (let j = from; j <= to; j++)
            sum += counts[j] * kernel[Math.abs(i - j)]
        density[i] = sum
        total += sum
    }

    // Normalising by the actual sum also makes up for kernel mass that fell
    // off either end of the grid
    const scale = total > 0 ? 1 / (total * grid.step) : 0
    return density.map((value) => value * scale)
}

export interface DensitySeries {
    /** Entity name: a country, or a region for aggregated series */
    key: string
    region: Region
    population: number
    /** `estimateLogDensity` output (per-capita density, area ~1) */
    density: number[]
}

/**
 * One series per country, in stacking order: grouped by region (REGIONS
 * order reversed, so the first region ends up on top), and within a region
 * by population descending.
 */
export function computeCountrySeries(
    year: IncomeDistributionYear
): DensitySeries[] {
    const ordered = R.sortBy(
        year.countries,
        [(country) => REGIONS.indexOf(country.region), "desc"],
        [(country) => country.population, "desc"]
    )
    return ordered.map((country) => ({
        key: country.name,
        region: country.region,
        population: country.population,
        density: estimateLogDensity(country.avgs),
    }))
}

/**
 * Population-weighted merge of the countries of each region into one series
 * per region (`key` = region name), keeping the input's region order. The
 * merged density is normalised back to area ~1.
 */
export function aggregateByRegion(series: DensitySeries[]): DensitySeries[] {
    const byRegion = new Map<Region, DensitySeries[]>()
    for (const s of series) {
        const members = byRegion.get(s.region)
        if (members) members.push(s)
        else byRegion.set(s.region, [s])
    }

    return [...byRegion].map(([region, members]) => {
        const population = R.sumBy(members, (s) => s.population)
        const numPoints = members[0].density.length
        const density = new Array<number>(numPoints).fill(0)
        for (const member of members) {
            // A weighted mean of area-1 curves has area 1 itself
            const weight = population > 0 ? member.population / population : 0
            for (let i = 0; i < numPoints; i++)
                density[i] += member.density[i] * weight
        }
        return { key: region, region, population, density }
    })
}

export interface StackedSeries extends DensitySeries {
    /** Lower and upper edge at each grid point, in people per log2 unit (density × population), first input series at the bottom */
    y0: number[]
    y1: number[]
}

export function stackSeries(series: DensitySeries[]): StackedSeries[] {
    let baseline: number[] | undefined
    return series.map((s) => {
        const y0 = baseline ?? new Array<number>(s.density.length).fill(0)
        const y1 = s.density.map((d, i) => y0[i] + d * s.population)
        baseline = y1
        return { ...s, y0, y1 }
    })
}

/**
 * Share (0–1) of a country's population living below `line` (int-$/day):
 * the number of bins whose mean is below the line, over 1000.
 */
export function shareBelowLine(
    distribution: CountryDistribution,
    line: number
): number {
    return R.sortedIndex(distribution.avgs, line) / distribution.avgs.length
}

/**
 * Population-weighted share below the line for each requested entity, which
 * may be a country name, a region name or WORLD_ENTITY_NAME. Unknown
 * entities are left out of the result.
 */
export function shareBelowLineForEntities(
    year: IncomeDistributionYear,
    line: number,
    entities: string[]
): Map<string, number> {
    const result = new Map<string, number>()
    for (const entity of entities) {
        const country = year.byName.get(entity)
        if (country) {
            result.set(entity, shareBelowLine(country, line))
            continue
        }

        const members =
            entity === WORLD_ENTITY_NAME
                ? year.countries
                : year.countries.filter((c) => c.region === entity)
        const population = R.sumBy(members, (c) => c.population)
        if (population <= 0) continue
        const below = R.sumBy(
            members,
            (c) => c.population * shareBelowLine(c, line)
        )
        result.set(entity, below / population)
    }
    return result
}
