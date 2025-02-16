import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Sentry from "@sentry/react"
import {
    getCachingInputTableFetcher,
    Grapher,
    GrapherAnalytics,
    GrapherProgrammaticInterface,
    GrapherState,
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
    const manager = useRef(localGrapherConfig?.manager ?? {})
    const grapherRef = useRef<GrapherState>(
        new GrapherState({
            ...baseGrapherConfig,
            manager: manager.current,
            queryStr,
        })
    )
    const grapherDataLoader = useRef(
        getCachingInputTableFetcher(DATA_API_URL, undefined)
    )
    const grapherContainerRef = useRef<HTMLDivElement>(null)
    const bounds = useElementBounds(grapherContainerRef)
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
        manager.current.editUrl = editUrl

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
                if (slug) {
                    grapherConfig.slug = slug // Needed for the URL used for sharing.
                }
                grapher.setAuthoredVersion(grapherConfig)
                grapher.reset()
                grapher.updateFromObject(grapherConfig)
                void grapherDataLoader
                    .current(
                        grapherConfig.dimensions ?? [],
                        grapherConfig.selectedEntityColors
                    )
                    .then((table) => {
                        if (table) {
                            grapher.inputTable = table
                        }
                    })
                grapher.populateFromQueryParams(newGrapherParams)
            })
            .catch(Sentry.captureException)
        return () => {
            ignoreFetchedData = true
        }
    }, [config, localGrapherConfig, searchParams, settings, slug, manager])

    // use a useEffects on the bounds to update the grapherState.externalBounds

    useEffect(() => {
        if (grapherRef.current) {
            grapherRef.current.externalBounds = bounds
        }
    }, [bounds])

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
                    grapherState={grapherRef.current}
                    {...baseGrapherConfig}
                />
            </div>
        </div>
    )
}
