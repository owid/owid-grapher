import { describe, expect, it } from "vitest"

import { INTERNATIONAL_DOLLAR } from "./constants.js"
import {
    combinedFactor,
    currencyKey,
    formatCurrencyLabel,
    formatIncome,
    formatShare,
    resolveCurrency,
    timeIntervalNoun,
} from "./currency.js"
import type { Currency } from "./types.js"

const EURO: Currency = {
    code: "EUR",
    name: "Euro",
    factor: 0.5,
    countryName: "Germany",
    countryCode: "DEU",
}

/** A conversion of 1, so the formatted amounts are the daily int-$ ones */
const atPar = (code: string): Currency => ({ code, name: code, factor: 1 })

describe(combinedFactor, () => {
    it("combines the exchange factor with the time interval", () => {
        expect(combinedFactor(EURO, "daily")).toBe(0.5)
        expect(combinedFactor(EURO, "yearly")).toBe(0.5 * 365)
        expect(combinedFactor(INTERNATIONAL_DOLLAR, "monthly")).toBeCloseTo(
            365 / 12
        )
    })
})

describe(formatIncome, () => {
    const intDollars = (value: number, short?: boolean): string =>
        formatIncome(value, INTERNATIONAL_DOLLAR, "daily", { short })

    it("shows international dollars with two significant figures", () => {
        expect(intDollars(3)).toBe("$3.00")
        expect(intDollars(3.2)).toBe("$3.20")
        expect(intDollars(0.25)).toBe("$0.25")
        expect(intDollars(15.4)).toBe("$15")
        expect(intDollars(954)).toBe("$950")
        expect(intDollars(1234)).toBe("$1.2k")
        expect(intDollars(15_300_000)).toBe("$15M")
    })

    it("drops the cents of whole amounts in short labels", () => {
        expect(intDollars(3, true)).toBe("$3")
        expect(intDollars(3.2, true)).toBe("$3.20")
    })

    it("rounds before picking a unit, so 999.7 is 1k", () => {
        expect(intDollars(999.7)).toBe("$1k")
    })

    it("converts to the currency and interval", () => {
        // $10 a day at 0.5 EUR per int-$ is 5 EUR a day, 1825 EUR a year
        expect(formatIncome(10, EURO, "daily")).toBe("€5.00")
        expect(formatIncome(10, EURO, "yearly")).toBe("€1.8k")
    })

    it("uses each currency's symbol and lower-case k", () => {
        expect(formatIncome(950, atPar("EUR"), "daily")).toBe("€950")
        expect(formatIncome(10_000, atPar("INR"), "daily")).toBe("₹10k")
        expect(formatIncome(1_500_000, atPar("JPY"), "daily")).toBe("¥1.5M")
    })

    it("falls back to the code for a currency Intl rejects", () => {
        expect(formatIncome(1234, atPar("not-a-code"), "daily")).toBe(
            "not-a-code 1.2k"
        )
    })
})

describe(timeIntervalNoun, () => {
    it("names the interval for a sentence", () => {
        expect(timeIntervalNoun("daily")).toBe("day")
        expect(timeIntervalNoun("monthly")).toBe("month")
        expect(timeIntervalNoun("yearly")).toBe("year")
    })
})

describe(formatShare, () => {
    it.each([
        [0.123, "12%"],
        [0.004, "0.4%"],
        [0.0004, "<0.1%"],
        [0.0096, "1%"],
        [0, "0%"],
        [1, "100%"],
        [0.998, ">99%"],
    ])("formats %f as %s", (share, expected) => {
        expect(formatShare(share)).toBe(expected)
    })
})

describe(formatCurrencyLabel, () => {
    it("names the international dollar and real currencies by country", () => {
        expect(formatCurrencyLabel(INTERNATIONAL_DOLLAR)).toBe(
            "International-$"
        )
        expect(formatCurrencyLabel(EURO)).toBe("Euro (Germany)")
    })
})

describe(resolveCurrency, () => {
    it("round-trips a currency through its key", () => {
        expect(resolveCurrency(currencyKey(EURO), [EURO])).toBe(EURO)
        expect(currencyKey(INTERNATIONAL_DOLLAR)).toBe(
            INTERNATIONAL_DOLLAR.code
        )
    })

    it("falls back to the international dollar for unknown keys or a missing list", () => {
        expect(resolveCurrency("XYZ", [EURO])).toBe(INTERNATIONAL_DOLLAR)
        expect(resolveCurrency("DEU", undefined)).toBe(INTERNATIONAL_DOLLAR)
    })
})
