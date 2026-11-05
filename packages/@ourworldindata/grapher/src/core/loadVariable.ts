import {
    ArchiveContext,
    AssetMap,
    MultipleOwidVariableDataDimensionsMap,
    normalizeDescriptionKey,
    OwidVariableDataMetadataDimensions,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"
import {
    fetchWithRetry,
    getOwidDataFetchUserAgent,
    readFromAssetMap,
} from "@ourworldindata/utils"
import urljoin from "url-join"

// Attach a descriptive User-Agent to our own server-side data API calls so
// analytics can attribute them to OWID rather than counting them as anonymous
// external traffic. See getOwidDataFetchUserAgent for details; it returns
// undefined in the browser, so the shared client chart path is unaffected.
const dataFetchUserAgent = getOwidDataFetchUserAgent()

const getDataFetchOptions = (
    dataApiHeaders: Record<string, string>
): RequestInit | undefined => {
    const headers = {
        ...(dataFetchUserAgent ? { "User-Agent": dataFetchUserAgent } : {}),
        ...dataApiHeaders,
    }
    // Send no extra headers from the browser, so the request stays a simple
    // CORS request that needs no preflight
    return Object.keys(headers).length > 0 ? { headers } : undefined
}

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
    options: {
        /** See `dataApiHeaders` of fetchInputTableForConfig */
        dataApiHeaders: Record<string, string>
        assetMap?: AssetMap
        noCache?: boolean
        loadMetadataOnly?: boolean
    }
): Promise<OwidVariableDataMetadataDimensions> {
    const dataFetchOptions = getDataFetchOptions(options.dataApiHeaders)
    const metadataPromise = fetchWithRetry(
        getVariableMetadataRoute(dataApiUrl, variableId, options),
        dataFetchOptions
    )

    if (options.loadMetadataOnly) {
        const metadataResponse = await metadataPromise
        if (!metadataResponse.ok) throw new Error(metadataResponse.statusText)
        const metadata: OwidVariableWithSourceAndDimension =
            await metadataResponse.json()
        // Metadata files written before the descriptionKey string migration
        // hold arrays — normalize at the fetch boundary.
        metadata.descriptionKey = normalizeDescriptionKey(
            metadata.descriptionKey
        )
        // Return empty data when only metadata is requested
        return { data: { values: [], entities: [], years: [] }, metadata }
    }

    const dataPromise = fetchWithRetry(
        getVariableDataRoute(dataApiUrl, variableId, options),
        dataFetchOptions
    )
    const [dataResponse, metadataResponse] = await Promise.all([
        dataPromise,
        metadataPromise,
    ])
    if (!dataResponse.ok) throw new Error(dataResponse.statusText)
    if (!metadataResponse.ok) throw new Error(metadataResponse.statusText)
    const data = await dataResponse.json()
    const metadata: OwidVariableWithSourceAndDimension =
        await metadataResponse.json()
    metadata.descriptionKey = normalizeDescriptionKey(metadata.descriptionKey)
    return { data, metadata }
}

export async function loadVariablesDataSite(
    variableIds: number[],
    dataApiUrl: string,
    archiveContext: ArchiveContext | undefined,
    dataApiHeaders: Record<string, string>,
    noCache?: boolean,
    loadMetadataOnly?: boolean
): Promise<MultipleOwidVariableDataDimensionsMap> {
    const loadVariableDataPromises = variableIds.map((variableId) =>
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
    const variablesData: OwidVariableDataMetadataDimensions[] =
        await Promise.all(loadVariableDataPromises)
    const variablesDataMap = new Map(
        variablesData.map((data) => [data.metadata.id, data])
    )
    return variablesDataMap
}
