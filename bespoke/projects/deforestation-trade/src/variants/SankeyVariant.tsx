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
import { DeforestationMetadata, TradeRow, View, VIEWS } from "../core/types.js"
import { useCountryData, useDeforestationMetadata } from "../core/data.js"
import {
    formatHectares,
    formatShare,
    rowsForYear,
    sumRows,
} from "../core/helpers.js"
import { DeforestationChart } from "../components/DeforestationChart.js"
import { DeforestationControls } from "../components/DeforestationControls.js"

const DEFAULT_VIEW: View = "production"

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
    const displayedYear =
        metadata && yearIndex >= 0 ? metadata.years[yearIndex] : year

    // In a country's own data, domestic production is a flow from the country
    // to itself, so it is already part of both blocks
    const importRows = useMemo(
        () =>
            data && yearIndex >= 0 ? rowsForYear(data.imports, yearIndex) : [],
        [data, yearIndex]
    )
    const exportRows = useMemo(
        () =>
            data && yearIndex >= 0 ? rowsForYear(data.exports, yearIndex) : [],
        [data, yearIndex]
    )
    const importsTotal = useMemo(() => sumRows(importRows), [importRows])
    const exportsTotal = useMemo(() => sumRows(exportRows), [exportRows])

    // When the selected country has data on only one side in this year, the
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
    const viewDisabledReason: string | undefined = onlyConsumption
        ? `No deforestation embedded in ${countryLabel}'s production recorded in ${displayedYear}.`
        : onlyProduction
          ? `No deforestation embedded in ${countryLabel}'s consumption recorded in ${displayedYear}.`
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
            year={displayedYear}
            view={view}
            viewDisabledReason={viewDisabledReason}
            importRows={importRows}
            exportRows={exportRows}
            total={total}
            isLoading={isLoading}
            isNarrow={isNarrow}
            setCountry={setCountry}
            setYear={setYear}
            setView={setView}
        />
    )
}

function CaptionedSankeyVariant({
    config,
    metadata,
    country,
    displayedCountry,
    year,
    view,
    viewDisabledReason,
    importRows,
    exportRows,
    total,
    isLoading,
    isNarrow,
    setCountry,
    setYear,
    setView,
}: {
    config: DeforestationConfig
    metadata: DeforestationMetadata
    country: string
    displayedCountry: string
    year: number
    view: View
    viewDisabledReason: string | undefined
    importRows: TradeRow[]
    exportRows: TradeRow[]
    total: number
    isLoading: boolean
    isNarrow: boolean
    setCountry: (name: string) => void
    setYear: (year: number) => void
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
                year,
                total,
                domesticShare,
            }),
        [view, displayedCountry, year, total, domesticShare]
    )

    return (
        <>
            {!shouldHideChrome && (
                <>
                    <header className="deforestation-heading">
                        <h1 className="deforestation-heading__title">
                            How much deforestation is caused by the products we
                            produce and consume?
                        </h1>
                        <p className="deforestation-heading__description">
                            The estimated amount of deforestation caused by the
                            production and consumption of agricultural
                            commodities. This is adjusted for trade between
                            countries using models of deforestation risk.
                        </p>
                    </header>
                    <DeforestationControls
                        metadata={metadata}
                        country={country}
                        year={year}
                        view={view}
                        viewDisabledReason={viewDisabledReason}
                        hideFlowSwitcher={config.hideFlowSwitcher}
                        setCountry={setCountry}
                        setYear={setYear}
                        setView={setView}
                    />
                </>
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
                        year={year}
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
    year,
    total,
    domesticShare,
}: {
    view: View
    country: string
    year: number
    total: number
    /** Share of this view's flow the country both produced and consumed */
    domesticShare: number
}): { title: string; subtitle: string } {
    const amount = formatHectares(total)
    const articulated = articulateEntity(country)

    // Only worth spelling out when there is any domestic production at all
    const domesticClause =
        domesticShare > 0
            ? `${formatShare(domesticShare)} of it was for commodities that were both produced & consumed in ${articulated}.`
            : ""

    if (view === "consumption")
        return {
            title: `${R.capitalize(amount)} of forest were cleared in ${year} for agricultural products consumed in ${articulated}. Where were these products produced?`,
            subtitle: domesticClause,
        }

    return {
        title: `${R.capitalize(articulated)} cleared ${amount} of forest in ${year} for agriculture. Where were these products consumed?`,
        subtitle: domesticClause,
    }
}
