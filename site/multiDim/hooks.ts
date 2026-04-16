import * as _ from "lodash-es"
import { RefObject, useEffect, useMemo, useRef, useState } from "react"

import {
    GrapherAnalytics,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import { MultiDimDimensionChoices } from "@ourworldindata/types"
import { MultiDimDataPageConfig } from "@ourworldindata/utils"
import { useQuery } from "@tanstack/react-query"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"
import { getMultiDimConfigBySlug } from "./api.js"

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

export function useMultiDimConfig({
    slug,
    isPreviewing,
    enabled = true,
}: {
    slug?: string
    isPreviewing?: boolean
    enabled?: boolean
}) {
    return useQuery({
        queryKey: ["multi-dim-config", slug, Boolean(isPreviewing)],
        queryFn: () => {
            if (!slug) {
                throw new Error("Slug is required")
            }
            return getMultiDimConfigBySlug(slug, Boolean(isPreviewing))
        },
        enabled: Boolean(slug) && enabled,
        staleTime: Infinity,
    })
}

export function useMultiDimAnalytics(
    slug: string | null,
    config: MultiDimDataPageConfig,
    settings: MultiDimDimensionChoices,
    containerRef?: RefObject<HTMLElement | null>
) {
    // Settings might be a different object with the same properties, so we
    // can't rely on React's equality check.
    const oldSettingsRef = useRef<MultiDimDimensionChoices | null>(null)
    const [hasBeenVisible, setHasBeenVisible] = useState(false)

    useEffect(() => {
        if (!containerRef) {
            setHasBeenVisible(true)
            return undefined
        }

        const container = containerRef.current
        if (!container) return undefined

        if ("IntersectionObserver" in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setHasBeenVisible(true)
                        observer.disconnect()
                    }
                })
            })
            observer.observe(container)
            return () => observer.disconnect()
        }

        setHasBeenVisible(true)
        return undefined
    }, [containerRef])

    useEffect(() => {
        // Log analytics event on page load and when the settings change, but
        // only once the multi-dim has become visible.
        if (
            slug &&
            hasBeenVisible &&
            !_.isEqual(settings, oldSettingsRef.current)
        ) {
            const newView = config.findViewByDimensions(settings)
            if (newView) {
                analytics.logGrapherView(slug, {
                    viewConfigId: newView.fullConfigId,
                })
            }
            oldSettingsRef.current = { ...settings }
        }
    }, [config, hasBeenVisible, slug, settings])
}
