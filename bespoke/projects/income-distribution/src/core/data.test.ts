import { describe, expect, it } from "vitest"

import {
    parseCurrencyConversions,
    parseIncomeDistributionMetadata,
    parseIncomeDistributionYear,
} from "./data.js"
import type { RawIncomeDistributionYear } from "./types.js"
import { conversionRow, RAW_YEAR, syntheticAvgs } from "./testFixtures.js"

/** RAW_YEAR with one country's record replaced */
function withPoorland(
    overrides: Record<string, unknown>
): RawIncomeDistributionYear {
    return {
        ...RAW_YEAR,
        data: {
            ...RAW_YEAR.data,
            Poorland: { ...RAW_YEAR.data.Poorland, ...overrides },
        },
    }
}

describe(parseIncomeDistributionYear, () => {
    it("sorts countries by name and indexes them by name", () => {
        const year = parseIncomeDistributionYear(RAW_YEAR)
        expect(year.year).toBe(2025)
        expect(year.countries.map((c) => c.name)).toEqual([
            "Middleland",
            "Poorland",
            "Richland",
        ])
        expect(year.byName.get("Poorland")).toMatchObject({
            region: "Sub-Saharan Africa",
            population: 100,
        })
    })

    it("accepts zero incomes in the poorest bins", () => {
        const avgs = [0, 0, ...syntheticAvgs(2).slice(2)]
        expect(() =>
            parseIncomeDistributionYear(withPoorland({ avgs }))
        ).not.toThrow()
    })

    it.each([
        ["too few bins", { avgs: syntheticAvgs(2).slice(1) }],
        ["a negative bin mean", { avgs: [-1, ...syntheticAvgs(2).slice(1)] }],
        ["descending bin means", { avgs: syntheticAvgs(2).toReversed() }],
        [
            "a non-finite bin mean",
            { avgs: [NaN, ...syntheticAvgs(2).slice(1)] },
        ],
        ["an unknown region", { region: "Atlantis" }],
        ["a zero population", { totalPopulation: 0 }],
    ])("rejects a country with %s", (_, overrides) => {
        expect(() =>
            parseIncomeDistributionYear(withPoorland(overrides))
        ).toThrow(/^\[income-distribution\] Poorland/)
    })

    it("rejects a file without data", () => {
        expect(() =>
            parseIncomeDistributionYear({
                year: 2025,
            } as RawIncomeDistributionYear)
        ).toThrow("[income-distribution]")
    })
})

describe(parseCurrencyConversions, () => {
    it("keeps usable rows as currencies sorted by country", () => {
        const currencies = parseCurrencyConversions([
            conversionRow({}),
            conversionRow({
                country: "Albania",
                country_code: "ALB",
                currency_code: "ALL",
                currency_name: "Lek",
                conversion_factor: 59.268,
            }),
        ])
        expect(currencies).toEqual([
            {
                code: "ALL",
                name: "Lek",
                factor: 59.268,
                countryName: "Albania",
                countryCode: "ALB",
            },
            {
                code: "EUR",
                name: "Euro",
                factor: 0.85,
                countryName: "Germany",
                countryCode: "DEU",
            },
        ])
    })

    it("drops rows without a currency code or a positive factor", () => {
        const currencies = parseCurrencyConversions([
            conversionRow({ country: "No code", currency_code: "" }),
            conversionRow({ country: "Zero", conversion_factor: 0 }),
            conversionRow({ country: "NaN", conversion_factor: NaN }),
            conversionRow({ country: "Kept" }),
        ])
        expect(currencies.map((c) => c.countryName)).toEqual(["Kept"])
    })
})

describe(parseIncomeDistributionMetadata, () => {
    it("takes the source from the file's attribution", () => {
        const metadata = parseIncomeDistributionMetadata({
            title: "Income distribution",
            attribution: "Lakner et al. (2022)",
            origins: [{ producer: "World Bank", attribution: "PIP" }],
        })
        expect(metadata.source).toBe("Lakner et al. (2022)")
    })

    it("falls back to the first origin's attribution, then its producer", () => {
        expect(
            parseIncomeDistributionMetadata({
                origins: [{ producer: "World Bank", attribution: "PIP" }],
            }).source
        ).toBe("PIP")
        expect(
            parseIncomeDistributionMetadata({
                origins: [{ producer: "World Bank" }],
            }).source
        ).toBe("World Bank")
    })

    it("still names a source when the file is unusable", () => {
        const metadata = parseIncomeDistributionMetadata("not json")
        expect(metadata.source).toBe(
            "World Bank Poverty and Inequality Platform"
        )
        expect(metadata.bespokeMetadata).toBeUndefined()
    })
})
