import { useMemo } from "react"

import { GrapherProgrammaticInterface } from "@ourworldindata/grapher"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"

/**
 * Used to create a base grapher config for an mdim shared among all views.
 * @param additionalConfig - Additional config to merge with the base config.
 */
export const useBaseGrapherConfig = (
    additionalConfig?: Partial<GrapherProgrammaticInterface>
) => {
    return useMemo(() => {
        return {
            bakedGrapherURL: BAKED_GRAPHER_URL,
            adminBaseUrl: ADMIN_BASE_URL,
            dataApiUrl: DATA_API_URL,
            canHideExternalControlsInEmbed: true,
            ...additionalConfig,
        }
    }, [additionalConfig])
}
