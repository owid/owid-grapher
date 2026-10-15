import { OwidDistinctColors } from "@ourworldindata/grapher/src/color/CustomSchemes.js"

import type { Currency, Region, TimeInterval } from "./types.js"

/** The World Bank's international poverty line, in international-$ per day (2021 prices) */
export const INT_POVERTY_LINE = 3

/**
 * The year shown when the config doesn't name one. The feed has 1990–2026,
 * the last years of which are World Bank nowcasts.
 */
export const DEFAULT_YEAR = 2025

/**
 * From this year on the feed's figures are World Bank nowcasts rather than
 * survey-based lineups, which the chart footer says.
 */
export const FIRST_NOWCAST_YEAR = 2025

/**
 * The countries the selected-countries view starts with. "userLocation" is
 * the sentinel the reader's own country gets substituted for.
 */
export const USER_LOCATION_SENTINEL = "userLocation"
export const DEFAULT_COUNTRIES = [
    "China",
    "United States",
    "India",
    "Nigeria",
    USER_LOCATION_SENTINEL,
]

/** The whole stack, used for a legend row and share-below-line totals */
export const WORLD_ENTITY_NAME = "World"

/** Below this container width the chart lays out for a phone */
export const NARROW_BREAKPOINT = 550

export const INTERNATIONAL_DOLLAR: Currency = {
    code: "INTD",
    name: "International dollar",
    factor: 1,
}

/** The int-dollar conversions dataset, published by hand to the ETL catalog rather than through a bespoke feed */
export const CURRENCY_CONVERSIONS_URL =
    "https://catalog.ourworldindata.org/external/owid_grapher/latest/int_dollar_conversions/int_dollar_conversions.json"

/** Multiplier from a daily amount to the given interval */
export const TIME_INTERVAL_FACTORS: Record<TimeInterval, number> = {
    daily: 1,
    monthly: 365 / 12,
    yearly: 365,
}

export const TIME_INTERVAL_LABELS: Record<TimeInterval, string> = {
    daily: "Day",
    monthly: "Month",
    yearly: "Year",
}

export const REGION_COLORS: Record<Region, string> = {
    "East Asia and Pacific": OwidDistinctColors.Turquoise,
    "Europe and Central Asia": OwidDistinctColors.Denim,
    "Latin America and Caribbean": OwidDistinctColors.DustyCoral,
    "Middle East, North Africa, Afghanistan and Pakistan":
        OwidDistinctColors.Camel,
    "North America": OwidDistinctColors.Peach,
    "South Asia": OwidDistinctColors.TealishGreen,
    "Sub-Saharan Africa": OwidDistinctColors.Mauve,
}

export const WORLD_COLOR = OwidDistinctColors.Purple

/** Colours for the selected-countries view, assigned in selection order */
export const COUNTRY_COLOR_ROTATION: string[] = [
    OwidDistinctColors.Turquoise,
    OwidDistinctColors.Denim,
    OwidDistinctColors.DustyCoral,
    OwidDistinctColors.Camel,
    OwidDistinctColors.Peach,
    OwidDistinctColors.TealishGreen,
    OwidDistinctColors.Mauve,
]

/**
 * Density estimation settings. Incomes are smoothed on a log2 axis, where a
 * bandwidth of 0.1 is a tenth of a doubling, over 200 log-spaced grid points
 * between 25 cents and $1000 a day.
 */
export const KDE_BANDWIDTH = 0.1
export const DENSITY_MIN_INCOME = 0.25
export const DENSITY_MAX_INCOME = 1000
export const DENSITY_BINS = 200
