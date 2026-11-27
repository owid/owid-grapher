export type VariantName = "distribution" | "tutorial"

/** The tutorial variant's walkthroughs (see walkthroughs.ts) */
export const WALKTHROUGH_IDS = [
    "how-to-use",
    "poverty-in-richer-and-poorer-countries",
] as const
export type WalkthroughId = (typeof WALKTHROUGH_IDS)[number]

/** Which chart the reader is looking at */
export const VIEWS = ["global", "countries"] as const
export type View = (typeof VIEWS)[number]

/** What the legend's bars show when a poverty line is set */
export const LEGEND_MEASURES = ["share", "people"] as const
export type LegendMeasure = (typeof LEGEND_MEASURES)[number]

/** No poverty line, the World Bank's international one, or one the reader set */
export type PovertyLineMode = "off" | "international" | "custom"

/** The unit of time incomes are expressed per */
export const TIME_INTERVALS = ["daily", "monthly", "yearly"] as const
export type TimeInterval = (typeof TIME_INTERVALS)[number]

/**
 * What a country's household surveys measure: income (after taxes and
 * benefits) or consumption, as PIP's `welfare_type`
 */
export const WELFARE_TYPES = ["income", "consumption"] as const
export type WelfareType = (typeof WELFARE_TYPES)[number]

/**
 * How PIP arrived at a country's distribution for the year: from a survey
 * of that year, by extrapolating or interpolating its surveys, or, without
 * any survey, by modelling it from the region's
 */
export const ESTIMATION_TYPES = ["survey", "extrapolated", "modeled"] as const
export type EstimationType = (typeof ESTIMATION_TYPES)[number]

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
    /** See WELFARE_TYPES */
    welfareType: string
    /** See ESTIMATION_TYPES */
    estimationType: string
    /**
     * Mean daily income or consumption per capita (international-$ at 2021
     * prices) of each of the 1000 equally-populated bins, poorest bin first.
     * Rounded to four significant figures by the ETL.
     */
    avgs: number[]
}

export interface CountryDistribution {
    name: string
    region: Region
    population: number
    welfareType: WelfareType
    estimationType: EstimationType
    /** See `RawCountryDistribution.avgs`; exactly 1000 ascending values */
    avgs: number[]
}

export interface IncomeDistributionYear {
    year: number
    /** Sorted by name */
    countries: CountryDistribution[]
    /**
     * The names of the countries a reader can pick to compare: those whose
     * distribution rests on their own surveys. A modelled one (no survey at
     * all, shaped after its region) still counts towards the global stack,
     * but isn't worth looking at on its own.
     */
    selectableNames: string[]
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
    /** The year whose prices the amounts are in; unset for the international dollar (2021) */
    pricesYear?: number
}
