import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import {
    getVariableDataRoute,
    getVariableMetadataRoute,
    legacyToOwidTableAndDimensionsWithMandatorySlug,
} from "@ourworldindata/grapher"
import {
    GrapherInterface,
    MultiDimDataPageConfigEnriched,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
    OwidVariableMixedData,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"
import { fetchJson, searchParamsToMultiDimView } from "@ourworldindata/utils"
import { QueryStatus, useQueries } from "@tanstack/react-query"

/** Fetches relevant data and metadata for a given chart config */
export function useQueryInputTable(
    chartConfig: GrapherInterface | undefined,
    options: { enabled?: boolean; dataApiUrl: string }
): { data?: OwidTable; status: QueryStatus } {
    const { dimensions = [], selectedEntityColors } = chartConfig ?? {}

    // Fetch both data and metadata for all variables
    const variableIds = dimensions.map((d) => d.variableId)
    const { data: variablesDataMap, status } = useQueryVariablesDataAndMetadata(
        variableIds,
        options
    )

    // Return early if data fetching failed or is still in progress
    if (status !== "success" || !variablesDataMap) return { status }

    // Transform the fetched variable data and metadata into Grapher's input table format
    const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
        variablesDataMap,
        dimensions,
        selectedEntityColors
    )

    return { status: "success", data: inputTable }
}

/** Fetches relevant data and metadata for a given mdim view */
export function useQueryInputTableForMultiDimView(
    {
        mdimConfig,
        mdimSearchParams,
        chartConfig,
    }: {
        mdimConfig: MultiDimDataPageConfigEnriched | undefined
        mdimSearchParams: URLSearchParams
        chartConfig: GrapherInterface | undefined
    },
    options: { enabled?: boolean; dataApiUrl: string }
): { data?: OwidTable; status: QueryStatus } {
    const { dimensions = [], selectedEntityColors } = chartConfig ?? {}

    // Fetch both data and metadata for all variables
    const variableIds = dimensions.map((d) => d.variableId)
    const { data: variablesDataMap, status } = useQueryVariablesDataAndMetadata(
        variableIds,
        options
    )

    // Return early if data fetching failed or is still in progress
    if (status !== "success" || !variablesDataMap) return { status }

    const mdimConfigView = mdimConfig
        ? searchParamsToMultiDimView(mdimConfig, mdimSearchParams)
        : undefined
    const yVariableId = mdimConfigView?.indicators.y[0]?.id
    if (yVariableId && variablesDataMap.has(yVariableId)) {
        const variableData = variablesDataMap.get(yVariableId)!
        const enrichedMetadata = _.mergeWith(
            {}, // merge mutates the first argument
            variableData?.metadata,
            mdimConfig?.metadata,
            mdimConfigView?.metadata,
            // Overwrite arrays completely instead of merging them.
            // Otherwise fall back to the default merge behavior.
            (_, srcValue) => {
                return Array.isArray(srcValue) ? srcValue : undefined
            }
        ) as OwidVariableWithSourceAndDimension

        variablesDataMap.set(yVariableId, {
            data: variableData.data,
            metadata: enrichedMetadata,
        })
    }

    // Transform the fetched variable data and metadata into Grapher's input table format
    const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
        variablesDataMap,
        dimensions,
        selectedEntityColors
    )

    return { status: "success", data: inputTable }
}

function useQueryVariablesDataAndMetadata(
    variableIds: number[],
    options: { enabled?: boolean; dataApiUrl: string }
): { data?: MultipleOwidVariableDataDimensionsMap; status: QueryStatus } {
    // Fetch data and metadata for all variables
    const metadataResponses = useQueryVariablesMetadata(variableIds, options)
    const dataResponses = useQueryVariablesData(variableIds, options)

    // Return early if any individual query has failed or is still pending
    const allResponses = [...metadataResponses, ...dataResponses]
    if (allResponses.some((result) => result.status === "error"))
        return { status: "error" }
    if (allResponses.some((result) => result.status === "loading"))
        return { status: "loading" }

    // Combine the metadata and data query results into a unified map
    // Each variable ID maps to an object containing both its data and metadata
    const dataMap = new Map<number, OwidVariableDataMetadataDimensions>()
    variableIds.forEach((variableId, index) => {
        const metadataResponse = metadataResponses[index]
        const dataResponse = dataResponses[index]

        if (metadataResponse.data && dataResponse.data) {
            dataMap.set(variableId, {
                data: dataResponse.data,
                metadata: metadataResponse.data,
            })
        }
    })

    return { data: dataMap, status: "success" }
}

const useQueryVariablesMetadata = (
    variableIds: number[],
    { enabled, dataApiUrl }: { enabled?: boolean; dataApiUrl: string }
) =>
    useQueries({
        queries: variableIds.map((variableId) => ({
            queryKey: ["variable-metadata", variableId],
            queryFn: () => {
                const route = getVariableMetadataRoute(dataApiUrl, variableId)
                return fetchJson<OwidVariableWithSourceAndDimension>(route)
            },
            enabled,
        })),
    })

const useQueryVariablesData = (
    variableIds: number[],
    { enabled, dataApiUrl }: { enabled?: boolean; dataApiUrl: string }
) =>
    useQueries({
        queries: variableIds.map((variableId) => ({
            queryKey: ["variable-data", variableId],
            queryFn: () => {
                const route = getVariableDataRoute(dataApiUrl, variableId)
                return fetchJson<OwidVariableMixedData>(route)
            },
            enabled,
        })),
    })
