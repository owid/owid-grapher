import { useMemo } from "react"
import { useIntersectionObserver } from "usehooks-ts"
import { QueryStatus, useQuery } from "@tanstack/react-query"
import { fetchJson } from "@ourworldindata/utils"
import { OwidTable } from "@ourworldindata/core-table"
import {
    GrapherState,
    migrateGrapherConfigToLatestVersion,
} from "@ourworldindata/grapher"
import { ChartRecordType, SearchChartHit } from "./searchTypes"
import {
    GrapherInterface,
    MultiDimDataPageConfigEnriched,
} from "@ourworldindata/types"
import { chartHitQueryKeys } from "./queries"
import { constructConfigUrl, constructMdimConfigUrl } from "./searchUtils"
import {
    useQueryInputTable,
    useQueryInputTableForMultiDimView,
} from "../loadChartData"
import { DATA_API_URL } from "../../settings/clientSettings"

export function useSearchChartHitData(hit: SearchChartHit) {
    // Intersection observer for lazy loading config and data
    const { ref, isIntersecting: hasBeenVisible } = useIntersectionObserver({
        rootMargin: "400px", // Start loading 400px before visible
        freezeOnceVisible: true, // Only trigger once
    })

    // Fetch the mdim config (only fires a request if the chart is a multi-dim view)
    const { data: mdimConfig } = useQueryMdimConfig(hit, {
        enabled: hasBeenVisible,
    })

    // Fetch the grapher config (starts fetching when the component is visible)
    const { data: chartConfig, status: loadingStatusConfig } =
        useQueryChartConfig(hit, { enabled: hasBeenVisible })

    // Fetch chart data and metadata (starts fetching when the chart config is available)
    const { data: inputTable, status: loadingStatusData } =
        useQueryInputTableForChartHit(hit, {
            mdimConfig,
            chartConfig,
            enabled: !!chartConfig,
        })

    // Init the grapher state and update its data
    const grapherState = useMemo(() => {
        const grapherState = new GrapherState(
            chartConfig ?? { isConfigReady: false }
        )
        if (inputTable) grapherState.inputTable = inputTable
        return grapherState
    }, [chartConfig, inputTable])

    const status =
        loadingStatusConfig === "error" || loadingStatusData === "error"
            ? "error"
            : loadingStatusConfig === "loading" ||
                loadingStatusData === "loading"
              ? "loading"
              : "success"

    return { ref, grapherState, status }
}

/** Fetches the mdim config for a given chart hit */
function useQueryMdimConfig(
    hit: SearchChartHit,
    { enabled }: { enabled?: boolean } = {}
): {
    data?: MultiDimDataPageConfigEnriched
    status: QueryStatus
} {
    const { data, status } = useQuery({
        queryKey: chartHitQueryKeys.mdimConfig(hit.slug),
        queryFn: () => {
            const mdimConfigUrl = constructMdimConfigUrl({ hit })
            if (!mdimConfigUrl) return null
            return fetchJson<MultiDimDataPageConfigEnriched>(mdimConfigUrl)
        },
        // Only fire if the chart is a multi-dim view
        enabled: enabled && hit.type === ChartRecordType.MultiDimView,
    })

    // If the result is null, the query URL couldn't be constructed. In this
    // case, return an error status instead of a success status with null data
    if (data === null) return { status: "error" }

    return { data, status }
}

/** Fetches the Grapher config for a given chart hit */
function useQueryChartConfig(
    hit: SearchChartHit,
    { enabled }: { enabled?: boolean } = {}
): {
    data?: GrapherInterface
    status: QueryStatus
} {
    const isChartRecord = hit.type === ChartRecordType.Chart

    const { data: fetchedChartConfig, status } = useQuery({
        queryKey: chartHitQueryKeys.chartConfig(
            hit.slug,
            isChartRecord ? undefined : hit.queryParams
        ),
        queryFn: () => {
            const configUrl = constructConfigUrl({ hit })
            if (!configUrl) return null
            return fetchJson<GrapherInterface>(configUrl)
        },
        enabled,
    })

    // If the result is null, the query URL couldn't be constructed. In this
    // case, return an error status instead of a success status with null data
    if (fetchedChartConfig === null) return { status: "error" }

    const chartConfig = fetchedChartConfig
        ? migrateGrapherConfigToLatestVersion(fetchedChartConfig)
        : undefined

    return { data: chartConfig, status }
}

/** Fetches variable data and metadata for a given chart hit and builds the input table */
function useQueryInputTableForChartHit(
    hit: SearchChartHit,
    {
        mdimConfig,
        chartConfig,
        enabled,
    }: {
        mdimConfig?: MultiDimDataPageConfigEnriched
        chartConfig?: GrapherInterface
        enabled?: boolean
    }
): {
    data?: OwidTable
    status: QueryStatus
} {
    const isMultiDimView = hit.type === ChartRecordType.MultiDimView

    // Build input table for a chart or explorer view record (only executed in that case)
    const inputTableForChartOrExplorerRecord = useQueryInputTable(chartConfig, {
        enabled: enabled && !isMultiDimView,
        dataApiUrl: DATA_API_URL,
    })

    // Build input table for a mdim view record (only executed in that case)
    const mdimSearchParams = new URLSearchParams(
        isMultiDimView ? hit.queryParams : undefined
    )
    const inputTableForMdimRecord = useQueryInputTableForMultiDimView(
        { chartConfig, mdimConfig, mdimSearchParams },
        {
            enabled: enabled && isMultiDimView,
            dataApiUrl: DATA_API_URL,
        }
    )

    return isMultiDimView
        ? inputTableForMdimRecord
        : inputTableForChartOrExplorerRecord
}
