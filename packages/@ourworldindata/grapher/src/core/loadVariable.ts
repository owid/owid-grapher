import { OwidVariableDataMetadataDimensions } from "@ourworldindata/types"
import { fetchWithRetry } from "@ourworldindata/utils"

export const getVariableDataRoute = (
    dataApiUrl: string,
    variableId: number
): string => {
    if (dataApiUrl.includes("v1/indicators/")) {
        // fetching from Data API, e.g. https://api.ourworldindata.org/v1/indicators/123.data.json
        return `${dataApiUrl}${variableId}.data.json`
    } else {
        throw new Error(`dataApiUrl format not supported: ${dataApiUrl}`)
    }
}

export const getVariableMetadataRoute = (
    dataApiUrl: string,
    variableId: number
): string => {
    if (dataApiUrl.includes("v1/indicators/")) {
        // fetching from Data API, e.g. https://api.ourworldindata.org/v1/indicators/123.metadata.json
        return `${dataApiUrl}${variableId}.metadata.json`
    } else {
        throw new Error(`dataApiUrl format not supported: ${dataApiUrl}`)
    }
}

export async function loadVariableDataAndMetadata(
    variableId: number,
    dataApiUrl: string
): Promise<OwidVariableDataMetadataDimensions> {
    const dataPromise = fetchWithRetry(
        getVariableDataRoute(dataApiUrl, variableId)
    )
    const metadataPromise = fetchWithRetry(
        getVariableMetadataRoute(dataApiUrl, variableId)
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
