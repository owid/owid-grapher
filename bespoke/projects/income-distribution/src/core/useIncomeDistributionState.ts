import { useCallback, useMemo } from "react"
import * as R from "remeda"
import {
    parseAsArrayOf,
    parseAsFloat,
    parseAsString,
    parseAsStringEnum,
} from "nuqs"
import type { QueryStatus } from "@tanstack/react-query"

import { useUrlState } from "../../../../hooks/useUrlState.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { combineStatuses } from "../../../../helpers/queryStatus.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

import type { IncomeDistributionConfig } from "../index.js"
import {
    DEFAULT_COUNTRIES,
    INTERNATIONAL_DOLLAR,
    MAX_SELECTED_COUNTRIES,
    USER_LOCATION_SENTINEL,
} from "./constants.js"
import {
    IncomeDistributionMetadata,
    useCurrencyConversions,
    useIncomeDistributionMetadata,
    useIncomeDistributionYear,
} from "./data.js"
import { resolveCurrency } from "./currency.js"
import {
    Currency,
    IncomeDistributionYear,
    TIME_INTERVALS,
    TimeInterval,
    VIEWS,
    View,
} from "./types.js"

/** Stands in for the currency list when it failed to load; stable for memo deps */
const NO_CURRENCIES: Currency[] = []

/**
 * What the chart shows, as the reader set it: the inputs the frame and the
 * controls take. A walkthrough applies its slides on top of this.
 */
export interface ChartState {
    view: View
    /** Resolved and filtered to countries in the data */
    selectedCountries: string[]
    /** Int-$/day; null when unset */
    povertyLine: number | null
    timeInterval: TimeInterval
    currency: Currency
}

export interface ChartStateSetters {
    setView: (view: View) => void
    setSelectedCountries: (names: string[]) => void
    setPovertyLine: (line: number | null) => void
    setTimeInterval: (interval: TimeInterval) => void
    /** Takes a currency key (see currencyKey in currency.ts) */
    setCurrency: (key: string) => void
}

export interface IncomeDistributionState {
    /** Combined status of the metadata and the year's data */
    status: QueryStatus
    metadata?: IncomeDistributionMetadata
    yearData?: IncomeDistributionYear
    /** A new year is loading behind the old chart (delayed, see useDelayedLoading) */
    isLoading: boolean
    chartState: ChartState
    setters: ChartStateSetters
    /** Undefined while loading; empty when the conversions failed to load */
    currencies: Currency[] | undefined
    /** The reader's local currency, if known */
    suggestedCurrency: Currency | undefined
}

/**
 * The chart's URL state (unprefixed keys `view`, `countries`, `povertyLine`,
 * `timeInterval`, `currency`, defaulting to the config), the data queries,
 * and the state resolved against the data: the selection's "userLocation"
 * sentinel and the currency key. Shared by every variant.
 */
export function useIncomeDistributionState(
    config: IncomeDistributionConfig,
    urls: BespokeComponentDataUrls
): IncomeDistributionState {
    const [view, setView] = useUrlState({
        key: "view",
        parser: parseAsStringEnum<View>([...VIEWS]),
        defaultValue: config.view,
    })
    // May hold the "userLocation" sentinel until the user edits the
    // selection; it's resolved below
    const [countries, setCountries] = useUrlState({
        key: "countries",
        parser: parseAsArrayOf(parseAsString),
        defaultValue: config.countries ?? DEFAULT_COUNTRIES,
    })
    // 0 stands for "no custom poverty line": URL state needs a non-null default
    const [rawPovertyLine, setRawPovertyLine] = useUrlState({
        key: "povertyLine",
        parser: parseAsFloat,
        defaultValue: config.povertyLine ?? 0,
    })
    const [timeInterval, setTimeInterval] = useUrlState({
        key: "timeInterval",
        parser: parseAsStringEnum<TimeInterval>([...TIME_INTERVALS]),
        defaultValue: config.timeInterval,
    })
    // A country code (see currencyKey), INTERNATIONAL_DOLLAR.code or the
    // "userLocation" sentinel
    const [currencyKey, setCurrencyKey] = useUrlState({
        key: "currency",
        parser: parseAsString,
        defaultValue: config.currency ?? INTERNATIONAL_DOLLAR.code,
    })

    const { data: metadata, status: metadataStatus } =
        useIncomeDistributionMetadata(urls.metadataUrl)
    const {
        data: yearData,
        status: yearStatus,
        isPlaceholderData,
    } = useIncomeDistributionYear(config.year, urls.dataUrl)
    // A failure here only costs the currency dropdown its local currencies
    const { data: loadedCurrencies, status: currenciesStatus } =
        useCurrencyConversions()
    // An empty list rather than undefined, so the dropdown stops loading
    const currencies =
        currenciesStatus === "error" ? NO_CURRENCIES : loadedCurrencies
    const { data: userCountryInfo } = useUserCountryInformation()

    const status = combineStatuses(metadataStatus, yearStatus)
    const isLoading = useDelayedLoading(isPlaceholderData)

    const povertyLine =
        Number.isFinite(rawPovertyLine) && rawPovertyLine > 0
            ? rawPovertyLine
            : null
    const setPovertyLine = useCallback(
        (line: number | null) => setRawPovertyLine(line ?? 0),
        [setRawPovertyLine]
    )

    // The user's own currency: the conversion row of the country they're in
    const suggestedCurrency = useMemo(
        () =>
            userCountryInfo
                ? currencies?.find(
                      (c) => c.countryCode === userCountryInfo.code
                  )
                : undefined,
        [currencies, userCountryInfo]
    )
    const currency =
        currencyKey === USER_LOCATION_SENTINEL
            ? (suggestedCurrency ?? INTERNATIONAL_DOLLAR)
            : resolveCurrency(currencyKey, currencies)

    // Resolve the sentinel and drop names the data doesn't have; the state
    // keeps them so a shared link survives a data update
    const selectedCountries = useMemo(() => {
        if (!yearData) return []
        return R.pipe(
            countries,
            R.flatMap((name) =>
                name === USER_LOCATION_SENTINEL
                    ? userCountryInfo
                        ? [userCountryInfo.name]
                        : []
                    : [name]
            ),
            R.filter((name) => yearData.byName.has(name)),
            R.unique(),
            R.take(MAX_SELECTED_COUNTRIES)
        )
    }, [countries, userCountryInfo, yearData])

    const chartState = useMemo(
        (): ChartState => ({
            view,
            selectedCountries,
            povertyLine,
            timeInterval,
            currency,
        }),
        [view, selectedCountries, povertyLine, timeInterval, currency]
    )
    const setters = useMemo(
        (): ChartStateSetters => ({
            setView,
            setSelectedCountries: setCountries,
            setPovertyLine,
            setTimeInterval,
            setCurrency: setCurrencyKey,
        }),
        [setView, setCountries, setPovertyLine, setTimeInterval, setCurrencyKey]
    )

    return {
        status,
        metadata,
        yearData,
        isLoading,
        chartState,
        setters,
        currencies,
        suggestedCurrency,
    }
}
