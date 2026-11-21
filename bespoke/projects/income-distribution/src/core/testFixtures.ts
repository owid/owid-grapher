import * as R from "remeda"

import { parseIncomeDistributionYear } from "./data.js"
import type {
    RawCountryDistribution,
    RawCurrencyConversion,
    RawIncomeDistributionYear,
    Region,
} from "./types.js"

/**
 * 1000 ascending bin means of a log-logistic income distribution: half the
 * population lives below `median`, and `spread` widens it (in log units)
 */
export function syntheticAvgs(median: number, spread = 0.5): number[] {
    return R.range(0, 1000).map((i) => {
        const p = (i + 0.5) / 1000
        return median * (p / (1 - p)) ** spread
    })
}

function rawCountry(
    country: string,
    region: Region,
    totalPopulation: number,
    median: number
): RawCountryDistribution {
    return { country, region, totalPopulation, avgs: syntheticAvgs(median) }
}

/**
 * Three made-up countries in two regions, listed out of alphabetical order:
 * - Sub-Saharan Africa: Poorland (100 people, median $2), Richland (50, $40)
 * - South Asia: Middleland (300, $5)
 */
export const RAW_YEAR: RawIncomeDistributionYear = {
    year: 2025,
    data: {
        Richland: rawCountry("Richland", "Sub-Saharan Africa", 50, 40),
        Poorland: rawCountry("Poorland", "Sub-Saharan Africa", 100, 2),
        Middleland: rawCountry("Middleland", "South Asia", 300, 5),
    },
}

export const YEAR = parseIncomeDistributionYear(RAW_YEAR)

export function conversionRow(
    overrides: Partial<RawCurrencyConversion>
): RawCurrencyConversion {
    return {
        country: "Germany",
        country_code: "DEU",
        currency_code: "EUR",
        currency_name: "Euro",
        ppp_year: 2021,
        ppp_factor: 0.7,
        ppp_source: "pip",
        cpi_factor: 1.2,
        conversion_factor: 0.85,
        conversion_factor_year: 2025,
        ...overrides,
    }
}
