import { roundSigFig } from "@ourworldindata/utils"

import { INTERNATIONAL_DOLLAR, TIME_INTERVAL_FACTORS } from "./constants.js"
import type { Currency, TimeInterval } from "./types.js"

/** Multiplier taking a daily international-$ amount to `currency` per `interval` */
export function combinedFactor(
    currency: Currency,
    interval: TimeInterval
): number {
    return currency.factor * TIME_INTERVAL_FACTORS[interval]
}

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

/**
 * Formats a daily international-$ amount in `currency` per `interval`, e.g.
 * "$3", "$3.20", "$1.2k", "€950", "₹10k", "¥1.5M". Two significant figures
 * are enough for an axis or a poverty line; `short` drops trailing zeros and
 * cents for whole amounts (axis ticks). Uses Intl.NumberFormat for real
 * currencies (en-US locale) and a plain "$" prefix for the international
 * dollar. A currency en-US only knows by its code (SEK, ZAR, PLN) gets its
 * narrow symbol instead ("kr", "R", "zł"); where there is none either, the
 * code stays (CHF), unless `dropCode` asks for the bare number, for axis
 * ticks whose neighbour or axis names the currency.
 */
export function formatIncome(
    dailyIntDollars: number,
    currency: Currency,
    interval: TimeInterval,
    options: { short?: boolean; dropCode?: boolean } = {}
): string {
    const amount = displayedAmount(dailyIntDollars, currency, interval)
    // Below 10, show cents ("$3.20"), unless a short label can do without
    const fractionDigits =
        amount >= 10 || (options.short && Number.isInteger(amount)) ? 0 : 2

    if (currency.code === INTERNATIONAL_DOLLAR.code)
        return "$" + formatPlainAmount(amount, fractionDigits)

    const formatter = getCurrencyFormatter(currency.code, fractionDigits)
    if (!formatter) {
        const plain = formatPlainAmount(amount, fractionDigits)
        return options.dropCode ? plain : `${currency.code} ${plain}`
    }
    const dropCode =
        options.dropCode && isWrittenAsCode(formatter, currency.code)
    const text = formatter
        .formatToParts(amount)
        .filter(
            (part) =>
                !dropCode ||
                (part.type !== "currency" && part.type !== "literal")
        )
        .map((part) =>
            // Symbols that would read as another currency's: en-US writes
            // US dollars as "$", which is the international dollar's sign here
            part.type === "currency"
                ? (SYMBOL_OVERRIDES[currency.code] ?? part.value)
                : part.value
        )
        .join("")
    // Match the lower-case "k" of the international-$ labels: only the
    // compact suffix after the digits, not a "K" in a currency code (CHF)
    return text.replace(/(\d)K\b/, "$1k")
}

/**
 * Whether amounts in `currency` are written with its code rather than a
 * symbol ("CHF 1k"), because en-US has neither a symbol nor a narrow one
 */
export function isCurrencyWrittenAsCode(currency: Currency): boolean {
    if (currency.code === INTERNATIONAL_DOLLAR.code) return false
    const formatter = getCurrencyFormatter(currency.code, 0)
    return !formatter || isWrittenAsCode(formatter, currency.code)
}

function isWrittenAsCode(formatter: Intl.NumberFormat, code: string): boolean {
    return formatter
        .formatToParts(1)
        .some((part) => part.type === "currency" && part.value === code)
}

/** "1.2k", "15M", "950", "3.20" */
function formatPlainAmount(amount: number, fractionDigits: number): string {
    if (amount >= 1e9) return `${roundSigFig(amount / 1e9, 2)}B`
    if (amount >= 1e6) return `${roundSigFig(amount / 1e6, 2)}M`
    if (amount >= 1e3) return `${roundSigFig(amount / 1e3, 2)}k`
    return amount.toFixed(fractionDigits)
}

const SYMBOL_OVERRIDES: Record<string, string> = { USD: "US$" }

/** Undefined marks a currency code Intl rejects, so we only try it once */
const formatterCache = new Map<string, Intl.NumberFormat | undefined>()

/**
 * en-US writes many currencies as their code ("SEK 1K"); their narrow symbol
 * ("kr 1K") reads better next to "$" and "€". Where there is no narrow
 * symbol either, Intl falls back to the code again, which is fine.
 */
function getCurrencyFormatter(
    code: string,
    fractionDigits: number
): Intl.NumberFormat | undefined {
    const cacheKey = `${code}:${fractionDigits}`
    if (formatterCache.has(cacheKey)) return formatterCache.get(cacheKey)

    const make = (
        currencyDisplay: "symbol" | "narrowSymbol"
    ): Intl.NumberFormat =>
        new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: code,
            currencyDisplay,
            ...(fractionDigits > 0
                ? {
                      minimumFractionDigits: fractionDigits,
                      maximumFractionDigits: fractionDigits,
                  }
                : { notation: "compact", maximumSignificantDigits: 2 }),
        })
    let formatter: Intl.NumberFormat | undefined
    try {
        formatter = make("symbol")
        if (isWrittenAsCode(formatter, code)) formatter = make("narrowSymbol")
    } catch {
        formatter = undefined
    }
    formatterCache.set(cacheKey, formatter)
    return formatter
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
