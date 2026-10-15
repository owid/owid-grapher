import { QueryClient, QueryStatus, useQuery } from "@tanstack/react-query"
import * as R from "remeda"

import { fetchJson } from "@ourworldindata/utils"
import type { BespokeMetadata } from "@ourworldindata/types"

import { parseBespokeMetadata } from "../../../../components/MetadataModal/bespokeMetadata.js"
import { CURRENCY_CONVERSIONS_URL } from "./constants.js"
import {
    REGIONS,
    type CountryDistribution,
    type Currency,
    type IncomeDistributionYear,
    type RawCountryDistribution,
    type RawCurrencyConversion,
    type RawIncomeDistributionYear,
    type Region,
} from "./types.js"

export const queryClient = new QueryClient()

/** Number of equally-populated bins the ETL splits every country into */
const NUM_BINS = 1000

const FALLBACK_SOURCE = "World Bank Poverty and Inequality Platform"

export interface IncomeDistributionMetadata {
    /** Validated metadata for the methods-and-sources modal; undefined when the file fails the schema */
    bespokeMetadata?: BespokeMetadata
    /** Attribution line for the chart footer, e.g. "Lakner et al. (2022) (updated using World Bank PIP in September 2026)" */
    source: string
}

/** Fetches `<metadataUrl>` once; query key ["income-distribution", "metadata"] */
export function useIncomeDistributionMetadata(metadataUrl: string): {
    data?: IncomeDistributionMetadata
    status: QueryStatus
} {
    const result = useQuery({
        queryKey: ["income-distribution", "metadata"],
        queryFn: async (): Promise<IncomeDistributionMetadata> => {
            const raw = await fetchJson<unknown>(metadataUrl)
            return parseIncomeDistributionMetadata(raw)
        },
        staleTime: Infinity, // The data files are immutable within a session
    })

    return { data: result.data, status: result.status }
}

/**
 * The footer source is read from the raw file rather than the validated one,
 * so the chart keeps its attribution even when the modal can't be shown
 */
export function parseIncomeDistributionMetadata(
    raw: unknown
): IncomeDistributionMetadata {
    const loose = (R.isPlainObject(raw) ? raw : {}) as Partial<BespokeMetadata>
    const firstOrigin = loose.origins?.[0]
    const source =
        nonEmptyString(loose.attribution) ??
        nonEmptyString(firstOrigin?.attribution) ??
        nonEmptyString(firstOrigin?.producer) ??
        FALLBACK_SOURCE

    return { bespokeMetadata: parseBespokeMetadata(raw), source }
}

/**
 * Fetches `<dataUrl>/income-distribution.<year>.json`, parsed with
 * `parseIncomeDistributionYear`. Keeps the previous year's data as
 * placeholder while a new year loads; staleTime Infinity.
 */
export function useIncomeDistributionYear(
    year: number,
    dataUrl: string
): {
    data?: IncomeDistributionYear
    status: QueryStatus
    isPlaceholderData: boolean
} {
    const result = useQuery({
        queryKey: ["income-distribution", "year", year],
        queryFn: async (): Promise<IncomeDistributionYear> => {
            const raw = await fetchJson<RawIncomeDistributionYear>(
                `${dataUrl}/income-distribution.${year}.json`
            )
            return parseIncomeDistributionYear(raw)
        },
        placeholderData: (previousData) => previousData,
        staleTime: Infinity,
    })

    return {
        data: result.data,
        status: result.status,
        isPlaceholderData: result.isPlaceholderData,
    }
}

/**
 * Validates the feed file and reshapes it: every country must carry exactly
 * 1000 non-negative, ascending avgs and a known region, else this throws so
 * the chart lands in its error state rather than drawing garbage.
 */
export function parseIncomeDistributionYear(
    raw: RawIncomeDistributionYear
): IncomeDistributionYear {
    if (
        !R.isPlainObject(raw) ||
        !Number.isFinite(raw.year) ||
        !R.isPlainObject(raw.data)
    )
        throw new Error(
            "[income-distribution] Data file is missing its year or data"
        )

    const countries = Object.entries(raw.data)
        .map(([name, entry]) => parseCountry(name, entry))
        .sort((a, b) => a.name.localeCompare(b.name, "en"))

    return {
        year: raw.year,
        countries,
        byName: new Map(countries.map((country) => [country.name, country])),
    }
}

/**
 * The ETL clamps and monotonises the bin means, so a violation here means
 * the file itself is broken
 */
function parseCountry(
    name: string,
    entry: RawCountryDistribution
): CountryDistribution {
    const fail = (problem: string): never => {
        throw new Error(`[income-distribution] ${name}: ${problem}`)
    }

    if (!R.isPlainObject(entry)) fail("missing its record")
    if (!isRegion(entry.region)) fail(`unknown region "${entry.region}"`)
    if (!Number.isFinite(entry.totalPopulation) || entry.totalPopulation <= 0)
        fail("population is not a positive number")

    const { avgs } = entry
    if (!Array.isArray(avgs) || avgs.length !== NUM_BINS)
        fail(`expected ${NUM_BINS} bin means`)
    for (let i = 0; i < avgs.length; i++) {
        const value = avgs[i]
        if (!Number.isFinite(value) || value < 0)
            fail(`bin mean ${i} is not a non-negative number`)
        if (i > 0 && value < avgs[i - 1])
            fail(`bin means are not ascending at bin ${i}`)
    }

    return {
        name,
        region: entry.region as Region,
        population: entry.totalPopulation,
        avgs,
    }
}

function isRegion(value: unknown): value is Region {
    return (REGIONS as readonly unknown[]).includes(value)
}

/** Fetches CURRENCY_CONVERSIONS_URL once; query key ["income-distribution", "currencies"] */
export function useCurrencyConversions(): {
    data?: Currency[]
    status: QueryStatus
} {
    const result = useQuery({
        queryKey: ["income-distribution", "currencies"],
        queryFn: async (): Promise<Currency[]> => {
            const raw = await fetchJson<RawCurrencyConversion[]>(
                CURRENCY_CONVERSIONS_URL
            )
            return parseCurrencyConversions(raw)
        },
        staleTime: Infinity,
    })

    return { data: result.data, status: result.status }
}

/**
 * Drops rows without a currency code or a finite positive factor, maps the
 * rest to `Currency` and sorts them by country name. Does not include the
 * international dollar.
 */
export function parseCurrencyConversions(
    raw: RawCurrencyConversion[]
): Currency[] {
    if (!Array.isArray(raw))
        throw new Error(
            "[income-distribution] Currency conversions are not a list"
        )

    const currencies = raw
        .filter(
            (row) =>
                !!row.currency_code &&
                Number.isFinite(row.conversion_factor) &&
                row.conversion_factor > 0
        )
        .map((row): Currency => ({
            code: row.currency_code,
            name: row.currency_name,
            factor: row.conversion_factor,
            countryName: row.country,
            countryCode: row.country_code,
        }))
    return currencies.sort((a, b) =>
        (a.countryName ?? "").localeCompare(b.countryName ?? "", "en")
    )
}

function nonEmptyString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim() ? value : undefined
}
