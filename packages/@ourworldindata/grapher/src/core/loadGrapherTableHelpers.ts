import * as _ from "lodash-es"
import { OwidTable } from "@ourworldindata/core-table"
import {
    ArchiveContext,
    OwidChartDimensionInterface,
    OwidVariableDataMetadataDimensions,
} from "@ourworldindata/utils"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "./LegacyToOwidTable.js"
import {
    loadVariablesDataSite,
    loadVariableDataAndMetadata,
} from "./loadVariable.js"
import { toJS } from "mobx"

export async function fetchInputTableForConfig(
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined,
    dataApiUrl: string,
    archiveContext: ArchiveContext | undefined,
    noCache?: boolean,
    loadMetadataOnly?: boolean
): Promise<OwidTable | undefined> {
    if (dimensions.length === 0) return undefined
    const variables = dimensions.map((d) => d.variableId)
    const variablesDataMap = await loadVariablesDataSite(
        variables,
        dataApiUrl,
        archiveContext,
        noCache,
        loadMetadataOnly
    )
    const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
        variablesDataMap,
        dimensions,
        selectedEntityColors
    )

    return inputTable
}

export function getCachingInputTableFetcher(
    dataApiUrl: string,
    archiveContext: ArchiveContext | undefined,
    noCache?: boolean,
    loadMetadataOnly?: boolean
): (
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined
) => Promise<OwidTable | undefined> {
    const cache: Map<number, OwidVariableDataMetadataDimensions> = new Map()
    let previousDimensions: OwidChartDimensionInterface[] = []
    let previousSelectedEntityColors:
        | {
              [entityName: string]: string | undefined
          }
        | undefined = undefined

    return async (
        dimensionsMobx: OwidChartDimensionInterface[],
        selectedEntityColorsMobx:
            | { [entityName: string]: string | undefined }
            | undefined
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

        if (dimensions.length === 0) return undefined

        const variables = dimensions.map((d) => d.variableId)
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

        const inputTable = legacyToOwidTableAndDimensionsWithMandatorySlug(
            variablesDataMap,
            dimensions,
            selectedEntityColors
        )

        return inputTable
    }
}
