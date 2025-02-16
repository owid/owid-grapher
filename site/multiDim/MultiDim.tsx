import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as Sentry from "@sentry/react"
import {
    getCachingInputTableFetcher,
    Grapher,
    GrapherAnalytics,
    GrapherProgrammaticInterface,
    GrapherState,
    loadVariableDataAndMetadata,
} from "@ourworldindata/grapher"
import {
    extractMultiDimChoicesFromSearchParams,
    GRAPHER_TAB_QUERY_PARAMS,
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
            additionalDataLoaderFn: (varId: number) =>
                loadVariableDataAndMetadata(varId, DATA_API_URL),
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
            const { selectedChoices } =
                config.filterToAvailableChoices(settings)
            setSettings(selectedChoices)
            if (slug) analytics.logGrapherView(slug, { view: selectedChoices })
        },
        [config, slug]
    )

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
        const analyticsContext = {
            mdimSlug: slug ?? undefined,
            mdimView: settings,
        }
        manager.current.editUrl = editUrl
        manager.current.analyticsContext = analyticsContext

        const newGrapherParams: GrapherQueryParams = {
            ...grapher.changedParams,
            // If the grapher has data preserve the active tab in the new view,
            // otherwise use the tab from the URL.
            tab: grapher.hasData
                ? grapher.mapGrapherTabToQueryParam(grapher.activeTab)
                : (searchParams.get("tab") ?? undefined),
            ...settings,
        }

        // reset map state if switching to a chart
        if (newGrapherParams.tab !== GRAPHER_TAB_QUERY_PARAMS.map) {
            newGrapherParams.globe = "0"
            newGrapherParams.mapSelect = ""
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
