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

const measuredLegacyToOwidTableAndDimensions = (
    slug: string | undefined,
    ...args: Parameters<typeof legacyToOwidTableAndDimensions>
): OwidTable => {
    const startMark = performance.now()
    const table = legacyToOwidTableAndDimensions(...args)
    try {
        performance.measure("legacyToOwidTableAndDimensions", {
            start: startMark,
            end: performance.now(),
            detail: {
                // Top-level so Sentry's userTimingIntegration records it as
                // its own span attribute
                slug,
                devtools: {
                    track: "Grapher",
                    properties: [["slug", slug]],
                },
            },
        })
    } catch {
        // In old browsers, the above may throw an error - just ignore it
    }
    return table
}

export type FetchInputTableForConfigFn = (args: {
    dimensions?: OwidChartDimensionInterface[]
    selectedEntityColors?: SelectedEntityColors
    dataApiUrl: string
    archiveContext?: ArchiveContext
    noCache?: boolean
    loadMetadataOnly?: boolean
    /** Only used to label the performance measurement */
    slug?: string
}) => Promise<OwidTable | undefined>

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
        args.noCache,
        args.loadMetadataOnly
    )
    const inputTable = measuredLegacyToOwidTableAndDimensions(
        args.slug,
        variablesDataMap,
        indicatorDimensions,
        args.selectedEntityColors
    )

    return inputTable
}

export function getCachingInputTableFetcher({
    dataApiUrl,
    archiveContext,
    noCache,
    loadMetadataOnly,
    slug,
}: {
    dataApiUrl: string
    archiveContext?: ArchiveContext
    noCache?: boolean
    loadMetadataOnly?: boolean
    /** Only used to label the performance measurement */
    slug?: string
}): (
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

        const inputTable = measuredLegacyToOwidTableAndDimensions(
            slug,
            variablesDataMap,
            indicatorDimensions,
            selectedEntityColors
        )

        return inputTable
    }
}
