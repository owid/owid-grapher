import { describe, expect, it } from "vitest"

import { INTERNATIONAL_DOLLAR } from "./constants.js"
import {
    combinedFactor,
    currencyKey,
    formatCurrencyLabel,
    formatIncome,
    formatPeople,
    formatShare,
    isInternationalPovertyLine,
    povertyLineMode,
    resolveCurrency,
    roundIncomeAsDisplayed,
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

describe(isInternationalPovertyLine, () => {
    it("matches the line at $3 a day", () => {
        expect(
            isInternationalPovertyLine(3, INTERNATIONAL_DOLLAR, "daily")
        ).toBe(true)
        expect(
            isInternationalPovertyLine(3.2, INTERNATIONAL_DOLLAR, "daily")
        ).toBe(false)
    })

    it("counts a line that reads as $3 a day in the current units", () => {
        // A line dragged to $90.94 a month still reads as "$91", as $3 a day does
        expect(
            isInternationalPovertyLine(2.99, INTERNATIONAL_DOLLAR, "monthly")
        ).toBe(true)
        // $3.02 a day is $92 a month, which isn't
        expect(
            isInternationalPovertyLine(3.02, INTERNATIONAL_DOLLAR, "monthly")
        ).toBe(false)
    })

    it("compares in the displayed currency", () => {
        // €1.50 a day at 0.5 EUR per int-$, however the int-$ amount rounds
        expect(isInternationalPovertyLine(3.05, EURO, "daily")).toBe(true)
        expect(isInternationalPovertyLine(3.2, EURO, "daily")).toBe(false)
    })
})

describe(povertyLineMode, () => {
    it("is off without a line, else international or custom", () => {
        expect(povertyLineMode(null, INTERNATIONAL_DOLLAR, "daily")).toBe("off")
        expect(povertyLineMode(3, INTERNATIONAL_DOLLAR, "daily")).toBe(
            "international"
        )
        expect(povertyLineMode(12, INTERNATIONAL_DOLLAR, "daily")).toBe(
            "custom"
        )
    })
})

describe(roundIncomeAsDisplayed, () => {
    it("returns the daily int-$ value behind the two significant figures shown", () => {
        expect(
            roundIncomeAsDisplayed(12.37, INTERNATIONAL_DOLLAR, "daily")
        ).toBe(12)
        expect(
            roundIncomeAsDisplayed(3.246, INTERNATIONAL_DOLLAR, "daily")
        ).toBeCloseTo(3.2)
    })

    it("rounds in the chart's units, then converts back", () => {
        // $3.00 a day is $91.25 a month, shown as $91
        const monthly = roundIncomeAsDisplayed(
            3,
            INTERNATIONAL_DOLLAR,
            "monthly"
        )
        expect(monthly * (365 / 12)).toBeCloseTo(91)
        expect(monthly).toBeCloseTo(91 / (365 / 12))
    })
})

describe(formatPeople, () => {
    it.each([
        [3_712_000_000, "3.7 billion"],
        [999_600_000, "1 billion"],
        [567_000_000, "570 million"],
        [4_870_000, "4.9 million"],
        [849_000, "850,000"],
        [1234, "1,200"],
        [0, "0"],
    ])("formats %d as %s", (count, expected) => {
        expect(formatPeople(count)).toBe(expected)
    })
})
