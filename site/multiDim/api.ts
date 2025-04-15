import { getVariableMetadataRoute } from "@ourworldindata/grapher"
import {
    GrapherInterface,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"
import { fetchWithRetry } from "@ourworldindata/utils"
import { DATA_API_URL } from "../../settings/clientSettings.js"
import { memoize } from "lodash"

export const cachedGetVariableMetadata = memoize(
    async (variableId: number): Promise<OwidVariableWithSourceAndDimension> => {
        const response = await fetchWithRetry(
            getVariableMetadataRoute(DATA_API_URL, variableId)
        )
        return await response.json()
    }
)
export const cachedGetGrapherConfigByUuid = memoize(
    async (
        grapherConfigUuid: string,
        isPreviewing: boolean
    ): Promise<GrapherInterface> => {
        const response = await fetchWithRetry(
            `/grapher/by-uuid/${grapherConfigUuid}.config.json${isPreviewing ? "?nocache" : ""}`
        )
        return await response.json()
    }
)
