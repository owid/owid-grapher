import { useMemo } from "react"
import cx from "clsx"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs"
import * as R from "remeda"

import { articulateEntity } from "@ourworldindata/utils"

import { Frame } from "../../../../components/Frame/Frame.js"
import { ChartHeader } from "../../../../components/ChartHeader/ChartHeader.js"
import { ChartFooter } from "../../../../components/ChartFooter/ChartFooter.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"
import { MOBILE_BREAKPOINT } from "../../../../components/Sankey/SplitFlowSankey.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"
import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"
import {
    isUserLocationCountry,
    useResolveUserLocation,
} from "../../../../hooks/useResolveUserLocation.js"

import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"

import { DeforestationConfig } from "../core/config.js"
import {
    DeforestationMetadata,
    Period,
    PERIODS,
    TradeRow,
    View,
    VIEWS,
    YearRange,
} from "../core/types.js"
import { useCountryData, useDeforestationMetadata } from "../core/data.js"
import {
    describeYearRange,
    formatHectares,
    formatShare,
    resolveYearIndexRange,
    rowsForYearRange,
    sumRows,
    worldTotalForYearRange,
} from "../core/helpers.js"
import { DeforestationChart } from "../components/DeforestationChart.js"
import { DeforestationControls } from "../components/DeforestationControls.js"

const DEFAULT_VIEW: View = "production"

const DEFAULT_PERIOD: Period = "single-year"

/** Shown when the embed names no country: the largest producer of embedded
 *  deforestation, and the one the chart is most often about. */
const DEFAULT_COUNTRY = "Brazil"

/** The last year the manifest ships. Only a seed for the URL state, which is
 *  initialised before the metadata has loaded; the rendered year is always
 *  resolved against `metadata.years` below. */
const DEFAULT_YEAR = 2023

const queryClient = new QueryClient()

export function SankeyVariant({
    config,
    urls,
}: VariantProps<DeforestationConfig>): React.ReactElement {
    const { width, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < MOBILE_BREAKPOINT

    return (
        <EmbedConfigProvider config={config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <div
                        ref={ref}
                        className={cx("deforestation-chart", {
                            "deforestation-chart--narrow": isNarrow,
                        })}
                    >
                        <FetchingSankeyVariant
                            config={config}
                            urls={urls}
                            isNarrow={isNarrow}
                        />
                    </div>
                </QueryClientProvider>
            </NuqsAdapter>
        </EmbedConfigProvider>
    )
}

function FetchingSankeyVariant({
    config,
    urls,
    isNarrow,
}: {
    config: DeforestationConfig
    urls: BespokeComponentDataUrls
    isNarrow: boolean
}) {
    // "userLocation" is resolved asynchronously by useResolveUserLocation, so
    // it starts on the default country like an unset country does.
    const initialCountry =
        !config.country || isUserLocationCountry(config.country)
            ? DEFAULT_COUNTRY
            : config.country

    const [country, setCountry] = useUrlState({
        key: "deforestationCountry",
        parser: parseAsString,
        defaultValue: initialCountry,
    })
    const [year, setYear] = useUrlState({
        key: "deforestationYear",
        parser: parseAsInteger,
        defaultValue: config.year ?? DEFAULT_YEAR,
    })
    const [period, setPeriod] = useUrlState({
        key: "deforestationPeriod",
        parser: parseAsStringEnum<Period>([...PERIODS]),
        defaultValue: config.period ?? DEFAULT_PERIOD,
    })
    const [storedView, setView] = useUrlState({
        key: "deforestationFlow",
        parser: parseAsStringEnum<View>([...VIEWS]),
        defaultValue: config.flow ?? DEFAULT_VIEW,
    })

    const { data: metadata, status: metadataStatus } = useDeforestationMetadata(
        urls.metadataUrl
    )

    const availableCountryNames = useMemo(
        () =>
            metadata
                ? new Set(metadata.entities.map((e) => e.name))
                : undefined,
        [metadata]
    )
    const { isResolved: isCountryResolved } = useResolveUserLocation({
        configCountry: config.country,
        availableCountryNames,
        urlStateKey: "deforestationCountry",
        setCountry,
    })

    const countryId = useMemo(
        () => (metadata ? metadata.entityByName.get(country)?.id : undefined),
        [metadata, country]
    )

    const countryQuery = useCountryData(countryId, metadata, urls.dataUrl)
    const { data, status, isPlaceholderData } = countryQuery

    // Dim the chart and show a spinner while a new selection loads,
    // keeping the previous one on screen until the new one arrives.
    const isLoading = useDelayedLoading(isPlaceholderData)

    // A year that isn't in the manifest (a stale link, a config typo) falls
    // back to the most recent one rather than rendering an empty chart.
    const yearIndex = useMemo(() => {
        if (!metadata || metadata.years.length === 0) return -1
        const index = metadata.years.indexOf(year)
        return index >= 0 ? index : metadata.years.length - 1
    }, [metadata, year])

    // A preset period always ends at the data's most recent year; only a
    // single year follows the slider
    const { startIndex, endIndex } = useMemo(
        () =>
            resolveYearIndexRange(
                period,
                yearIndex,
                metadata?.years.length ?? 0
            ),
        [period, yearIndex, metadata]
    )
    const yearRange: YearRange = useMemo(
        () =>
            metadata && yearIndex >= 0
                ? {
                      start: metadata.years[startIndex],
                      end: metadata.years[endIndex],
                  }
                : { start: year, end: year },
        [metadata, yearIndex, startIndex, endIndex, year]
    )

    // In a country's own data, domestic production is a flow from the country
    // to itself, so it is already part of both blocks. Over a multi-year
    // period every flow is the sum of its years.
    const importRows = useMemo(
        () =>
            data && yearIndex >= 0
                ? rowsForYearRange(data.imports, startIndex, endIndex)
                : [],
        [data, yearIndex, startIndex, endIndex]
    )
    const exportRows = useMemo(
        () =>
            data && yearIndex >= 0
                ? rowsForYearRange(data.exports, startIndex, endIndex)
                : [],
        [data, yearIndex, startIndex, endIndex]
    )
    const worldTotal = useMemo(
        () =>
            metadata && yearIndex >= 0
                ? worldTotalForYearRange(
                      metadata.worldTotals,
                      startIndex,
                      endIndex
                  )
                : undefined,
        [metadata, yearIndex, startIndex, endIndex]
    )
    const importsTotal = useMemo(() => sumRows(importRows), [importRows])
    const exportsTotal = useMemo(() => sumRows(exportRows), [exportRows])

    // When the selected country has data on only one side in this period, the
    // other view has nothing to show — coerce the displayed view to the side
    // that has data and disable the switcher. The stored preference is left
    // untouched, so it comes back on a selection that has both.
    const onlyConsumption = importRows.length > 0 && exportRows.length === 0
    const onlyProduction = exportRows.length > 0 && importRows.length === 0
    const view: View = onlyConsumption
        ? "consumption"
        : onlyProduction
          ? "production"
          : storedView

    // While a new country loads, the query serves the previous country's rows
    // as placeholder data
    const displayedCountry = countryQuery.data?.country ?? country

    const total = view === "consumption" ? importsTotal : exportsTotal

    const countryLabel = R.capitalize(articulateEntity(displayedCountry))
    const whenRecorded = describeYearRange(yearRange)
    const viewDisabledReason: string | undefined = onlyConsumption
        ? `No deforestation embedded in ${countryLabel}'s production recorded ${whenRecorded}.`
        : onlyProduction
          ? `No deforestation embedded in ${countryLabel}'s consumption recorded ${whenRecorded}.`
          : undefined

    if (metadataStatus === "pending")
        return <ChartSkeleton className="deforestation-chart-box" />
    if (metadataStatus === "error" || !metadata)
        return <ChartError className="deforestation-chart-box" />
    // A country the manifest doesn't list (a hand-edited URL, a stale config)
    // leaves the country query disabled, which would otherwise keep the
    // skeleton up forever
    if (countryId === undefined)
        return <ChartError className="deforestation-chart-box" />
    if (status === "pending" || !isCountryResolved)
        return <ChartSkeleton className="deforestation-chart-box" />
    if (status === "error" || !data)
        return <ChartError className="deforestation-chart-box" />

    return (
        <CaptionedSankeyVariant
            config={config}
            metadata={metadata}
            country={country}
            displayedCountry={displayedCountry}
            yearRange={yearRange}
            period={period}
            view={view}
            viewDisabledReason={viewDisabledReason}
            importRows={importRows}
            exportRows={exportRows}
            total={total}
            worldTotal={worldTotal}
            isLoading={isLoading}
            isNarrow={isNarrow}
            setCountry={setCountry}
            setYear={setYear}
            setPeriod={setPeriod}
            setView={setView}
        />
    )
}

function CaptionedSankeyVariant({
    config,
    metadata,
    country,
    displayedCountry,
    yearRange,
    period,
    view,
    viewDisabledReason,
    importRows,
    exportRows,
    total,
    worldTotal,
    isLoading,
    isNarrow,
    setCountry,
    setYear,
    setPeriod,
    setView,
}: {
    config: DeforestationConfig
    metadata: DeforestationMetadata
    country: string
    displayedCountry: string
    yearRange: YearRange
    period: Period
    view: View
    viewDisabledReason: string | undefined
    importRows: TradeRow[]
    exportRows: TradeRow[]
    total: number
    worldTotal: number | undefined
    isLoading: boolean
    isNarrow: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
    setPeriod: (period: Period) => void
    setView: (view: View) => void
}) {
    const shouldHideChrome =
        config.hideControls || !!config.title || !!config.subtitle

    // The share of the displayed view's flow that the country both produced
    // and consumed itself: its own rows out of that view's total
    const domesticShare = useMemo(() => {
        if (total <= 0) return 0
        const rows = view === "consumption" ? importRows : exportRows
        const domestic = rows.filter((r) => r.partner === displayedCountry)
        return sumRows(domestic) / total
    }, [view, importRows, exportRows, displayedCountry, total])

    const { title, subtitle } = useMemo(
        () =>
            buildCaption({
                view,
                country: displayedCountry,
                yearRange,
                total,
                domesticShare,
                worldTotal,
            }),
        [view, displayedCountry, yearRange, total, domesticShare, worldTotal]
    )

    return (
        <>
            {!shouldHideChrome && (
                <DeforestationControls
                    metadata={metadata}
                    country={country}
                    yearRange={yearRange}
                    period={period}
                    view={view}
                    viewDisabledReason={viewDisabledReason}
                    hideFlowSwitcher={config.hideFlowSwitcher}
                    setCountry={setCountry}
                    setYear={setYear}
                    setPeriod={setPeriod}
                    setView={setView}
                />
            )}
            <BespokeMetadataProvider metadata={metadata.bespoke}>
                <Frame className="deforestation-captioned-chart">
                    <ChartHeader
                        title={config.title ?? title}
                        subtitle={config.subtitle ?? subtitle}
                    />
                    <DeforestationChart
                        view={view}
                        country={displayedCountry}
                        yearRange={yearRange}
                        importRows={importRows}
                        exportRows={exportRows}
                        total={total}
                        isLoading={isLoading}
                        isNarrow={isNarrow}
                        setCountry={setCountry}
                        setView={setView}
                    />
                    <ChartFooter source={metadata.source} note={NOTE} />
                </Frame>
            </BespokeMetadataProvider>
        </>
    )
}

const NOTE =
    "Figures are deforestation risk embedded in trade: an estimate of how much deforestation a country is exposed to through the commodities it produces or consumes, not confirmed sourcing from a particular cleared area."

/** The narrative title and subtitle for the current selection. */
function buildCaption({
    view,
    country,
    yearRange,
    total,
    domesticShare,
    worldTotal,
}: {
    view: View
    country: string
    yearRange: YearRange
    total: number
    /** Share of this view's flow the country both produced and consumed */
    domesticShare: number
    worldTotal: number | undefined
}): { title: string; subtitle: string } {
    const amount = formatHectares(total)
    const articulated = articulateEntity(country)
    const when = describeYearRange(yearRange)

    // Only worth spelling out when there is any domestic production at all
    const domesticClause =
        domesticShare > 0
            ? `${formatShare(domesticShare)} of it was for commodities that were both produced & consumed in ${articulated}.`
            : ""

    // The world's total for scale
    const worldClause = worldTotal
        ? `For context, ${when} a total of ${formatHectares(worldTotal)} of forest was cleared worldwide for agriculture.`
        : ""
    const subtitle = [domesticClause, worldClause].filter(Boolean).join(" ")

    if (view === "consumption")
        return {
            title: `${R.capitalize(amount)} of forest were cleared ${when} for agricultural products consumed in ${articulated}. Where were these products produced?`,
            subtitle,
        }

    return {
        title: `${R.capitalize(articulated)} cleared ${amount} of forest for agriculture ${when}. Where were these products consumed?`,
        subtitle,
    }
}
