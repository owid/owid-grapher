import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Sentry from "@sentry/react"
import {
    Grapher,
    GrapherAnalytics,
    GrapherProgrammaticInterface,
} from "@ourworldindata/grapher"
import {
    extractMultiDimChoicesFromSearchParams,
    GrapherQueryParams,
    MultiDimDataPageConfig,
    MultiDimDimensionChoices,
} from "@ourworldindata/utils"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    DATA_API_URL,
} from "../../settings/clientSettings.js"
import { useElementBounds } from "../hooks.js"
import { cachedGetGrapherConfigByUuid } from "./api.js"
import { MultiDimSettingsPanel } from "./MultiDimDataPageSettingsPanel.js"

const baseGrapherConfig: GrapherProgrammaticInterface = {
    bakedGrapherURL: BAKED_GRAPHER_URL,
    adminBaseUrl: ADMIN_BASE_URL,
    dataApiUrl: DATA_API_URL,
    canHideExternalControlsInEmbed: true,
    isEmbeddedInAnOwidPage: true,
}

const analytics = new GrapherAnalytics()

export default function MultiDim({
    config,
    localGrapherConfig,
    slug,
    queryStr,
}: {
    config: MultiDimDataPageConfig
    localGrapherConfig?: GrapherProgrammaticInterface
    slug: string | null
    queryStr: string
}) {
    const grapherRef = useRef<Grapher>(null)
    const grapherContainerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(grapherContainerRef)
    const [manager, setManager] = useState({
        ...localGrapherConfig?.manager,
    })
    const searchParams = useMemo(
        () => new URLSearchParams(queryStr),
        [queryStr]
    )
    const hasControls = searchParams.get("hideControls") !== "true"

    const [settings, setSettings] = useState(() => {
        const choices = extractMultiDimChoicesFromSearchParams(
            searchParams,
            config
        )
        return config.filterToAvailableChoices(choices).selectedChoices
    })

    const handleSettingsChange = useCallback(
        (settings: MultiDimDimensionChoices) => {
            setSettings(
                config.filterToAvailableChoices(settings).selectedChoices
            )
        },
        [config]
    )

    useEffect(() => {
        if (slug) analytics.logGrapherView(slug, { view: settings })
    }, [slug, settings])

    useEffect(() => {
        // Prevent a race condition from setting incorrect data.
        // https://react.dev/learn/synchronizing-with-effects#fetching-data
        let ignoreFetchedData = false

        const grapher = grapherRef.current
        if (!grapher) return

        const newView = config.findViewByDimensions(settings)
        if (!newView) {
            throw new Error(
                `No view found for dimensions: ${JSON.stringify(settings)}`
            )
        }

        const variables = newView.indicators?.["y"]
        const editUrl =
            variables?.length === 1
                ? `variables/${variables[0].id}/config`
                : undefined
        setManager((prev) => ({ ...prev, editUrl }))

        const newGrapherParams: GrapherQueryParams = {
            ...grapher.changedParams,
            // If the grapher has data preserve the active tab in the new view,
            // otherwise use the tab from the URL.
            tab: grapher.hasData
                ? grapher.mapGrapherTabToQueryParam(grapher.activeTab)
                : (searchParams.get("tab") ?? undefined),
            ...settings,
        }

        cachedGetGrapherConfigByUuid(newView.fullConfigId, false)
            .then((viewGrapherConfig) => {
                if (ignoreFetchedData) return
                const grapherConfig = {
                    ...viewGrapherConfig,
                    ...localGrapherConfig,
                    ...baseGrapherConfig,
                }
                grapher.setAuthoredVersion(grapherConfig)
                grapher.reset()
                grapher.updateFromObject(grapherConfig)
                grapher.downloadData()
                grapher.populateFromQueryParams(newGrapherParams)
            })
            .catch(Sentry.captureException)
        return () => {
            ignoreFetchedData = true
        }
    }, [config, localGrapherConfig, searchParams, settings])

    return (
        <div className="multi-dim-container">
            {hasControls && (
                <MultiDimSettingsPanel
                    className="multi-dim-settings"
                    config={config}
                    settings={settings}
                    onChange={handleSettingsChange}
                />
            )}
            <div
                className="multi-dim-grapher-container"
                ref={grapherContainerRef}
            >
                <Grapher
                    ref={grapherRef}
                    {...baseGrapherConfig}
                    bounds={bounds}
                    manager={manager}
                    queryStr={queryStr}
                />
            </div>
        </div>
    )
}
