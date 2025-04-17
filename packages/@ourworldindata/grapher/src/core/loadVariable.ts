import {
    AssetMap,
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
    assetMap?: AssetMap
): Promise<OwidVariableDataMetadataDimensions> {
    const dataPromise = fetchWithRetry(
        getVariableDataRoute(dataApiUrl, variableId, { assetMap })
    )
    const metadataPromise = fetchWithRetry(
        getVariableMetadataRoute(dataApiUrl, variableId, { assetMap })
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
