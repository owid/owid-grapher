import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ArchiveContext,
    isIndicatorDimension,
    OwidChartDimensionInterface,
    OwidVariableDataMetadataDimensions,
    SelectedEntityColors,
} from "@ourworldindata/utils"
import { legacyToOwidTableAndDimensions } from "./LegacyToOwidTable.js"
import {
    loadVariablesDataSite,
    loadVariableDataAndMetadata,
} from "./loadVariable.js"
import { toJS } from "mobx"

export type FetchInputTableForConfigFn = (args: {
    dimensions?: OwidChartDimensionInterface[]
    selectedEntityColors?: SelectedEntityColors
    dataApiUrl: string
    /**
     * Extra headers for the requests to the data API. External users and our
     * own client-side calls pass an empty object. Server-side calls must pass
     * the internal-key header (see getDataApiInternalHeaders), or the API
     * refuses them the data files of non-redistributable indicators.
     */
    dataApiHeaders: Record<string, string>
    archiveContext?: ArchiveContext
    noCache?: boolean
    loadMetadataOnly?: boolean
}) => Promise<OwidTable | undefined>

/**
 * Fetch the data and metadata of all indicators in a chart config's
 * dimensions from the data API, and turn them into the chart's input table.
 * Returns undefined if the config has no indicator dimensions.
 */
export const fetchInputTableForConfig: FetchInputTableForConfigFn = async (
    args
) => {
    const indicatorDimensions = (args.dimensions ?? []).filter(
        isIndicatorDimension
    )
    if (indicatorDimensions.length === 0) return undefined
    const variables = indicatorDimensions.map((d) => d.variableId)
    const variablesDataMap = await loadVariablesDataSite(
        variables,
        args.dataApiUrl,
        args.archiveContext,
        args.dataApiHeaders,
        args.noCache,
        args.loadMetadataOnly
    )
    const inputTable = legacyToOwidTableAndDimensions(
        variablesDataMap,
        indicatorDimensions,
        args.selectedEntityColors
    )

    return inputTable
}

export function getCachingInputTableFetcher(
    dataApiUrl: string,
    archiveContext: ArchiveContext | undefined,
    /** See `dataApiHeaders` of fetchInputTableForConfig */
    dataApiHeaders: Record<string, string>,
    noCache?: boolean,
    loadMetadataOnly?: boolean
): (
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors: SelectedEntityColors | undefined
) => Promise<OwidTable | undefined> {
    const cache: Map<number, OwidVariableDataMetadataDimensions> = new Map()
    let previousDimensions: OwidChartDimensionInterface[] = []
    let previousSelectedEntityColors: SelectedEntityColors | undefined =
        undefined

    return async (
        dimensionsMobx: OwidChartDimensionInterface[],
        selectedEntityColorsMobx: SelectedEntityColors | undefined
    ) => {
        // Check if dimensions have changed
        const dimensions = dimensionsMobx.map((x) => toJS(x)) // Convert MobX observable to plain object
        const selectedEntityColors = toJS(selectedEntityColorsMobx)

        if (
            _.isEqual(previousDimensions, dimensions) &&
            _.isEqual(previousSelectedEntityColors, selectedEntityColors)
        ) {
            return undefined // No changes in dimensions
        }
        previousDimensions = dimensions
        previousSelectedEntityColors = selectedEntityColors

        const indicatorDimensions = dimensions.filter(isIndicatorDimension)
        if (indicatorDimensions.length === 0) return undefined

        const variables = indicatorDimensions.map((d) => d.variableId)
        const variablesToFetch = variables.filter((v) => !cache.has(v))

        if (variablesToFetch.length > 0) {
            const fetchedData = await Promise.all(
                variablesToFetch.map((variableId) =>
                    loadVariableDataAndMetadata(variableId, dataApiUrl, {
                        dataApiHeaders,
                        assetMap:
                            archiveContext?.type === "archive-page"
                                ? archiveContext.assets.runtime
                                : undefined,
                        noCache,
                        loadMetadataOnly,
                    })
                )
            )
            fetchedData.forEach((data) => cache.set(data.metadata.id, data))
        }

        const variablesDataMap = new Map(
            variables.map((v) => [v, cache.get(v)!])
        )

        const inputTable = legacyToOwidTableAndDimensions(
            variablesDataMap,
            indicatorDimensions,
            selectedEntityColors
        )

        return inputTable
    }
}
