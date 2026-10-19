import { useCallback, useMemo, useState } from "react"
import cx from "clsx"
import * as R from "remeda"
import { QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import {
    parseAsArrayOf,
    parseAsFloat,
    parseAsString,
    parseAsStringEnum,
} from "nuqs"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { Spinner } from "../../../../components/Spinner/Spinner.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { formatEntityNameForSentence } from "../../../../helpers/entityNames.js"
import { combineStatuses } from "../../../../helpers/queryStatus.js"
import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

import { IncomeDistributionConfig } from "../core/config.js"
import {
    DEFAULT_COUNTRIES,
    DEFAULT_YEAR,
    FIRST_NOWCAST_YEAR,
    INTERNATIONAL_DOLLAR,
    NARROW_BREAKPOINT,
    USER_LOCATION_SENTINEL,
    WORLD_COLOR,
    WORLD_ENTITY_NAME,
} from "../core/constants.js"
import {
    IncomeDistributionMetadata,
    queryClient,
    useCurrencyConversions,
    useIncomeDistributionMetadata,
    useIncomeDistributionYear,
} from "../core/data.js"
import { buildChartModel } from "../core/chartModel.js"
import { shareBelowLineForEntities } from "../core/density.js"
import { resolveCurrency, timeIntervalNoun } from "../core/currency.js"
import {
    BREAKDOWNS,
    Breakdown,
    Currency,
    IncomeDistributionYear,
    TIME_INTERVALS,
    TimeInterval,
    VIEWS,
    View,
} from "../core/types.js"
import { IncomeDistributionControls } from "../components/IncomeDistributionControls.js"
import { IncomeDistributionChart } from "../components/IncomeDistributionChart.js"
import {
    IncomeDistributionLegend,
    LegendEntry,
} from "../components/IncomeDistributionLegend.js"

/** More selected countries than this and the title names only the first few */
const MAX_COUNTRIES_IN_TITLE = 4

/** Stands in for the currency list when it failed to load; stable for memo deps */
const NO_CURRENCIES: Currency[] = []

export function DistributionVariant({
    config,
    urls,
}: VariantProps<IncomeDistributionConfig>): React.ReactElement {
    return (
        <EmbedConfigProvider config={config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <FetchingDistributionVariant config={config} urls={urls} />
                </QueryClientProvider>
            </NuqsAdapter>
        </EmbedConfigProvider>
    )
}

function FetchingDistributionVariant({
    config,
    urls,
}: {
    config: IncomeDistributionConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const [view, setView] = useUrlState({
        key: "incomeDistributionView",
        parser: parseAsStringEnum<View>([...VIEWS]),
        defaultValue: config.view ?? "global",
    })
    const [breakdown, setBreakdown] = useUrlState({
        key: "incomeDistributionBreakdown",
        parser: parseAsStringEnum<Breakdown>([...BREAKDOWNS]),
        defaultValue: config.breakdown ?? "countries",
    })
    // May hold the "userLocation" sentinel until the reader edits the
    // selection; it's resolved where the list is rendered
    const [countries, setCountries] = useUrlState({
        key: "incomeDistributionCountries",
        parser: parseAsArrayOf(parseAsString),
        defaultValue: config.countries ?? DEFAULT_COUNTRIES,
    })
    // 0 stands for "no custom poverty line": URL state needs a non-null default
    const [rawPovertyLine, setRawPovertyLine] = useUrlState({
        key: "incomeDistributionPovertyLine",
        parser: parseAsFloat,
        defaultValue: config.povertyLine ?? 0,
    })
    const [timeInterval, setTimeInterval] = useUrlState({
        key: "incomeDistributionTimeInterval",
        parser: parseAsStringEnum<TimeInterval>([...TIME_INTERVALS]),
        defaultValue: config.timeInterval ?? "daily",
    })
    // A country code (see currencyKey), INTERNATIONAL_DOLLAR.code or the
    // "userLocation" sentinel
    const [currencyKey, setCurrencyKey] = useUrlState({
        key: "incomeDistributionCurrency",
        parser: parseAsString,
        defaultValue: config.currency ?? INTERNATIONAL_DOLLAR.code,
    })

    const { data: metadata, status: metadataStatus } =
        useIncomeDistributionMetadata(urls.metadataUrl)
    const {
        data: yearData,
        status: yearStatus,
        isPlaceholderData,
    } = useIncomeDistributionYear(config.year ?? DEFAULT_YEAR, urls.dataUrl)
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

    // The reader's own currency: the conversion row of the country they're in
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
            R.unique()
        )
    }, [countries, userCountryInfo, yearData])

    if (status === "pending")
        return <ChartSkeleton className="income-distribution-chart-box" />
    if (status === "error" || !metadata || !yearData)
        return <ChartError className="income-distribution-chart-box" />

    return (
        <CaptionedDistributionVariant
            config={config}
            metadata={metadata}
            yearData={yearData}
            view={view}
            breakdown={breakdown}
            selectedCountries={selectedCountries}
            povertyLine={povertyLine}
            timeInterval={timeInterval}
            currency={currency}
            currencies={currencies}
            suggestedCurrency={suggestedCurrency}
            isLoading={isLoading}
            setView={setView}
            setBreakdown={setBreakdown}
            setSelectedCountries={setCountries}
            setPovertyLine={setPovertyLine}
            setTimeInterval={setTimeInterval}
            setCurrency={setCurrencyKey}
        />
    )
}

function CaptionedDistributionVariant({
    config,
    metadata,
    yearData,
    view,
    breakdown,
    selectedCountries,
    povertyLine,
    timeInterval,
    currency,
    currencies,
    suggestedCurrency,
    isLoading,
    setView,
    setBreakdown,
    setSelectedCountries,
    setPovertyLine,
    setTimeInterval,
    setCurrency,
}: {
    config: IncomeDistributionConfig
    metadata: IncomeDistributionMetadata
    yearData: IncomeDistributionYear
    view: View
    breakdown: Breakdown
    /** Resolved and filtered to countries in the data */
    selectedCountries: string[]
    povertyLine: number | null
    timeInterval: TimeInterval
    currency: Currency
    currencies: Currency[] | undefined
    suggestedCurrency: Currency | undefined
    isLoading: boolean
    setView: (view: View) => void
    setBreakdown: (breakdown: Breakdown) => void
    setSelectedCountries: (names: string[]) => void
    setPovertyLine: (line: number | null) => void
    setTimeInterval: (interval: TimeInterval) => void
    setCurrency: (key: string) => void
}): React.ReactElement {
    const { width, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < NARROW_BREAKPOINT

    const [hoveredEntity, setHoveredEntity] = useState<string | null>(null)

    const year = yearData.year
    const availableCountries = useMemo(
        () => yearData.countries.map((country) => country.name),
        [yearData]
    )

    const model = useMemo(
        () =>
            buildChartModel({
                year: yearData,
                view,
                breakdown,
                selectedCountries,
            }),
        [yearData, view, breakdown, selectedCountries]
    )

    const legendEntries = useMemo<LegendEntry[]>(
        () =>
            povertyLine !== null
                ? [
                      ...model.legend,
                      { key: WORLD_ENTITY_NAME, color: WORLD_COLOR },
                  ]
                : model.legend,
        [model.legend, povertyLine]
    )

    const sharesBelowLine = useMemo(
        () =>
            povertyLine !== null
                ? shareBelowLineForEntities(
                      yearData,
                      povertyLine,
                      legendEntries.map((entry) => entry.key)
                  )
                : undefined,
        [yearData, povertyLine, legendEntries]
    )

    const togglePovertyLine = useCallback(
        (income: number) =>
            setPovertyLine(povertyLine === null ? income : null),
        [povertyLine, setPovertyLine]
    )
    const clearPovertyLine = useCallback(
        () => setPovertyLine(null),
        [setPovertyLine]
    )

    const hasNoCountries = view === "countries" && model.series.length === 0

    const title = config.title ?? chartTitle(view, selectedCountries, year)
    const subtitle =
        config.subtitle ?? chartSubtitle(view, currency, timeInterval)

    return (
        <div
            ref={ref}
            className={cx("income-distribution", {
                "income-distribution--narrow": isNarrow,
            })}
        >
            {!config.hideControls && (
                <IncomeDistributionControls
                    view={view}
                    setView={setView}
                    breakdown={breakdown}
                    setBreakdown={setBreakdown}
                    selectedCountries={selectedCountries}
                    setSelectedCountries={setSelectedCountries}
                    availableCountries={availableCountries}
                    timeInterval={timeInterval}
                    setTimeInterval={setTimeInterval}
                    currency={currency}
                    setCurrency={setCurrency}
                    currencies={currencies}
                    suggestedCurrency={suggestedCurrency}
                    isNarrow={isNarrow}
                />
            )}
            <BespokeMetadataProvider metadata={metadata.bespokeMetadata}>
                <Frame className="income-distribution-captioned-chart">
                    <ChartHeader title={title} subtitle={subtitle} />
                    {!hasNoCountries && (
                        <IncomeDistributionLegend
                            entries={legendEntries}
                            hoveredEntity={hoveredEntity}
                            onHoverEntity={setHoveredEntity}
                            sharesBelowLine={sharesBelowLine}
                            povertyLine={povertyLine}
                            currency={currency}
                            timeInterval={timeInterval}
                            onClearPovertyLine={
                                config.hideControls
                                    ? undefined
                                    : clearPovertyLine
                            }
                            isNarrow={isNarrow}
                        />
                    )}
                    <div className="income-distribution-captioned-chart__chart-area">
                        {isLoading && <Spinner />}
                        {hasNoCountries ? (
                            <div className="income-distribution__no-data">
                                {config.hideControls
                                    ? "No data for the selected countries."
                                    : "Select a country to see its income distribution."}
                            </div>
                        ) : (
                            <IncomeDistributionChart
                                model={model}
                                yearData={yearData}
                                year={year}
                                currency={currency}
                                timeInterval={timeInterval}
                                povertyLine={povertyLine}
                                onTogglePovertyLine={togglePovertyLine}
                                hoveredEntity={hoveredEntity}
                                onHoverEntity={setHoveredEntity}
                                isNarrow={isNarrow}
                            />
                        )}
                    </div>
                    <ChartFooter
                        source={metadata.source}
                        note={chartNote(currency, year)}
                    />
                </Frame>
            </BespokeMetadataProvider>
        </div>
    )
}

function chartTitle(
    view: View,
    selectedCountries: string[],
    year: number
): string {
    if (view === "global")
        return `How is income distributed across the world's population in ${year}?`
    if (selectedCountries.length === 0)
        return `How is income distributed in the selected countries in ${year}?`
    return `How is income distributed in ${formatCountryList(selectedCountries)} in ${year}?`
}

/** "A", "A and B", "A, B and C"; past the limit, "A, B, C and 4 other countries" */
function formatCountryList(countries: string[]): string {
    const names = countries.map((name) => formatEntityNameForSentence(name))
    if (names.length > MAX_COUNTRIES_IN_TITLE) {
        const rest = names.length - 3
        return `${names.slice(0, 3).join(", ")} and ${rest} other ${rest === 1 ? "country" : "countries"}`
    }
    if (names.length <= 1) return names.join("")
    return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function chartSubtitle(
    view: View,
    currency: Currency,
    timeInterval: TimeInterval
): string {
    const currencyLabel =
        currency.code === INTERNATIONAL_DOLLAR.code
            ? "international-$"
            : `${currency.name} (${currency.countryName})`
    const measured = `Incomes are measured in ${currencyLabel} per ${timeIntervalNoun(timeInterval)}, adjusted for inflation and for differences in the cost of living between countries.`
    const explanation =
        view === "global"
            ? "Each country's population is stacked along the income axis, so the height of the mountain is the number of people living at each income level."
            : "Each curve shows how a country's population is spread across income levels; every curve covers the same area, whatever the country's population."
    return `${measured} ${explanation}`
}

function chartNote(currency: Currency, year: number): string {
    const sentences = [
        "Depending on the country and year, the data relates to income measured after taxes and benefits, or to consumption, per capita.",
    ]
    if (year >= FIRST_NOWCAST_YEAR)
        sentences.push(
            `Figures for ${year} are World Bank nowcasts, which extrapolate the latest household surveys using economic growth.`
        )
    if (currency.code !== INTERNATIONAL_DOLLAR.code)
        sentences.push(
            "Incomes in local currencies are converted from international-$ using PPP conversion factors and adjusted for inflation to the latest year available."
        )
    return sentences.join(" ")
}
