import { useMemo } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NuqsAdapter } from "nuqs/adapters/react"
import { parseAsInteger, parseAsString } from "nuqs"
import * as R from "remeda"

import { Time } from "@ourworldindata/types"
import { ChartError } from "../../../../components/ChartError/ChartError.js"
import { ChartSkeleton } from "../../../../components/ChartSkeleton/ChartSkeleton.js"
import { BespokeMetadataProvider } from "../../../../components/MetadataModal/BespokeMetadataContext.js"
import { combineStatuses } from "../../../../helpers/queryStatus.js"

import type { VariantProps } from "../../../../helpers/config.js"
import type { BespokeComponentDataUrls } from "owid-bespoke-types"
import { ConflictDeathsConfig } from "../core/config.js"
import { DEFAULT_CONFLICT_TYPE } from "../core/ConflictDeathsConstants.js"
import {
    useConflictDeathsData,
    useConflictDeathsMetadata,
} from "../core/ConflictDeathsDataFetching.js"
import { ConflictDeathsMetadata } from "../core/ConflictDeathsMetadata.js"
import { ConflictDeathsCaptionedChart } from "./ConflictDeathsCaptionedChart.js"
import { ConflictDeathsControls } from "./ConflictDeathsControls.js"

import { useUrlState } from "../../../../hooks/useUrlState.js"
import { EmbedConfigProvider } from "../../../../hooks/useEmbedConfig.js"
import { useDelayedLoading } from "../../../../hooks/useDelayedLoading.js"

// Sentinel year meaning "the latest available year"; the concrete default
// isn't known until the metadata has loaded.
const LATEST_YEAR = -1

const queryClient = new QueryClient()

export function ConflictDeathsChartWithProviders(
    props: VariantProps<ConflictDeathsConfig>
): React.ReactElement {
    return (
        <EmbedConfigProvider config={props.config}>
            <NuqsAdapter>
                <QueryClientProvider client={queryClient}>
                    <ConflictDeathsChart
                        config={props.config}
                        urls={props.urls}
                    />
                </QueryClientProvider>
            </NuqsAdapter>
        </EmbedConfigProvider>
    )
}

function ConflictDeathsChart(props: {
    config: ConflictDeathsConfig
    urls: BespokeComponentDataUrls
}): React.ReactElement {
    const { config, urls } = props

    // State, synced to the URL when the embedding page asks for it
    const [conflictTypeSlug, setConflictTypeSlug] = useUrlState({
        key: "conflictDeathsType",
        parser: parseAsString,
        defaultValue: config.conflictType ?? DEFAULT_CONFLICT_TYPE,
    })
    const [year, setYear] = useUrlState({
        key: "conflictDeathsYear",
        parser: parseAsInteger,
        defaultValue: config.year ?? LATEST_YEAR,
    })

    // Fetch the metadata and the data for the selected conflict type
    const metadataResponse = useConflictDeathsMetadata(urls.metadataUrl)
    const metadata = metadataResponse.data

    // The conflict type comes from the URL or the block config, so it might
    // not exist — fall back to the default one
    const conflictType =
        metadata?.conflictTypeBySlug.get(conflictTypeSlug) ??
        metadata?.conflictTypeBySlug.get(DEFAULT_CONFLICT_TYPE) ??
        metadata?.conflictTypes[0]

    const dataResponse = useConflictDeathsData(
        conflictType,
        metadata,
        urls.dataUrl
    )
    const data = dataResponse.data

    // Only show loading overlays after 300ms delay to prevent flashing
    const isLoadingData = useDelayedLoading(dataResponse.isPlaceholderData, 300)

    const activeYear = metadata ? resolveYear(year, metadata) : undefined

    const dataForYear = useMemo(
        () => data?.filter((row) => row.year === activeYear),
        [data, activeYear]
    )

    const loadingStatus = combineStatuses(
        metadataResponse.status,
        dataResponse.status
    )

    if (loadingStatus === "error") {
        return <ChartError className="conflict-deaths-chart-box" />
    }

    if (loadingStatus === "pending") {
        return <ChartSkeleton className="conflict-deaths-chart-box" />
    }

    // Sanity check
    if (!metadata || !conflictType || !data || !dataForYear || !activeYear)
        return <ChartError className="conflict-deaths-chart-box" />

    return (
        <div className="conflict-deaths-chart">
            {!config.hideControls && (
                <ConflictDeathsControls
                    metadata={metadata}
                    conflictTypeSlug={conflictType.slug}
                    year={activeYear}
                    setConflictTypeSlug={setConflictTypeSlug}
                    setYear={setYear}
                />
            )}
            <BespokeMetadataProvider
                metadata={metadataResponse.bespokeMetadata}
            >
                <ConflictDeathsCaptionedChart
                    data={dataForYear}
                    timeSeriesData={data}
                    metadata={metadata}
                    conflictType={conflictType}
                    year={activeYear}
                    isLoading={isLoadingData}
                />
            </BespokeMetadataProvider>
        </div>
    )
}

/**
 * The year comes from the URL or the block config, so it might lie outside
 * the available data range — clamp it. The LATEST_YEAR sentinel maps to the
 * latest available year.
 */
function resolveYear(year: Time, metadata: ConflictDeathsMetadata): Time {
    const { start, end } = metadata.timeRange
    if (year === LATEST_YEAR) return end
    return R.clamp(year, { min: start, max: end })
}
