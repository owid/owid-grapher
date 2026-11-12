import { roundSigFig } from "@ourworldindata/utils"

import {
    INT_POVERTY_LINE,
    INTERNATIONAL_DOLLAR,
    TIME_INTERVAL_FACTORS,
} from "./constants.js"
import type { Currency, PovertyLineMode, TimeInterval } from "./types.js"

/** Multiplier taking a daily international-$ amount to `currency` per `interval` */
export function combinedFactor(
    currency: Currency,
    interval: TimeInterval
): number {
    return currency.factor * TIME_INTERVAL_FACTORS[interval]
}

/**
 * Formats a daily international-$ amount in `currency` per `interval`, e.g.
 * "$3", "$3.20", "$1.2k", "€950", "₹10k", "¥1.5M". Two significant figures
 * are enough for an axis or a poverty line; `short` drops trailing zeros and
 * cents for whole amounts (axis ticks). Uses Intl.NumberFormat for real
 * currencies (en-US locale) and a plain "$" prefix for the international
 * dollar.
 */
/**
 * The amount `formatIncome` shows for a daily international-$ figure, in the
 * chart's units: two significant figures, so e.g. 999.7 becomes 1k
 */
function displayedAmount(
    dailyIntDollars: number,
    currency: Currency,
    interval: TimeInterval
): number {
    return roundSigFig(dailyIntDollars * combinedFactor(currency, interval), 2)
}

/**
 * The daily international-$ value behind what `formatIncome` shows, so a
 * share computed from it matches the amount on screen: a line dragged to
 * $12.37 reads "$12", and 12 is what the share is taken against.
 */
export function roundIncomeAsDisplayed(
    dailyIntDollars: number,
    currency: Currency,
    interval: TimeInterval
): number {
    return (
        displayedAmount(dailyIntDollars, currency, interval) /
        combinedFactor(currency, interval)
    )
}

export function formatIncome(
    dailyIntDollars: number,
    currency: Currency,
    interval: TimeInterval,
    options: { short?: boolean } = {}
): string {
    const amount = displayedAmount(dailyIntDollars, currency, interval)
    // Below 10, show cents ("$3.20"), unless a short label can do without
    const fractionDigits =
        amount >= 10 || (options.short && Number.isInteger(amount)) ? 0 : 2

    if (currency.code === INTERNATIONAL_DOLLAR.code)
        return "$" + formatPlainAmount(amount, fractionDigits)

    const formatter = getCurrencyFormatter(currency.code, fractionDigits)
    if (!formatter)
        return `${currency.code} ${formatPlainAmount(amount, fractionDigits)}`
    // Match the lower-case "k" of the international-$ labels
    return formatter.format(amount).replace("K", "k")
}

/** "1.2k", "15M", "950", "3.20" */
function formatPlainAmount(amount: number, fractionDigits: number): string {
    if (amount >= 1e9) return `${roundSigFig(amount / 1e9, 2)}B`
    if (amount >= 1e6) return `${roundSigFig(amount / 1e6, 2)}M`
    if (amount >= 1e3) return `${roundSigFig(amount / 1e3, 2)}k`
    return amount.toFixed(fractionDigits)
}

/** Undefined marks a currency code Intl rejects, so we only try it once */
const formatterCache = new Map<string, Intl.NumberFormat | undefined>()

function getCurrencyFormatter(
    code: string,
    fractionDigits: number
): Intl.NumberFormat | undefined {
    const cacheKey = `${code}:${fractionDigits}`
    if (formatterCache.has(cacheKey)) return formatterCache.get(cacheKey)

    let formatter: Intl.NumberFormat | undefined
    try {
        formatter = new Intl.NumberFormat(
            "en-US",
            fractionDigits > 0
                ? {
                      style: "currency",
                      currency: code,
                      minimumFractionDigits: fractionDigits,
                      maximumFractionDigits: fractionDigits,
                  }
                : {
                      style: "currency",
                      currency: code,
                      notation: "compact",
                      maximumSignificantDigits: 2,
                  }
        )
    } catch {
        formatter = undefined
    }
    formatterCache.set(cacheKey, formatter)
    return formatter
}

const TIME_INTERVAL_NOUNS: Record<TimeInterval, string> = {
    daily: "day",
    monthly: "month",
    yearly: "year",
}

/** "day" | "month" | "year", for sentences like "less than $3 a day" */
export function timeIntervalNoun(interval: TimeInterval): string {
    return TIME_INTERVAL_NOUNS[interval]
}

/** "12%", "0.4%", "<0.1%", "100%" from a 0–1 share */
export function formatShare(share: number): string {
    const percent = share * 100
    if (percent <= 0) return "0%"
    if (percent < 0.05) return "<0.1%"
    if (percent < 1) {
        // 0.96% would round to "1.0%"; drop the redundant decimal
        const rounded = Math.round(percent * 10) / 10
        return rounded >= 1 ? "1%" : `${rounded}%`
    }
    if (percent >= 100) return "100%"
    // Don't claim everyone when a few are left out
    const rounded = Math.round(percent)
    return rounded >= 100 ? ">99%" : `${rounded}%`
}

/**
 * A number of people to two significant figures: "3.7 billion",
 * "570 million", "4.9 million", "850,000"
 */
export function formatPeople(count: number): string {
    const rounded = roundSigFig(count, 2)
    if (rounded >= 1e9) return `${roundSigFig(rounded / 1e9, 2)} billion`
    if (rounded >= 1e6) return `${roundSigFig(rounded / 1e6, 2)} million`
    return Math.round(rounded).toLocaleString("en-US")
}

/** Label for a currency in a dropdown or sentence: "International-$" or "Euro (Germany)" */
export function formatCurrencyLabel(currency: Currency): string {
    if (currency.code === INTERNATIONAL_DOLLAR.code) return "International-$"
    return currency.countryName
        ? `${currency.name} (${currency.countryName})`
        : currency.name
}

/**
 * The key a currency selection is stored under: the ISO 3166-1 alpha-3 code
 * of the country whose conversion it is (countries sharing a currency have
 * different PPP factors), or INTERNATIONAL_DOLLAR.code
 */
export function currencyKey(currency: Currency): string {
    return currency.countryCode ?? INTERNATIONAL_DOLLAR.code
}

/** The conversion row stored under `key`; unknown keys fall back to the international dollar */
export function resolveCurrency(
    key: string,
    currencies: Currency[] | undefined
): Currency {
    return (
        currencies?.find((c) => c.countryCode === key) ?? INTERNATIONAL_DOLLAR
    )
}

/**
 * Whether a poverty line reads as the international poverty line in the
 * current units, e.g. a line dragged to "$91" a month in international-$.
 * Compares what the reader sees, so a line a fraction off still counts.
 */
export function isInternationalPovertyLine(
    line: number,
    currency: Currency,
    interval: TimeInterval
): boolean {
    return (
        formatIncome(line, currency, interval) ===
        formatIncome(INT_POVERTY_LINE, currency, interval)
    )
}

/** What the poverty line control shows for `line`: it isn't stored, but read off the line */
export function povertyLineMode(
    line: number | null,
    currency: Currency,
    interval: TimeInterval
): PovertyLineMode {
    if (line === null) return "off"
    return isInternationalPovertyLine(line, currency, interval)
        ? "international"
        : "custom"
}
