import { useCallback, useEffect, useMemo, useState } from "react"
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
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import { useUserCountryInformation } from "../../../../hooks/useUserCountryInformation.js"
import { combineStatuses } from "../../../../helpers/queryStatus.js"
import type {
    BespokeComponentDataUrls,
    BespokeVariantProps,
} from "owid-bespoke-types"

import type { IncomeDistributionConfig } from "../index.js"
import {
    DEFAULT_COUNTRIES,
    DEFAULT_CUSTOM_POVERTY_LINE,
    FIRST_NOWCAST_YEAR,
    INT_POVERTY_LINE,
    INTERNATIONAL_DOLLAR,
    MAX_SELECTED_COUNTRIES,
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
import type { LabelBox } from "../core/curveLabels.js"
import {
    peopleBelowLineForEntities,
    shareBelowLineForEntities,
} from "../core/density.js"
import { placeholderWelfareType } from "../core/welfareType.js"
import {
    formatCountryList,
    welfareTypeSentence,
    type WelfareSentenceSegment,
} from "../core/welfareSentence.js"
import { resolveCurrency, roundIncomeAsDisplayed } from "../core/currency.js"
import {
    Currency,
    IncomeDistributionYear,
    LegendMeasure,
    PovertyLineMode,
    TIME_INTERVALS,
    TimeInterval,
    VIEWS,
    View,
} from "../core/types.js"
import { IncomeDistributionControls } from "../components/IncomeDistributionControls.js"
import { CountryMultiSelect } from "../components/CountryMultiSelect.js"
import { IncomeDistributionChart } from "../components/IncomeDistributionChart.js"
import { WelfareSentence } from "../components/WelfareDetails.js"
import {
    IncomeDistributionLegend,
    LegendEntry,
} from "../components/IncomeDistributionLegend.js"

/** Top of the overlays over the plot without the button, and the gap between them (DistributionVariant.scss) */
const OVERLAY_TOP = 30
const OVERLAY_GAP = 8

/** More selected countries than this and the title stops naming them */
const MAX_COUNTRIES_IN_TITLE = 4

/** Stands in for the currency list when it failed to load; stable for memo deps */
const NO_CURRENCIES: Currency[] = []

export function DistributionVariant({
    config,
    urls,
}: BespokeVariantProps<IncomeDistributionConfig>): React.ReactElement {
    return (
        <NuqsAdapter>
            <QueryClientProvider client={queryClient}>
                <FetchingDistributionVariant config={config} urls={urls} />
            </QueryClientProvider>
        </NuqsAdapter>
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
        key: "view",
        parser: parseAsStringEnum<View>([...VIEWS]),
        defaultValue: config.view,
    })
    // May hold the "userLocation" sentinel until the user edits the
    // selection; it's resolved where the list is rendered
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
            selectedCountries={selectedCountries}
            povertyLine={povertyLine}
            timeInterval={timeInterval}
            currency={currency}
            currencies={currencies}
            suggestedCurrency={suggestedCurrency}
            isLoading={isLoading}
            setView={setView}
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
    selectedCountries,
    povertyLine,
    timeInterval,
    currency,
    currencies,
    suggestedCurrency,
    isLoading,
    setView,
    setSelectedCountries,
    setPovertyLine,
    setTimeInterval,
    setCurrency,
}: {
    config: IncomeDistributionConfig
    metadata: IncomeDistributionMetadata
    yearData: IncomeDistributionYear
    view: View
    /** Resolved and filtered to countries in the data */
    selectedCountries: string[]
    povertyLine: number | null
    timeInterval: TimeInterval
    currency: Currency
    currencies: Currency[] | undefined
    suggestedCurrency: Currency | undefined
    isLoading: boolean
    setView: (view: View) => void
    setSelectedCountries: (names: string[]) => void
    setPovertyLine: (line: number | null) => void
    setTimeInterval: (interval: TimeInterval) => void
    setCurrency: (key: string) => void
}): React.ReactElement {
    const { width, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < NARROW_BREAKPOINT

    const [hoveredEntity, setHoveredEntity] = useState<string | null>(null)
    // The countries the chart couldn't label directly, which the overlay
    // legend then lists; none until it says otherwise, so the legend doesn't
    // flash up on load
    const [unlabelledCountries, setUnlabelledCountries] = useState<string[]>([])

    // What floats over the plot, measured so the chart's labels keep clear
    const [chartArea, setChartArea] = useState<HTMLDivElement | null>(null)
    const [editCountriesNode, setEditCountriesNode] =
        useState<HTMLDivElement | null>(null)
    const [overlayLegendNode, setOverlayLegendNode] =
        useState<HTMLDivElement | null>(null)
    const editCountriesBox = useBoxWithin(chartArea, editCountriesNode)
    const overlayLegendBox = useBoxWithin(chartArea, overlayLegendNode)
    const chartObstacles = useMemo(
        () => (editCountriesBox ? [editCountriesBox] : undefined),
        [editCountriesBox]
    )

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
                selectedCountries,
            }),
        [yearData, view, selectedCountries]
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

    // Shares and counts are taken against the amount the reader sees, not
    // the exact drag position
    const displayedPovertyLine =
        povertyLine !== null
            ? roundIncomeAsDisplayed(povertyLine, currency, timeInterval)
            : null
    const sharesBelowLine = useMemo(
        () =>
            displayedPovertyLine !== null
                ? shareBelowLineForEntities(
                      yearData,
                      displayedPovertyLine,
                      legendEntries.map((entry) => entry.key)
                  )
                : undefined,
        [yearData, displayedPovertyLine, legendEntries]
    )
    // With a line set, the legend's heading switches its bars between the
    // share of population below the line and the number of people. Only the
    // bars change, not the plot, so it isn't kept in the URL
    const [legendMeasure, setLegendMeasure] = useState<LegendMeasure>("share")
    const peopleBelowLine = useMemo(
        () =>
            displayedPovertyLine !== null && legendMeasure === "people"
                ? peopleBelowLineForEntities(
                      yearData,
                      displayedPovertyLine,
                      legendEntries.map((entry) => entry.key)
                  )
                : undefined,
        [yearData, displayedPovertyLine, legendMeasure, legendEntries]
    )

    // The poverty line control isn't stored: it's read off the line. Only
    // the exact international line, as picked from the control, counts as
    // International; a line dragged or clicked to about $3 stays Custom
    const povertyLineMode: PovertyLineMode =
        povertyLine === null
            ? "off"
            : povertyLine === INT_POVERTY_LINE
              ? "international"
              : "custom"
    const setPovertyLineMode = useCallback(
        (mode: PovertyLineMode) => {
            if (mode === "off") setPovertyLine(null)
            if (mode === "international") setPovertyLine(INT_POVERTY_LINE)
            // Picking Custom starts the line somewhere other than the
            // international line, ready to be dragged
            if (mode === "custom" && povertyLineMode !== "custom")
                setPovertyLine(DEFAULT_CUSTOM_POVERTY_LINE)
        },
        [povertyLineMode, setPovertyLine]
    )
    const clearPovertyLine = useCallback(
        () => setPovertyLine(null),
        [setPovertyLine]
    )

    // A custom title or subtitle is fixed text, which the controls would contradict
    const shouldHideControls =
        config.hideControls || !!config.title || !!config.subtitle
    const hasNoCountries = view === "countries" && model.series.length === 0
    const onClearPovertyLine = shouldHideControls ? undefined : clearPovertyLine

    const showEditCountries = view === "countries" && !shouldHideControls
    // On wide charts the legend floats over the plot's top-right corner and
    // turns into the share bars when a poverty line is set, so setting a line
    // never pushes the plot down; narrow charts keep it above the plot, where
    // it doesn't cover the mountains. In the countries view the curves are
    // labelled directly, so without a line the overlay legend only shows when
    // some country couldn't be labelled.
    const showOverlayLegend =
        !isNarrow &&
        !hasNoCountries &&
        (view === "global" ||
            povertyLine !== null ||
            unlabelledCountries.length > 0)
    // Countries view without a line: the overlay legend only appears when a
    // country couldn't be labelled, and then lists every country
    const listsLeftovers =
        view === "countries" && povertyLine === null && !isNarrow
    const overlayLegendEntries = legendEntries
    // Where that legend starts: below the button, else below the poverty
    // line's label (see .income-distribution-captioned-chart__overlays)
    const leftoverLegendTop = listsLeftovers
        ? editCountriesBox
            ? editCountriesBox.bottom + OVERLAY_GAP
            : OVERLAY_TOP
        : undefined
    const showInlineLegend = isNarrow && !hasNoCountries
    // Wide charts put the button over the plot's top-right corner, above the
    // overlay legend; narrow ones keep it in the row above the plot
    const showOverlayEditCountries = showEditCountries && !isNarrow
    const showToolbar = isNarrow && (showInlineLegend || showEditCountries)

    const editCountries = (
        <CountryMultiSelect
            availableCountries={availableCountries}
            selectedCountries={selectedCountries}
            onChange={setSelectedCountries}
            welfareTypeOf={placeholderWelfareType}
            isNarrow={isNarrow}
        />
    )

    const title = config.title ?? chartTitle(view, selectedCountries)
    const subtitle = config.subtitle ?? chartSubtitle(year, currency)
    // Countries view: which of the countries drawn report income and which
    // consumption, in place of the note's general sentence on the two
    const welfareSentence =
        view === "countries"
            ? welfareTypeSentence(
                  model.series.map((series) => series.key),
                  placeholderWelfareType
              )
            : undefined

    return (
        <div
            ref={ref}
            className={cx("income-distribution", {
                "income-distribution--narrow": isNarrow,
            })}
        >
            {!shouldHideControls && (
                <IncomeDistributionControls
                    view={view}
                    setView={setView}
                    timeInterval={timeInterval}
                    setTimeInterval={setTimeInterval}
                    currency={currency}
                    setCurrency={setCurrency}
                    currencies={currencies}
                    suggestedCurrency={suggestedCurrency}
                    povertyLineMode={povertyLineMode}
                    setPovertyLineMode={setPovertyLineMode}
                    isNarrow={isNarrow}
                />
            )}
            <BespokeMetadataProvider metadata={metadata.bespokeMetadata}>
                <Frame className="income-distribution-captioned-chart">
                    <ChartHeader title={title} subtitle={subtitle} />
                    {showToolbar && (
                        <div className="income-distribution-captioned-chart__toolbar">
                            {showInlineLegend && (
                                <IncomeDistributionLegend
                                    entries={legendEntries}
                                    hoveredEntity={hoveredEntity}
                                    onHoverEntity={setHoveredEntity}
                                    sharesBelowLine={sharesBelowLine}
                                    measure={legendMeasure}
                                    onMeasureChange={setLegendMeasure}
                                    peopleBelowLine={peopleBelowLine}
                                    povertyLine={povertyLine}
                                    currency={currency}
                                    timeInterval={timeInterval}
                                    onClearPovertyLine={onClearPovertyLine}
                                    isNarrow={isNarrow}
                                />
                            )}
                            {showEditCountries && (
                                <div className="income-distribution-captioned-chart__edit-countries">
                                    {editCountries}
                                </div>
                            )}
                        </div>
                    )}
                    <div
                        ref={setChartArea}
                        className="income-distribution-captioned-chart__chart-area"
                    >
                        {isLoading && <Spinner />}
                        {(showOverlayEditCountries || showOverlayLegend) && (
                            <div
                                className={cx(
                                    "income-distribution-captioned-chart__overlays",
                                    {
                                        "income-distribution-captioned-chart__overlays--with-button":
                                            showOverlayEditCountries,
                                    }
                                )}
                            >
                                {showOverlayEditCountries && (
                                    <div ref={setEditCountriesNode}>
                                        {editCountries}
                                    </div>
                                )}
                                {showOverlayLegend && (
                                    <div ref={setOverlayLegendNode}>
                                        <IncomeDistributionLegend
                                            layout="overlay"
                                            entries={overlayLegendEntries}
                                            hoveredEntity={hoveredEntity}
                                            onHoverEntity={setHoveredEntity}
                                            sharesBelowLine={sharesBelowLine}
                                            measure={legendMeasure}
                                            onMeasureChange={setLegendMeasure}
                                            peopleBelowLine={peopleBelowLine}
                                            povertyLine={povertyLine}
                                            currency={currency}
                                            timeInterval={timeInterval}
                                            onClearPovertyLine={
                                                onClearPovertyLine
                                            }
                                            isNarrow={false}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        {hasNoCountries ? (
                            <div className="income-distribution__no-data">
                                {shouldHideControls
                                    ? "No data for the selected countries."
                                    : "Use “Edit countries” to pick a country and see its income distribution."}
                            </div>
                        ) : (
                            <IncomeDistributionChart
                                model={model}
                                yearData={yearData}
                                year={year}
                                currency={currency}
                                timeInterval={timeInterval}
                                povertyLine={povertyLine}
                                isInternationalPovertyLine={
                                    povertyLineMode === "international"
                                }
                                onSetPovertyLine={setPovertyLine}
                                onClearPovertyLine={onClearPovertyLine}
                                hoveredEntity={hoveredEntity}
                                onHoverEntity={setHoveredEntity}
                                isNarrow={isNarrow}
                                obstacles={chartObstacles}
                                legendBox={
                                    listsLeftovers
                                        ? undefined
                                        : overlayLegendBox
                                }
                                leftoverLegendTop={leftoverLegendTop}
                                onUnlabelledCountriesChange={
                                    setUnlabelledCountries
                                }
                            />
                        )}
                    </div>
                    <ChartFooter
                        source={metadata.source}
                        note={chartNote(
                            currency,
                            year,
                            povertyLineMode === "international",
                            welfareSentence
                        )}
                    />
                </Frame>
            </BespokeMetadataProvider>
        </div>
    )
}

/**
 * Where `element` sits within `container` (both laid out), kept up to date as
 * either resizes; undefined while either is missing
 */
function useBoxWithin(
    container: HTMLElement | null,
    element: HTMLElement | null
): LabelBox | undefined {
    const [box, setBox] = useState<LabelBox | undefined>(undefined)

    useEffect(() => {
        if (!container || !element || typeof ResizeObserver === "undefined")
            return
        const update = (): void => {
            const outer = container.getBoundingClientRect()
            const inner = element.getBoundingClientRect()
            const next: LabelBox = {
                left: inner.left - outer.left,
                right: inner.right - outer.left,
                top: inner.top - outer.top,
                bottom: inner.bottom - outer.top,
            }
            // Keep the old object when nothing moved, so the chart's label
            // layout isn't redone
            setBox((prev) => (prev && R.isDeepEqual(prev, next) ? prev : next))
        }
        // Also reports both elements' sizes once when they're observed
        const observer = new ResizeObserver(update)
        observer.observe(container)
        observer.observe(element)
        return () => observer.disconnect()
    }, [container, element])

    return container && element ? box : undefined
}

function chartTitle(view: View, selectedCountries: string[]): string {
    if (view === "global")
        return "How is income distributed across the world's population?"
    if (selectedCountries.length === 0)
        return "How is income distributed in the selected countries?"
    // Naming three of seven countries would read as an arbitrary pick
    if (selectedCountries.length > MAX_COUNTRIES_IN_TITLE)
        return "How is income distributed across different countries?"
    return `How is income distributed in ${formatCountryList(selectedCountries)}?`
}

function chartSubtitle(year: number, currency: Currency): string {
    return currency.code === INTERNATIONAL_DOLLAR.code
        ? `Data for ${year}, measured in international dollars, which adjusts for differences in the cost of living between countries.`
        : // The country stays: a currency shared by several countries (the euro) converts differently in each
          `Data for ${year}, measured in ${currency.name} (${currency.countryName}), adjusted for differences in the cost of living.`
}

function chartNote(
    currency: Currency,
    year: number,
    isInternationalLine: boolean,
    /** Countries view: which of the countries shown report which (welfareTypeSentence) */
    welfareSentence?: WelfareSentenceSegment[]
): React.ReactNode {
    // The countries' own sentence says what each reports, so it replaces
    // the general one
    const sentences = welfareSentence
        ? []
        : [
              "Depending on the country, the data relates to income measured after taxes and benefits, or to consumption, per capita.",
          ]
    // Below the plot rather than in the subtitle, so picking or dragging the
    // line never reflows the chart above it
    if (isInternationalLine)
        sentences.push(
            "The International Poverty Line is set by the World Bank as its definition of extreme poverty."
        )
    if (year >= FIRST_NOWCAST_YEAR)
        sentences.push(
            `Figures for ${year} are World Bank nowcasts, which extrapolate the latest household surveys using economic growth.`
        )
    if (currency.code !== INTERNATIONAL_DOLLAR.code)
        sentences.push(
            "Incomes in local currencies are converted from international-$ using PPP conversion factors and adjusted for inflation to the latest year available."
        )
    if (!welfareSentence) return sentences.join(" ")
    return (
        <>
            <WelfareSentence segments={welfareSentence} />
            {sentences.map((sentence) => ` ${sentence}`).join("")}
        </>
    )
}
