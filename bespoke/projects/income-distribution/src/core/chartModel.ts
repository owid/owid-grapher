import * as R from "remeda"

import {
    COUNTRY_COLOR_ROTATION,
    REGION_COLORS,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "./constants.js"
import {
    aggregateByRegion,
    computeCountrySeries,
    DENSITY_GRID,
    estimateLogDensity,
    groupStackByRegion,
    stackSeries,
    type DensityGrid,
} from "./density.js"
import {
    REGIONS,
    type Breakdown,
    type IncomeDistributionYear,
    type Region,
    type View,
} from "./types.js"

/** One drawable area of the chart */
export interface ChartSeries {
    /** Entity name: a country or a region */
    key: string
    region: Region
    isCountry: boolean
    color: string
    /** Lower and upper edge at each grid point; y0 is all zeros for unstacked curves */
    y0: number[]
    y1: number[]
}

/** A region's extent in the country-level stack, for labels and region hover */
export interface RegionBand {
    region: Region
    color: string
    y0: number[]
    y1: number[]
}

export interface IncomeDistributionChartModel {
    grid: DensityGrid
    /** Bottom-most first; drawn in order */
    series: ChartSeries[]
    /**
     * Global view: one band per region regardless of breakdown (labels go
     * here). Countries view: empty.
     */
    regionBands: RegionBand[]
    /** Largest y1 across `series` */
    yMax: number
    /** Legend entries in display order: regions (global) or the selected countries (countries view) */
    legend: { key: string; color: string }[]
}

/**
 * Builds everything the chart draws from the year's data and the current
 * selection. Global view: stacked, all countries, coloured by region (series
 * are countries or regions depending on `breakdown`). Countries view:
 * unstacked per-capita densities of `selectedCountries` (unknown names
 * ignored), coloured with `assignCountryColors`.
 */
export function buildChartModel(args: {
    year: IncomeDistributionYear
    view: View
    breakdown: Breakdown
    selectedCountries: string[]
}): IncomeDistributionChartModel {
    const { series, regionBands, legend } =
        args.view === "global"
            ? buildGlobal(args.year, args.breakdown)
            : buildCountries(args.year, args.selectedCountries)

    return {
        grid: DENSITY_GRID,
        series,
        regionBands,
        yMax: series.reduce(
            (max, s) => s.y1.reduce((m, y) => Math.max(m, y), max),
            0
        ),
        legend,
    }
}

type ChartModelParts = Pick<
    IncomeDistributionChartModel,
    "series" | "regionBands" | "legend"
>

function buildGlobal(
    year: IncomeDistributionYear,
    breakdown: Breakdown
): ChartModelParts {
    const countrySeries = computeCountrySeries(year)
    const countryStack = stackSeries(countrySeries)
    const isCountry = breakdown === "countries"
    const stack = isCountry
        ? countryStack
        : stackSeries(aggregateByRegion(countrySeries))

    const series = stack.map((s): ChartSeries => ({
        key: s.key,
        region: s.region,
        isCountry,
        color: REGION_COLORS[s.region],
        y0: s.y0,
        y1: s.y1,
    }))

    // Bands always come from the country stack, so the region labels sit in
    // the same place whichever breakdown is shown
    const regionBands = groupStackByRegion(countryStack).map(
        (band): RegionBand => ({
            region: band.region,
            color: REGION_COLORS[band.region],
            y0: band.y0,
            y1: band.y1,
        })
    )

    const presentRegions = new Set(countrySeries.map((s) => s.region))
    const legend = REGIONS.filter((region) => presentRegions.has(region)).map(
        (region) => ({ key: region, color: REGION_COLORS[region] })
    )

    return { series, regionBands, legend }
}

function buildCountries(
    year: IncomeDistributionYear,
    selectedCountries: string[]
): ChartModelParts {
    const known = R.unique(
        selectedCountries.filter((name) => year.byName.has(name))
    )
    const names = sortAlphabetically(known)
    // Colours follow the order countries were picked in, so adding one
    // doesn't recolour the rest
    const colors = assignCountryColors(known)
    const zeros = new Array<number>(DENSITY_GRID.incomes.length).fill(0)

    const series = names.map((name): ChartSeries => {
        const country = year.byName.get(name)!
        return {
            key: name,
            region: country.region,
            isCountry: true,
            color: colors.get(name)!,
            y0: zeros,
            // Per capita, so countries of any size are comparable
            y1: estimateLogDensity(country.avgs),
        }
    })

    const legend = series.map((s) => ({ key: s.key, color: s.color }))
    return { series, regionBands: [], legend }
}

/** COUNTRY_COLOR_ROTATION by position in the selection (duplicates ignored), plus WORLD_COLOR for WORLD_ENTITY_NAME */
export function assignCountryColors(countries: string[]): Map<string, string> {
    const colors = new Map<string, string>()
    // The world has its own colour, so it doesn't take a slot in the rotation
    const names = R.unique(
        countries.filter((name) => name !== WORLD_ENTITY_NAME)
    )
    names.forEach((name, i) =>
        colors.set(
            name,
            COUNTRY_COLOR_ROTATION[i % COUNTRY_COLOR_ROTATION.length]
        )
    )
    colors.set(WORLD_ENTITY_NAME, WORLD_COLOR)
    return colors
}

function sortAlphabetically(names: string[]): string[] {
    return names.toSorted((a, b) => a.localeCompare(b, "en"))
}
