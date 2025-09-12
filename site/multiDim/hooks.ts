import * as _ from "lodash-es"
import { useEffect, useMemo, useRef } from "react"

import {
    GrapherAnalytics,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import { MultiDimDimensionChoices } from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"

export const analytics = new GrapherAnalytics()

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

export function useMultiDimAnalytics(
    slug: string | null,
    config: MultiDimDataPageConfig,
    settings: MultiDimDimensionChoices
) {
    // Settings might be a different object with the same properties, so we
    // can't rely on React's equality check.
    const oldSettingsRef = useRef<MultiDimDimensionChoices | null>(null)
    useEffect(() => {
        // Log analytics event on page load and when the settings change.
        if (slug && !_.isEqual(settings, oldSettingsRef.current)) {
            const newView = config.findViewByDimensions(settings)
            if (newView) {
                analytics.logGrapherView(slug, {
                    viewConfigId: newView.fullConfigId,
                })
            }
            oldSettingsRef.current = { ...settings }
        }
    }, [config, slug, settings])
}
