import { SeriesPoint } from "d3-shape"

export const INT_POVERTY_LINE = 3.0

export const AVAILABLE_YEARS_RANGE = [1990, 2025] as const
export const DEFAULT_YEAR = AVAILABLE_YEARS_RANGE[1]

export const TIME_INTERVALS = ["daily", "monthly", "yearly"] as const
export type TimeInterval = (typeof TIME_INTERVALS)[number]

export const TIME_INTERVAL_FACTORS = [1, 365 / 12, 365] as const

export const CURRENCIES = ["INTD", "USD", "EUR", "SEK"] as const
export type Currency = (typeof CURRENCIES)[number]
export const DEFAULT_CURRENCY: Currency = "INTD"

// This is fantasy data for demonstration purposes only
// Taken from https://en.wikipedia.org/wiki/International_dollar#Exchange_rate_by_country for now
export const CURRENCY_FACTORS: Record<Currency, number> = {
    INTD: 1,
    USD: 1,
    EUR: 0.72,
    SEK: 8.73,
}

export interface LegendEntry {
    name: string
    color: string
}

export type LegendEntries = LegendEntry[]

export const KDE_BANDWIDTH = 0.15
export const KDE_EXTENT = [0.25, 1000].map(Math.log2) as [number, number]
export const KDE_NUM_BINS = 200

export const PLOT_WIDTH = 1000
export const PLOT_HEIGHT = 500

export interface StackedSeriesPoint extends Array<SeriesPoint<number>> {
    key: string
    country?: string
    region: string
    color: string
}
