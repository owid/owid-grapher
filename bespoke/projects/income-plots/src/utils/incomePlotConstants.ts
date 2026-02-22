import { SeriesPoint } from "d3-shape"
import { IntDollarConversionKeyInfo } from "../types"

export const INT_POVERTY_LINE = 3.0

export const WORLD_ENTITY_NAME = "World"

export const AVAILABLE_YEARS_RANGE = [1990, 2025] as const
export const DEFAULT_YEAR = AVAILABLE_YEARS_RANGE[1]

export const TIME_INTERVALS = ["daily", "monthly", "yearly"] as const
export type TimeInterval = (typeof TIME_INTERVALS)[number]

export const TIME_INTERVAL_FACTORS = [1, 365 / 12, 365] as const

export const INT_DOLLAR_CONVERSIONS_URL =
    "https://owid-public.owid.io/marcel-bespoke-data-viz-02-2026/poverty-plots/int_dollar_conversions.json"

export const DETECT_COUNTRY_URL = "https://detect-country.owid.io/"

export const INT_DOLLAR_CONVERSION_KEY_INFO: IntDollarConversionKeyInfo = {
    currency_code: "INTD",
    currency_name: "International Dollar",
    conversion_factor: 1,
}

export interface LegendEntry {
    name: string
    color: string
}

export type LegendEntries = LegendEntry[]

export const KDE_BANDWIDTH = 0.1
export const KDE_EXTENT = [0.25, 1000].map(Math.log2) as [number, number]
export const KDE_NUM_BINS = 200

export interface StackedSeriesPoint extends Array<SeriesPoint<{ x: number }>> {
    key: string
    country?: string
    region: string
    color: string
}
