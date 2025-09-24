import {
    ArchiveContext,
    AssetMap,
    MultipleOwidVariableDataDimensionsMap,
    OwidVariableDataMetadataDimensions,
} from "@ourworldindata/types"
import { fetchWithRetry, readFromAssetMap } from "@ourworldindata/utils"
import urljoin from "url-join"

export const getVariableDataRoute = (
    dataApiUrl: string,
    variableId: number,
    { assetMap, noCache }: { assetMap?: AssetMap; noCache?: boolean } = {}
): string => {
    if (dataApiUrl.includes("v1/indicators")) {
        const filename = `${variableId}.data.json`
        const url = readFromAssetMap(assetMap, {
            path: filename,
            // fetching from Data API, e.g. https://api.ourworldindata.org/v1/indicators/123.data.json
            fallback: urljoin(dataApiUrl, filename),
        })
        return noCache ? `${url}?nocache` : url
    } else {
        throw new Error(`dataApiUrl format not supported: ${dataApiUrl}`)
    }
}

export const getVariableMetadataRoute = (
    dataApiUrl: string,
    variableId: number,
    { assetMap, noCache }: { assetMap?: AssetMap; noCache?: boolean } = {}
): string => {
    if (dataApiUrl.includes("v1/indicators")) {
        const filename = `${variableId}.metadata.json`
        const url = readFromAssetMap(assetMap, {
            path: filename,
            // fetching from Data API, e.g. https://api.ourworldindata.org/v1/indicators/123.metadata.json
            fallback: urljoin(dataApiUrl, filename),
        })
        return noCache ? `${url}?nocache` : url
    } else {
        throw new Error(`dataApiUrl format not supported: ${dataApiUrl}`)
    }
}

export async function loadVariableDataAndMetadata(
    variableId: number,
    dataApiUrl: string,
    options?: {
        assetMap?: AssetMap
        noCache?: boolean
        loadMetadataOnly?: boolean
    }
): Promise<OwidVariableDataMetadataDimensions> {
    const metadataPromise = fetchWithRetry(
        getVariableMetadataRoute(dataApiUrl, variableId, options)
    )

    if (options?.loadMetadataOnly) {
        const metadataResponse = await metadataPromise
        if (!metadataResponse.ok) throw new Error(metadataResponse.statusText)
        const metadata = await metadataResponse.json()
        // Return empty data when only metadata is requested
        return { data: { values: [], entities: [], years: [] }, metadata }
    }

    const dataPromise = fetchWithRetry(
        getVariableDataRoute(dataApiUrl, variableId, options)
    )
    const [dataResponse, metadataResponse] = await Promise.all([
        dataPromise,
        metadataPromise,
    ])
    if (!dataResponse.ok) throw new Error(dataResponse.statusText)
    if (!metadataResponse.ok) throw new Error(metadataResponse.statusText)
    const data = await dataResponse.json()
    const metadata = await metadataResponse.json()
    return { data, metadata }
}

export async function loadVariablesDataSite(
    variableIds: number[],
    dataApiUrl: string,
    archiveContext: ArchiveContext | undefined,
    noCache?: boolean,
    loadMetadataOnly?: boolean
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const loadVariableDataPromises = variableIds.map((variableId) =>
        loadVariableDataAndMetadata(variableId, dataApiUrl, {
            assetMap:
                archiveContext?.type === "archive-page"
                    ? archiveContext.assets.runtime
                    : undefined,
            noCache,
            loadMetadataOnly,
        })
    )
    const variablesData: OwidVariableDataMetadataDimensions[] =
        await Promise.all(loadVariableDataPromises)
    const variablesDataMap = new Map(
        variablesData.map((data) => [data.metadata.id, data])
    )
    return variablesDataMap
}
