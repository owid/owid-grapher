import type { BespokeMetadata } from "@ourworldindata/types"

export type VariantName = "distribution"

/** Which chart the reader is looking at */
export const VIEWS = ["global", "countries"] as const
export type View = (typeof VIEWS)[number]

/** How the global stack is split: one band per World Bank region, or one per country */
export const BREAKDOWNS = ["regions", "countries"] as const
export type Breakdown = (typeof BREAKDOWNS)[number]

/** The unit of time incomes are expressed per */
export const TIME_INTERVALS = ["daily", "monthly", "yearly"] as const
export type TimeInterval = (typeof TIME_INTERVALS)[number]

/** The World Bank regions the feed assigns every country to */
export const REGIONS = [
    "East Asia and Pacific",
    "Europe and Central Asia",
    "Latin America and Caribbean",
    "Middle East, North Africa, Afghanistan and Pakistan",
    "North America",
    "South Asia",
    "Sub-Saharan Africa",
] as const
export type Region = (typeof REGIONS)[number]

/**
 * The feed's per-year file, `income-distribution.<year>.json`, as the ETL
 * (`viz://bespoke/poverty_inequality/latest/income_distribution`) writes it.
 */
export interface RawIncomeDistributionYear {
    year: number
    /** Keyed by country name */
    data: Record<string, RawCountryDistribution>
}

export interface RawCountryDistribution {
    country: string
    region: string
    totalPopulation: number
    /**
     * Mean daily income or consumption per capita (international-$ at 2021
     * prices) of each of the 1000 equally-populated bins, poorest bin first.
     * Rounded to four significant figures by the ETL.
     */
    avgs: number[]
}

/** The feed's `income-distribution.metadata.json`, a `BespokeMetadata` document */
export type RawIncomeDistributionMetadata = BespokeMetadata

export interface CountryDistribution {
    name: string
    region: Region
    population: number
    /** See `RawCountryDistribution.avgs`; exactly 1000 ascending values */
    avgs: number[]
}

export interface IncomeDistributionYear {
    year: number
    /** Sorted by name */
    countries: CountryDistribution[]
    byName: Map<string, CountryDistribution>
}

/**
 * One row of the int-dollar conversions dataset
 * (`external/owid_grapher/latest/int_dollar_conversions` in the ETL catalog)
 */
export interface RawCurrencyConversion {
    country: string
    country_code: string
    /** ISO 4217 code; empty for countries without a usable conversion */
    currency_code: string
    currency_name: string
    ppp_year: number
    ppp_factor: number
    ppp_source: string
    cpi_factor: number
    /** Local currency units (in `conversion_factor_year` prices) per international-$ (2021 prices) */
    conversion_factor: number
    conversion_factor_year: number
}

export interface Currency {
    /** ISO 4217 code, or `INTERNATIONAL_DOLLAR.code` */
    code: string
    name: string
    /** Local currency units per international-$; 1 for the international dollar */
    factor: number
    /** The country whose conversion this is; unset for the international dollar */
    countryName?: string
    countryCode?: string
}
