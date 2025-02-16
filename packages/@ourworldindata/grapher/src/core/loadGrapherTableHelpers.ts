import { OwidTable } from "@ourworldindata/core-table"
import {
    ArchivedChartOrArchivePageMeta,
    isEqual,
    OwidChartDimensionInterface,
    OwidVariableDataMetadataDimensions,
} from "@ourworldindata/utils"
import { legacyToOwidTableAndDimensionsWithMandatorySlug } from "./LegacyToOwidTable.js"
import {
    loadVariablesDataSite,
    loadVariableDataAndMetadata,
} from "./loadVariable.js"

export async function fetchInputTableForConfig(
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined,
    dataApiUrl: string,
    archivedChartInfo: ArchivedChartOrArchivePageMeta | undefined
): Promise<OwidTable | undefined> {
    if (dimensions.length === 0) return undefined
    const variables = dimensions.map((d) => d.variableId)
    const variablesDataMap = await loadVariablesDataSite(
        variables,
        dataApiUrl,
        archivedChartInfo
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
    archivedChartInfo: ArchivedChartOrArchivePageMeta | undefined
): (
    dimensions: OwidChartDimensionInterface[],
    selectedEntityColors:
        | { [entityName: string]: string | undefined }
        | undefined
) => Promise<OwidTable | undefined> {
    const cache: Map<number, OwidVariableDataMetadataDimensions> = new Map()
    let previousDimensions: OwidChartDimensionInterface[] = []

    return async (
        dimensions: OwidChartDimensionInterface[],
        selectedEntityColors:
            | { [entityName: string]: string | undefined }
            | undefined
    ) => {
        // Check if dimensions have changed

        if (isEqual(previousDimensions, dimensions)) {
            return undefined // No changes in dimensions
        }
        previousDimensions = dimensions

        if (dimensions.length === 0) return undefined

        const variables = dimensions.map((d) => d.variableId)
        const variablesToFetch = variables.filter((v) => !cache.has(v))

        if (variablesToFetch.length > 0) {
            const fetchedData = await Promise.all(
                variablesToFetch.map((variableId) =>
                    loadVariableDataAndMetadata(
                        variableId,
                        dataApiUrl,
                        archivedChartInfo?.type === "archive-page"
                            ? archivedChartInfo.assets.runtime
                            : undefined
                    )
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
