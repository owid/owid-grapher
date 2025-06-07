import { getVariableMetadataRoute } from "@ourworldindata/grapher"
import {
    AssetMap,
    GrapherInterface,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"
import { fetchWithRetry, readFromAssetMap } from "@ourworldindata/utils"
import { DATA_API_URL } from "../../settings/clientSettings.js"
import { memoize } from "lodash-es"

export const cachedGetVariableMetadata = memoize(
    async (
        variableId: number,
        assetMap?: AssetMap
    ): Promise<OwidVariableWithSourceAndDimension> => {
        const response = await fetchWithRetry(
            getVariableMetadataRoute(DATA_API_URL, variableId, {
                assetMap,
            })
        )
        return await response.json()
    }
)

export const cachedGetGrapherConfigByUuid = memoize(
    async (
        grapherConfigUuid: string,
        isPreviewing: boolean,
        assetMap?: AssetMap
    ): Promise<GrapherInterface> => {
        const configFileName = `${grapherConfigUuid}.config.json`
        const fallbackUrl = `/grapher/by-uuid/${configFileName}${isPreviewing ? "?nocache" : ""}`
        const url = readFromAssetMap(assetMap, {
            path: configFileName,
            fallback: fallbackUrl,
        })
        const response = await fetchWithRetry(url)
        return await response.json()
    }
)
